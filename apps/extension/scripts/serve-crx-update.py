#!/usr/bin/env python3
"""Tiny localhost HTTP server for Clarity CRX force_install updates.

Chrome ExtensionSettings force_installed requires an http(s) update_url.
file:// is unreliable / unsupported for updates — this server is the local-dev path.

Serves ~/.clarity/crx-update/ at http://127.0.0.1:8765/
  GET /updates.xml
  GET /clarity.crx

Usage:
  ./serve-crx-update.py            # foreground
  ./serve-crx-update.py --daemon   # background (PID file)
  ./serve-crx-update.py --stop
  ./serve-crx-update.py --status
"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEFAULT_DIR = Path.home() / ".clarity" / "crx-update"
DEFAULT_PORT = int(os.environ.get("CLARITY_CRX_PORT", "8765"))
PID_NAME = "server.pid"


class CrxHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        # Avoid stale CRX/XML after rebuilds.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path: str):  # type: ignore[override]
        if path.endswith(".crx"):
            return "application/x-chrome-extension"
        if path.endswith(".xml"):
            return "application/xml"
        return super().guess_type(path)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def pid_path(root: Path) -> Path:
    return root / PID_NAME


def is_listening(port: int) -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def read_pid(root: Path) -> int | None:
    path = pid_path(root)
    if not path.exists():
        return None
    try:
        return int(path.read_text().strip())
    except ValueError:
        return None


def stop_server(root: Path) -> int:
    pid = read_pid(root)
    if pid is None:
        print("No PID file — nothing to stop.")
        return 0
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"Stopped CRX update server (pid {pid}).")
    except ProcessLookupError:
        print(f"Stale PID {pid} — removing.")
    pid_path(root).unlink(missing_ok=True)
    return 0


def status(root: Path, port: int) -> int:
    pid = read_pid(root)
    listening = is_listening(port)
    print(f"dir:       {root}")
    print(f"port:      {port}")
    print(f"pid file:  {pid if pid is not None else '(none)'}")
    print(f"listening: {'yes' if listening else 'no'}")
    print(f"url:       http://127.0.0.1:{port}/updates.xml")
    return 0 if listening else 1


def run_foreground(root: Path, port: int) -> None:
    root.mkdir(parents=True, exist_ok=True)
    handler = lambda *a, **k: CrxHandler(*a, directory=str(root), **k)  # noqa: E731
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Serving {root} at http://127.0.0.1:{port}/")
    print("  updates.xml → force_installed update_url")
    print("  clarity.crx → CRX download")
    print("Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


def run_daemon(root: Path, port: int) -> int:
    if is_listening(port):
        print(f"Already listening on 127.0.0.1:{port} — OK.")
        return 0

    root.mkdir(parents=True, exist_ok=True)
    log_path = root / "server.log"

    # Double-fork daemon without external deps.
    if os.fork() > 0:
        # Parent waits briefly for child bind.
        for _ in range(20):
            if is_listening(port):
                break
            time.sleep(0.05)
        if is_listening(port):
            print(f"CRX update server running at http://127.0.0.1:{port}/updates.xml")
            return 0
        print("Daemon started but port not listening yet — check server.log", file=sys.stderr)
        return 1

    os.setsid()
    if os.fork() > 0:
        os._exit(0)

    sys.stdout.flush()
    sys.stderr.flush()
    with open(log_path, "a", encoding="utf-8") as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)

    pid_path(root).write_text(str(os.getpid()) + "\n")
    try:
        run_foreground(root, port)
    finally:
        pid_path(root).unlink(missing_ok=True)
    os._exit(0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path(os.environ.get("CLARITY_CRX_DIR", str(DEFAULT_DIR))),
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--daemon", action="store_true")
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()

    if args.stop:
        return stop_server(args.dir)
    if args.status:
        return status(args.dir, args.port)
    if args.daemon:
        return run_daemon(args.dir, args.port)
    run_foreground(args.dir, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
