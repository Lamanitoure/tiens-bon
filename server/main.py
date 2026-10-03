import json
import os
from pathlib import Path
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# 1. Environment & configuration
ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "server" / "config.json"
EXAMPLE_CONFIG_PATH = ROOT_DIR / "server" / "config.example.json"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    if EXAMPLE_CONFIG_PATH.exists():
        with open(EXAMPLE_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "ollama_url": "http://127.0.0.1:11434",
        "model_name": "gemma2:2b",
        "server_port": 8000,
        "server_host": "127.0.0.1",
        "max_prompt_length": 4000,
        "rate_limit_per_minute": 30,
    }


def validate_host(host: str, allow_non_loopback: bool = False) -> None:
    """Item 1: The server is never exposed to the public internet. It listens on 127.0.0.1 only."""
    loopback_hosts = {"127.0.0.1", "localhost", "::1"}
    if host not in loopback_hosts and not allow_non_loopback:
        raise ValueError(
            f"Security error: Refusing to bind to non-loopback host '{host}'. "
            "Server must listen on 127.0.0.1 only. Set ALLOW_NON_LOOPBACK=1 only if strictly intentional."
        )


config = load_config()
SERVER_HOST = os.environ.get("SERVER_HOST", config.get("server_host", "127.0.0.1"))
ALLOW_NON_LOOPBACK = os.environ.get("ALLOW_NON_LOOPBACK", "0") == "1"

# Validate host on module initialization
validate_host(SERVER_HOST, ALLOW_NON_LOOPBACK)

ACCESS_TOKEN = os.environ.get("ACCESS_TOKEN", "")


# 2. FastAPI Application
app = FastAPI(
    title="Tiens Bon Local Server",
    description="Stateless proxy and push coordinator for Tiens Bon companion",
    version="0.1.0",
    docs_url=None,  # No swagger docs exposed in production
    redoc_url=None,
)


# Item 8: Security Headers Middleware on every single response
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    # Content-Security-Policy (Section 5, Item 8)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' blob: data:; "
        "connect-src 'self'; "
        "worker-src 'self'; "
        "manifest-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'none'; "
        "form-action 'self';"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-Frame-Options"] = "DENY"
    return response


# Item 4: Bearer Token verification dependency for /api routes
async def verify_token(request: Request):
    expected_token = os.environ.get("ACCESS_TOKEN", "").strip()
    if not expected_token:
        # If token is not configured in .env, reject for security
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Server ACCESS_TOKEN is not configured in environment.",
        )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected Bearer token.",
        )

    provided_token = auth_header[7:].strip()
    # Constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(provided_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        )


# Protected API endpoint
@app.get("/api/health", dependencies=[Depends(verify_token)])
async def api_health():
    # Item 7: No personal data or prompts logged
    return {"status": "ok", "service": "tiens-bon"}


# Static files serving (dist/)
DIST_DIR = ROOT_DIR / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept /api routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # SPA fallback
        index_file = DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return HTMLResponse("<h1>Tiens Bon</h1><p>Building...</p>")
else:
    @app.get("/")
    async def root_placeholder():
        return HTMLResponse(
            "<!doctype html><html><body style='font-family:sans-serif;padding:2rem;'>"
            "<h1>Tiens Bon Server</h1>"
            "<p>The web app has not been built yet. Run <code>pnpm build</code> first.</p>"
            "</body></html>"
        )


def start():
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host=SERVER_HOST,
        port=config.get("server_port", 8000),
        reload=False,
    )


if __name__ == "__main__":
    start()
