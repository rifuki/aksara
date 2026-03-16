use std::env;

use eyre::{Result, WrapErr};

fn require_env(key: &str) -> Result<String> {
    env::var(key).wrap_err_with(|| format!("Missing required environment variable: {key}"))
}

fn get_rust_env() -> Result<String> {
    let rust_env = require_env("RUST_ENV")?;
    if cfg!(debug_assertions) && rust_env == "production" {
        eyre::bail!("RUST_ENV cannot be 'production' in debug mode");
    } else if !cfg!(debug_assertions) && rust_env != "production" {
        eyre::bail!("RUST_ENV must be 'production' in release mode");
    } else {
        Ok(rust_env)
    }
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub port: u16,
    pub cors_allowed_origins: Vec<String>,
}

impl ServerConfig {
    fn from_env() -> Result<Self> {
        let port = require_env("PORT")?
            .parse::<u16>()
            .wrap_err("PORT must be a valid u16 integer")?;
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "*".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Self {
            port,
            cors_allowed_origins,
        })
    }
}

#[derive(Debug, Clone)]
pub struct SolanaConfig {
    /// Base58 pubkey of the API owner who issues grants
    pub owner_pubkey: String,
    /// Solana JSON-RPC URL (e.g. devnet or localnet)
    pub rpc_url: String,
    /// Aksara program ID
    pub program_id: String,
}

impl SolanaConfig {
    fn from_env() -> Result<Option<Self>> {
        // OWNER_PUBKEY is the feature flag — absent means dev mode (no on-chain checks).
        let Some(owner_pubkey) = std::env::var("OWNER_PUBKEY").ok() else {
            return Ok(None);
        };

        // Once OWNER_PUBKEY is set, the remaining vars are required.
        let rpc_url = std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
        let program_id = require_env("PROGRAM_ID")?;

        Ok(Some(Self {
            owner_pubkey,
            rpc_url,
            program_id,
        }))
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub rust_env: String,
    pub is_production: bool,
    pub server: ServerConfig,
    /// Optional — on-chain verification skipped if None (dev mode)
    pub solana: Option<SolanaConfig>,
}

impl Config {
    pub fn load() -> Result<Self> {
        let rust_env = get_rust_env()?;
        let is_production = rust_env == "production";

        Ok(Self {
            rust_env,
            is_production,
            server: ServerConfig::from_env()?,
            solana: SolanaConfig::from_env()?,
        })
    }
}
