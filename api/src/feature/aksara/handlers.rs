use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};

use crate::{
    AppState,
    feature::aksara::{
        Message,
        model::{CreateMessageRequest, UpdateMessageRequest},
    },
    infrastructure::web::{
        extractor::WalletAddress,
        response::{ApiError, ApiResult, ApiSuccess},
    },
};

// ── Public handlers ───────────────────────────────────────────────────────────

pub async fn list_messages(State(state): State<AppState>) -> ApiResult<Vec<Message>> {
    let messages = state.messages.read().await;
    let mut list = messages.values().cloned().collect::<Vec<Message>>();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(ApiSuccess::default().with_data(list))
}

pub async fn get_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Message> {
    let messages = state.messages.read().await;
    let message = messages.get(&id).cloned().ok_or_else(|| {
        ApiError::default()
            .with_code(StatusCode::NOT_FOUND)
            .with_message("Message not found")
    })?;
    Ok(ApiSuccess::default().with_data(message))
}

// ── Private handlers (wallet auth + on-chain grant required) ──────────────────

pub async fn my_messages(
    State(state): State<AppState>,
    Extension(wallet): Extension<WalletAddress>,
) -> ApiResult<Vec<Message>> {
    let messages = state.messages.read().await;
    let mut list = messages
        .values()
        .filter(|m| m.wallet == wallet.0)
        .cloned()
        .collect::<Vec<Message>>();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(ApiSuccess::default().with_data(list))
}

pub async fn create_message(
    State(state): State<AppState>,
    Extension(wallet): Extension<WalletAddress>,
    Json(payload): Json<CreateMessageRequest>,
) -> ApiResult<Message> {
    let message = Message::new(payload.content, wallet.0);
    let mut messages = state.messages.write().await;
    messages.insert(message.id.clone(), message.clone());
    Ok(ApiSuccess::default()
        .with_code(StatusCode::CREATED)
        .with_data(message))
}

pub async fn update_message(
    State(state): State<AppState>,
    Extension(_wallet): Extension<WalletAddress>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateMessageRequest>,
) -> ApiResult<Message> {
    let mut messages = state.messages.write().await;
    let message = messages.get_mut(&id).ok_or_else(|| {
        ApiError::default()
            .with_code(StatusCode::NOT_FOUND)
            .with_message("Message not found")
    })?;

    message.content = payload.content;
    message.updated_at = chrono::Utc::now().timestamp();
    Ok(ApiSuccess::default().with_data(message.clone()))
}

pub async fn delete_message(
    State(state): State<AppState>,
    Extension(_wallet): Extension<WalletAddress>,
    Path(id): Path<String>,
) -> ApiResult<()> {
    let mut messages = state.messages.write().await;
    if !messages.contains_key(&id) {
        return Err(ApiError::default()
            .with_code(StatusCode::NOT_FOUND)
            .with_message("Message not found"));
    }
    messages.remove(&id);
    Ok(ApiSuccess::default().with_message("Message deleted successfully"))
}
