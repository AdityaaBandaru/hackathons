"""The self-ping keep-alive: off unless configured, and harmless when on."""

from __future__ import annotations

import asyncio
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi.testclient import TestClient

from app.keepalive import keep_alive_loop, keep_alive_settings
from app.main import app


def test_off_by_default(monkeypatch):
    monkeypatch.delenv("KEEP_ALIVE_URL", raising=False)
    assert keep_alive_settings() is None
    with TestClient(app) as client:
        assert client.app.state.keep_alive_task is None
        assert client.get("/health").json()["keepAlive"] is False


def test_interval_defaults_and_is_clamped(monkeypatch):
    monkeypatch.setenv("KEEP_ALIVE_URL", "http://example.invalid/health")
    monkeypatch.delenv("KEEP_ALIVE_INTERVAL_SECONDS", raising=False)
    assert keep_alive_settings() == ("http://example.invalid/health", 600.0)
    monkeypatch.setenv("KEEP_ALIVE_INTERVAL_SECONDS", "0")
    assert keep_alive_settings()[1] == 1.0
    monkeypatch.setenv("KEEP_ALIVE_INTERVAL_SECONDS", "nope")
    assert keep_alive_settings()[1] == 600.0


def test_task_starts_with_the_app_and_stops_on_shutdown(monkeypatch):
    monkeypatch.setenv("KEEP_ALIVE_URL", "http://127.0.0.1:9/health")  # nothing listens
    monkeypatch.setenv("KEEP_ALIVE_INTERVAL_SECONDS", "3600")
    with TestClient(app) as client:
        task = client.app.state.keep_alive_task
        assert task is not None and not task.done()
        assert client.get("/health").json()["keepAlive"] is True
    assert task.cancelled() or task.done()


def test_loop_pings_the_url_and_survives_failures():
    """A tiny local server counts the pings; a failing ping does not stop the loop."""
    hits: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            hits.append(self.path)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *_):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/health"

    async def run():
        task = asyncio.create_task(keep_alive_loop(url, 0.05))
        await asyncio.sleep(0.4)
        server.shutdown()  # later pings fail; the loop must keep running
        await asyncio.sleep(0.2)
        assert not task.done()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    assert len(hits) >= 3
    assert all(path == "/health" for path in hits)
