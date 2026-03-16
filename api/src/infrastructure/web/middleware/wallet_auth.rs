use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    body::Body,
    extract::{OriginalUri, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use dashmap::DashMap;
use sha2::{Digest, Sha256};

use crate::infrastructure::{
    config::SolanaConfig,
    web::{
        extractor::WalletAddress,
        middleware::on_chain::{SCOPE_DELETE, SCOPE_READ, SCOPE_WRITE, verify_on_chain},
        response::ApiError,
    },
};

/// Clock skew tolerance in seconds
const CLOCK_SKEW_SEC: u64 = 5;
/// Maximum allowed TTL (expires - created) in seconds
const MAX_TTL_SEC: u64 = 300;

/// Global nonce store — prevents replay within a request's TTL window.
/// Key: nonce string, Value: expiry unix timestamp (seconds).
static NONCE_STORE: std::sync::LazyLock<Arc<DashMap<String, u64>>> =
    std::sync::LazyLock::new(|| Arc::new(DashMap::new()));

pub async fn wallet_auth_middleware(req: Request, next: Next) -> Result<Response, ApiError> {
    // 1. Parse RFC 9421 Signature-Input header
    let sig_input_raw = get_header(&req, "signature-input")?;
    let sig_raw = get_header(&req, "signature")?;

    let parsed = parse_signature_input(&sig_input_raw).ok_or_else(|| {
        ApiError::default()
            .with_code(StatusCode::BAD_REQUEST)
            .with_message("Malformed Signature-Input header")
    })?;

    let SigInputParsed {
        label,
        components,
        created,
        expires,
        keyid,
        nonce,
    } = parsed;

    // 2. Validate timestamps
    let now = now_secs();
    if created > now + CLOCK_SKEW_SEC {
        return Err(bad_request("Signature created in the future"));
    }
    if expires < now.saturating_sub(CLOCK_SKEW_SEC) {
        return Err(unauthorized("Signature has expired"));
    }
    if expires.saturating_sub(created) > MAX_TTL_SEC {
        return Err(bad_request("Signature TTL too long"));
    }

    // 3. Nonce replay protection
    if let Some(ref nonce_val) = nonce
        && !consume_nonce(nonce_val, expires)
    {
        return Err(unauthorized("Nonce already used (replay attempt)"));
    }

    // 4. Read body (body can only be read once)
    let method = req.method().to_string();
    let path = req
        .extensions()
        .get::<OriginalUri>()
        .map(|u| u.path().to_string())
        .unwrap_or_default();
    let authority = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost")
        .to_string();

    let (parts, body) = req.into_parts();
    let body_bytes = axum::body::to_bytes(body, 10 * 1024 * 1024)
        .await
        .map_err(|_| bad_request("Failed to read body"))?;

    // 5. Verify Content-Digest if covered by signature
    let mut extra_values: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    if components.contains(&"content-digest".to_string()) {
        let digest_header = parts
            .headers
            .get("content-digest")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| bad_request("Missing content-digest header"))?
            .to_string();

        let computed = compute_content_digest(&body_bytes);
        if digest_header != computed {
            return Err(bad_request("Content-Digest mismatch"));
        }
        extra_values.insert("content-digest".to_string(), digest_header);
    }

    // 6. Reconstruct signature base
    let sig_base = build_signature_base(
        &method,
        &authority,
        &path,
        &components,
        &extra_values,
        SigBaseParams {
            created,
            expires,
            keyid: &keyid,
            nonce: nonce.as_deref(),
        },
    );

    tracing::debug!("RFC 9421 signature base:\n{}", sig_base);

    // 7. Decode and verify signature
    let signature_bytes = parse_signature_header(&sig_raw, &label).ok_or_else(|| {
        ApiError::default()
            .with_code(StatusCode::BAD_REQUEST)
            .with_message("Malformed Signature header")
    })?;

    verify_ed25519(&keyid, sig_base.as_bytes(), &signature_bytes).map_err(|_| {
        ApiError::default()
            .with_code(StatusCode::UNAUTHORIZED)
            .with_message("Invalid signature")
    })?;

    // 8. Optional on-chain AccessGrant verification
    //    Skipped when OWNER_PUBKEY is not configured (development mode).
    if let Some(solana_cfg) = parts.extensions.get::<SolanaConfig>() {
        let required_scope = required_scope_for(&method);
        if let Err(e) = verify_on_chain(solana_cfg, &keyid, required_scope) {
            return Err(ApiError::default()
                .with_code(StatusCode::FORBIDDEN)
                .with_message(e.to_string()));
        }
    }

    // 9. Inject wallet address into extensions
    let mut req = Request::from_parts(parts, Body::from(body_bytes));
    req.extensions_mut().insert(WalletAddress(keyid));

    Ok(next.run(req).await)
}

/// Map HTTP method to required scope bitmask.
fn required_scope_for(method: &str) -> u8 {
    match method {
        "POST" | "PUT" | "PATCH" => SCOPE_WRITE,
        "DELETE" => SCOPE_DELETE,
        _ => SCOPE_READ,
    }
}

// ── RFC 9421 Parsing ─────────────────────────────────────────────────────────

struct SigInputParsed {
    label: String,
    components: Vec<String>,
    created: u64,
    expires: u64,
    keyid: String,
    nonce: Option<String>,
}

/// Parse: `sol=("@method" "@authority" "@path" "content-digest");created=...;expires=...;keyid="...";nonce="..."`
fn parse_signature_input(header: &str) -> Option<SigInputParsed> {
    // Split label from the rest: "sol=(...)..."
    let eq_pos = header.find('=')?;
    let label = header[..eq_pos].trim().to_string();
    let rest = header[eq_pos + 1..].trim();

    // Extract component list: ("@method" "@authority" "@path")
    let paren_start = rest.find('(')?;
    let paren_end = rest.find(')')?;
    let components_raw = &rest[paren_start + 1..paren_end];
    let components: Vec<String> = components_raw
        .split_whitespace()
        .filter_map(|s| {
            let inner = s.strip_prefix('"')?.strip_suffix('"')?;
            Some(inner.to_string())
        })
        .collect();

    let params = &rest[paren_end + 1..];

    let created = extract_int_param(params, "created")?;
    let expires = extract_int_param(params, "expires")?;
    let keyid = extract_str_param(params, "keyid")?;
    let nonce = extract_str_param(params, "nonce");

    Some(SigInputParsed {
        label,
        components,
        created,
        expires,
        keyid,
        nonce,
    })
}

fn extract_int_param(input: &str, name: &str) -> Option<u64> {
    let pattern = format!(";{}=", name);
    let start = input.find(&pattern)? + pattern.len();
    let end = input[start..]
        .find(';')
        .map(|i| start + i)
        .unwrap_or(input.len());
    input[start..end].parse().ok()
}

fn extract_str_param(input: &str, name: &str) -> Option<String> {
    let pattern = format!(";{}=\"", name);
    let start = input.find(&pattern)? + pattern.len();
    let end = input[start..].find('"')? + start;
    Some(input[start..end].to_string())
}

/// Parse: `sol=:<base64>:`
fn parse_signature_header(header: &str, label: &str) -> Option<Vec<u8>> {
    // Find "label=:" and extract until the closing ":"
    let prefix = format!("{}=:", label);
    let start = header.find(&prefix)? + prefix.len();
    let end = header[start..].find(':')? + start;
    BASE64.decode(&header[start..end]).ok()
}

// ── Signature Base Construction ───────────────────────────────────────────────

struct SigBaseParams<'a> {
    created: u64,
    expires: u64,
    keyid: &'a str,
    nonce: Option<&'a str>,
}

fn build_signature_base(
    method: &str,
    authority: &str,
    path: &str,
    components: &[String],
    extra_values: &std::collections::HashMap<String, String>,
    p: SigBaseParams<'_>,
) -> String {
    let component_map: std::collections::HashMap<&str, &str> = {
        let mut m: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
        m.insert("@method", method);
        m.insert("@authority", authority);
        m.insert("@path", path);
        for (k, v) in extra_values {
            m.insert(k.as_str(), v.as_str());
        }
        m
    };

    let mut lines: Vec<String> = components
        .iter()
        .map(|c| {
            let val = component_map.get(c.as_str()).copied().unwrap_or("");
            format!("\"{}\": {}", c, val)
        })
        .collect();

    // @signature-params line
    let component_list = components
        .iter()
        .map(|c| format!("\"{}\"", c))
        .collect::<Vec<_>>()
        .join(" ");
    let mut params_str = format!(
        "({});created={};expires={};keyid=\"{}\"",
        component_list, p.created, p.expires, p.keyid
    );
    if let Some(n) = p.nonce {
        params_str.push_str(&format!(";nonce=\"{}\"", n));
    }
    lines.push(format!("\"@signature-params\": {}", params_str));

    lines.join("\n")
}

// ── Content-Digest (RFC 9530) ─────────────────────────────────────────────────

fn compute_content_digest(body: &[u8]) -> String {
    let hash = Sha256::digest(body);
    let b64 = BASE64.encode(hash.as_slice());
    format!("sha-256=:{}:", b64)
}

// ── Ed25519 Verification ──────────────────────────────────────────────────────

fn verify_ed25519(
    wallet_address: &str,
    message: &[u8],
    signature_bytes: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let pubkey_bytes: [u8; 32] = bs58::decode(wallet_address)
        .into_vec()?
        .try_into()
        .map_err(|_| "Invalid public key length")?;
    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&pubkey_bytes)?;

    let sig_arr: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| "Invalid signature length")?;
    let signature = ed25519_dalek::Signature::from_bytes(&sig_arr);

    verifying_key.verify_strict(message, &signature)?;
    Ok(())
}

// ── Nonce Store ───────────────────────────────────────────────────────────────

/// Returns true (and marks as consumed) if this nonce has not been seen before.
/// Returns false if it was already used (replay).
fn consume_nonce(nonce: &str, expires: u64) -> bool {
    let store = Arc::clone(&NONCE_STORE);

    let now = now_secs();

    // Cleanup expired entries lazily
    store.retain(|_, &mut exp| exp > now);

    if store.contains_key(nonce) {
        return false; // Already used
    }
    store.insert(nonce.to_string(), expires);
    true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn get_header(req: &Request, name: &str) -> Result<String, ApiError> {
    req.headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            ApiError::default()
                .with_code(StatusCode::UNAUTHORIZED)
                .with_message(format!("Missing header: {name}"))
        })
}

fn bad_request(msg: &str) -> ApiError {
    ApiError::default()
        .with_code(StatusCode::BAD_REQUEST)
        .with_message(msg)
}

fn unauthorized(msg: &str) -> ApiError {
    ApiError::default()
        .with_code(StatusCode::UNAUTHORIZED)
        .with_message(msg)
}
