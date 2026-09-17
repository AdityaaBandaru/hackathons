"""Self-ping keep-alive for free-tier hosting.

Render's free web services are spun down after ~15 minutes without inbound
requests and take up to a minute to wake -- a bad first impression for anyone
opening the site cold. A request the service makes to its *own public URL*
arrives through the platform's proxy and counts as inbound traffic, so a
periodic self-ping keeps the instance warm.

Off by default: only runs when KEEP_ALIVE_URL is set (render.yaml sets it to
the service's /health URL). Interval via KEEP_ALIVE_INTERVAL_SECONDS
(default 600, i.e. well inside the 15-minute idle window). Failures are
logged and never propagate -- this must not be able to take the API down.
"""

from __future__ import annotations

import asyncio
import logging
import os
import urllib.request

logger = logging.getLogger("app.keepalive")

DEFAULT_INTERVAL_SECONDS = 600
REQUEST_TIMEOUT_SECONDS = 30


def keep_alive_settings() -> tuple[str, float] | None:
    """(url, interval) from the environment, or None when keep-alive is off."""
    url = os.environ.get("KEEP_ALIVE_URL", "").strip()
    if not url:
        return None
    raw = os.environ.get("KEEP_ALIVE_INTERVAL_SECONDS", "").strip()
    try:
        interval = float(raw) if raw else float(DEFAULT_INTERVAL_SECONDS)
    except ValueError:
        logger.warning("ignoring non-numeric KEEP_ALIVE_INTERVAL_SECONDS=%r", raw)
        interval = float(DEFAULT_INTERVAL_SECONDS)
    return url, max(1.0, interval)


def _ping(url: str) -> int:
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:  # noqa: S310 (own URL)
        return int(response.status)


async def keep_alive_loop(url: str, interval: float) -> None:
    """Ping ``url`` every ``interval`` seconds until cancelled."""
    logger.info("keep-alive on: pinging %s every %.0fs", url, interval)
    while True:
        await asyncio.sleep(interval)
        try:
            status = await asyncio.to_thread(_ping, url)
            logger.debug("keep-alive ping -> %s", status)
        except Exception as exc:  # noqa: BLE001 -- never let this kill the app
            logger.warning("keep-alive ping failed: %s", exc)


def start_keep_alive() -> asyncio.Task[None] | None:
    """Start the loop if configured; returns the task so shutdown can cancel it."""
    settings = keep_alive_settings()
    if settings is None:
        return None
    url, interval = settings
    return asyncio.create_task(keep_alive_loop(url, interval), name="keep-alive")
