use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    body::Body,
    extract::{OriginalUri, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use sha2::{Digest, Sha256};

use crate::infrastructure::web::{extractor::WalletAddress, response::ApiError};

const TIMESTAMP_TOLERANCE_MS: u64 = 30_000; // 30 seconds

pub async fn wallet_auth_middleware(req: Request, next: Next) -> Result<Response, ApiError> {
    // 1. Extract headers
    let wallet_address = get_header(&req, "x-wallet-address")?;
    let timestamp_str = get_header(&req, "x-timestamp")?;
    let signature_str = get_header(&req, "x-signature")?;

    // 2. Valiadate timestamp - Anti-Replay attack
    let timestamp_ms = timestamp_str.parse::<u64>().map_err(|_| {
        ApiError::default()
            .with_code(StatusCode::BAD_REQUEST)
            .with_message("Invalid timestamp format")
    })?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    if now_ms.abs_diff(timestamp_ms) > TIMESTAMP_TOLERANCE_MS {
        return Err(ApiError::default()
            .with_code(StatusCode::UNAUTHORIZED)
            .with_message("Timestamp is too old or too far in the future"));
    }

    // 3. Read body - must read body because body only can read once
    let method = req.method().to_string();
    let path = req
        .extensions()
        .get::<OriginalUri>()
        .map(|u| u.path().to_string())
        .unwrap_or_default();
    let (parts, body) = req.into_parts();

    let body_bytes = axum::body::to_bytes(body, 10 * 1024 * 1024) // Limit body size to 10MB
        .await
        .map_err(|_| {
            ApiError::default()
                .with_code(StatusCode::BAD_REQUEST)
                .with_message("Failed to read body")
        })?;

    // 4. Hash body
    let body_hash = hex::encode(Sha256::digest(&body_bytes));

    // 5. Construct message: method + path + timestamp + body_hash
    let message = format!("{method}\n{path}\n{timestamp_str}\n{body_hash}");

    tracing::debug!("message to verify: {:?}", message);
    tracing::debug!("wallet: {:?}", wallet_address);
    tracing::debug!("signature: {:?}", signature_str);

    // 6. Verify signature - signature is base58 encoded string of 64 bytes (ed25519 signature)
    verify_signature(&wallet_address, message.as_bytes(), &signature_str).map_err(|_| {
        ApiError::default()
            .with_code(StatusCode::UNAUTHORIZED)
            .with_message("Invalid signature")
    })?;

    // 7. Inject wallet address into request extensions
    //    handler can extract with Extension<WalletAddress>
    let mut req = Request::from_parts(parts, Body::from(body_bytes));
    req.extensions_mut().insert(WalletAddress(wallet_address));

    Ok(next.run(req).await)
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

fn verify_signature(
    wallet_address: &str,
    message: &[u8],
    signature_str: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Decode the wallet address (base58) -> 32 bytes
    let pubkey_bytes: [u8; 32] = bs58::decode(wallet_address)
        .into_vec()?
        .try_into()
        .map_err(|_| "Invalid public key length")?;
    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&pubkey_bytes)?;

    // Decode the signature (base58) -> 64 bytes
    let signature_bytes: [u8; 64] = bs58::decode(signature_str)
        .into_vec()?
        .try_into()
        .map_err(|_| "Invalid signature length")?;
    let signature = ed25519_dalek::Signature::from_bytes(&signature_bytes);

    // Verify the signature
    verifying_key.verify_strict(message, &signature)?;

    Ok(())
}
