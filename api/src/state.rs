use std::{collections::HashMap, sync::Arc};

use tokio::sync::RwLock;

use crate::{feature::aksara::Message, infrastructure::Config};

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub messages: Arc<RwLock<HashMap<String, Message>>>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
            messages: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn port(&self) -> u16 {
        self.config.server.port
    }
}
