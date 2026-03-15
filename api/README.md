# Aksara API

A production-ready REST API built with Rust using Axum framework.

## Features

- **Axum** - Fast, ergonomic web framework
- **Tokio** - Async runtime
- **Structured Logging** - Terminal (colored) + file rotation (daily)
- **HTTP Tracing** - Request/response logging with latency tracking
- **Error Handling** - Consistent API error/success responses
- **CORS** - Configurable origin whitelist
- **Graceful Shutdown** - Handles SIGTERM and Ctrl+C

## Quick Start

### Prerequisites

- Rust 1.70+
- Cargo

### Setup

1. Copy environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```bash
PORT=8080
RUST_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

3. Run the server:
```bash
cargo run
```

The server will start on `http://localhost:8080`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/detail` | GET | Detailed health status with timestamp |

## Project Structure

```
src/
├── main.rs          # Entry point
├── lib.rs           # Module exports
├── state.rs         # Application state
├── routes.rs        # Route definitions
├── feature/         # Business features
│   └── health/      # Health check module
└── infrastructure/  # Shared infrastructure
    ├── config.rs    # Configuration
    ├── logging.rs   # Logging setup
    ├── server.rs    # Server utilities
    └── web/         # Web utilities
        ├── cors.rs
        ├── middleware/
        └── response/
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | - | Server port |
| `RUST_ENV` | Yes | - | `development` or `production` |
| `CORS_ALLOWED_ORIGINS` | No | `*` | Comma-separated allowed origins |

## Development

### Build
```bash
cargo build --release
```

### Run with specific environment
```bash
RUST_ENV=production cargo run
```

## License

MIT
