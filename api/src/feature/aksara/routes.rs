use axum::{Extension, Router, middleware, routing::get};

use crate::{
    AppState, feature::aksara::handlers, infrastructure::web::middleware::wallet_auth_middleware,
};

pub fn aksara_routes(state: &AppState) -> Router<AppState> {
    // ── Public — no auth required ─────────────────────────────────────────────
    let public = Router::new()
        .route("/owner", get(handlers::get_owner))
        .route("/messages", get(handlers::list_messages))
        .route("/messages/{id}", get(handlers::get_message));

    // ── Sig-only — wallet signature required, no on-chain grant check ─────────
    // Siapa saja yang punya wallet bisa posting
    let sig_only = Router::new()
        .route("/messages", axum::routing::post(handlers::create_message))
        .layer(middleware::from_fn(wallet_auth_middleware));

    // ── Admin — wallet signature + on-chain grant required ────────────────────
    // Butuh grant dari owner untuk manage pesan sendiri
    let mut admin = Router::new()
        .route("/messages/mine", get(handlers::my_messages))
        .route(
            "/messages/{id}",
            axum::routing::put(handlers::update_message).delete(handlers::delete_message),
        )
        .layer(middleware::from_fn(wallet_auth_middleware));

    if let Some(ref solana) = state.config.solana {
        admin = admin.layer(Extension(solana.clone()));
    }

    Router::new().merge(public).merge(sig_only).merge(admin)
}
