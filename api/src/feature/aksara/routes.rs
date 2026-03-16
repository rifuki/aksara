use axum::{Router, middleware, routing::get};

use crate::{
    AppState, feature::aksara::handlers, infrastructure::web::middleware::wallet_auth_middleware,
};

pub fn aksara_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/messages",
            get(handlers::list_messages).post(handlers::create_message),
        )
        .route("/messages/mine", get(handlers::my_messages))
        .route(
            "/messages/{id}",
            get(handlers::get_message)
                .put(handlers::update_message)
                .delete(handlers::delete_message),
        )
        .layer(middleware::from_fn(wallet_auth_middleware))
}
