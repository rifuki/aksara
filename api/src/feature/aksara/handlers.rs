use axum::extract::Extension;

use crate::infrastructure::web::{
    extractor::WalletAddress,
    response::{ApiResult, ApiSuccess},
};

pub async fn hello(Extension(wallet): Extension<WalletAddress>) -> ApiResult<()> {
    Ok(ApiSuccess::default().with_message(format!("Hello, {}!", wallet.0)))
}
