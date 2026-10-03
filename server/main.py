from collections import deque
import json
import os
from pathlib import Path
import re
import secrets
import time
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import httpx
from pydantic import BaseModel, ConfigDict, Field

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

# Rate limiting sliding window
request_timestamps = deque()
RATE_LIMIT_PER_MINUTE = config.get("rate_limit_per_minute", 30)


def check_rate_limit():
    now = time.time()
    while request_timestamps and request_timestamps[0] < now - 60:
        request_timestamps.popleft()
    if len(request_timestamps) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending another request.",
        )
    request_timestamps.append(now)


def strip_markdown_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


# 2. Pydantic Models (Item 5: extra="forbid", length caps)
class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(..., min_length=1, max_length=config.get("max_prompt_length", 4000))
    expected_format: Optional[str] = Field(default="craving", max_length=50)


class CravingOutputResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1, max_length=1000)


class StatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ollama: str  # "ok" | "unreachable" | "model_missing"
    model: str


# 3. FastAPI Application
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


# API endpoints
@app.get("/api/health", dependencies=[Depends(verify_token)])
async def api_health():
    # Item 7: No personal data or prompts logged
    return {"status": "ok", "service": "tiens-bon"}


@app.get("/api/status", dependencies=[Depends(verify_token)], response_model=StatusResponse)
async def api_status():
    ollama_url = config.get("ollama_url", "http://127.0.0.1:11434")
    model_name = config.get("model_name", "gemma2:2b")

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code != 200:
                return StatusResponse(ollama="unreachable", model=model_name)
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            has_model = any(
                model_name == m
                or m.startswith(f"{model_name}:")
                or model_name.startswith(m.split(":")[0])
                for m in models
            )
            if not has_model:
                return StatusResponse(ollama="model_missing", model=model_name)
            return StatusResponse(ollama="ok", model=model_name)
    except Exception:
        return StatusResponse(ollama="unreachable", model=model_name)


@app.post("/api/generate", dependencies=[Depends(verify_token)], response_model=CravingOutputResponse)
async def api_generate(payload: GenerateRequest):
    check_rate_limit()

    ollama_url = config.get("ollama_url", "http://127.0.0.1:11434")
    model_name = config.get("model_name", "gemma2:2b")

    ollama_payload = {
        "model": model_name,
        "prompt": payload.prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 200,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{ollama_url}/api/generate", json=ollama_payload)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Ollama returned HTTP error status {resp.status_code}",
                )
            result = resp.json()
            raw_response = result.get("response", "")
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to Ollama. Ensure Ollama is running on 127.0.0.1:11434.",
        )

    clean_json_str = strip_markdown_fences(raw_response)
    try:
        parsed_json = json.loads(clean_json_str)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Model output was not valid JSON.",
        )

    try:
        validated = CravingOutputResponse.model_validate(parsed_json)
        return validated
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Model output schema validation failed: {str(e)}",
        )


# Static files serving (dist/)
DIST_DIR = ROOT_DIR / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
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
