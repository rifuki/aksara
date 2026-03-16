use axum::{Router, middleware, routing::get};

use crate::{
    AppState, feature::aksara::handlers, infrastructure::web::middleware::wallet_auth_middleware,
};

pub fn aksara_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::hello))
        .layer(middleware::from_fn(wallet_auth_middleware))
}
