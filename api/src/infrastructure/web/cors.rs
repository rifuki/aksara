use axum::http::{HeaderName, Method, header};
use tower_http::cors::{Any, CorsLayer};

use crate::infrastructure::config::Config;

pub fn build_cors_layer(config: &Config) -> CorsLayer {
    // Handle wildcard (*) or specific origins
    let origins = &config.server.cors_allowed_origins;
    let allow_any_origin = origins.len() == 1 && origins[0] == "*";

    if allow_any_origin {
        // Wildcard with credentials is not allowed by browsers
        // Log warning and use permissive CORS (development only!)
        eprintln!("WARNING: CORS_ALLOWED_ORIGINS='*' with credentials enabled.");
        eprintln!("         This may cause issues in some browsers.");
        eprintln!("         Set specific origin for production (e.g., http://localhost:5173)");
    }

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            // Standard
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            // RFC 9421 HTTP Message Signatures (pipeline order)
            HeaderName::from_static("content-digest"), // 1. hash body
            HeaderName::from_static("signature-input"), // 2. describe what was signed
            HeaderName::from_static("signature"),      // 3. the signature itself
        ])
        // Expose headers that frontend might need to read
        .expose_headers([header::SET_COOKIE, header::CONTENT_TYPE])
        .allow_credentials(true);

    // Apply origin configuration
    if allow_any_origin {
        cors.allow_origin(Any)
    } else {
        let allowed_origins: Vec<axum::http::HeaderValue> = origins
            .iter()
            .map(|o| o.parse().expect("Invalid CORS origin in config"))
            .collect();
        cors.allow_origin(allowed_origins)
    }
}
