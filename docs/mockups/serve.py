"""Serve the mockup over HTTP with caching disabled.

Plain `python3 -m http.server` sends Last-Modified without Cache-Control, so
browsers heuristically reuse stale ES modules after an edit. Usage:
    python3 docs/mockups/serve.py [port]   ->  http://127.0.0.1:8765/dashboard.html

no-store only affects new responses: after switching from http.server, do one
hard reload (Cmd+Shift+R) or disable cache in DevTools to drop old entries.
"""

import argparse
import functools
import http.server
import pathlib

DEFAULT_PORT = 8765
MIN_PORT = 1
MAX_PORT = 65535


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def port_number(value: str) -> int:
    try:
        port = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an integer: {value!r}") from None
    if not MIN_PORT <= port <= MAX_PORT:
        raise argparse.ArgumentTypeError(
            f"must be between {MIN_PORT} and {MAX_PORT}: {port}"
        )
    return port


def parse_port() -> int:
    parser = argparse.ArgumentParser(description="Serve docs/mockups with no-store.")
    parser.add_argument(
        "port", nargs="?", type=port_number, default=DEFAULT_PORT,
        help=f"port to bind on 127.0.0.1 (default {DEFAULT_PORT})",
    )
    return parser.parse_args().port


def main() -> None:
    port = parse_port()
    root = pathlib.Path(__file__).resolve().parent
    handler = functools.partial(NoStoreHandler, directory=str(root))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        bound_port = server.server_address[1]
        print(
            f"Serving {root} at http://127.0.0.1:{bound_port}/dashboard.html (no-store)",
            flush=True,
        )
        server.serve_forever()


if __name__ == "__main__":
    main()
