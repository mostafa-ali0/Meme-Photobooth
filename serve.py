#!/usr/bin/env python3
"""Lofi Cam Booth - tiny static server.

Camera (getUserMedia) only works on a secure context. localhost counts,
file:// does not. Run this, then open http://localhost:8000.
"""
import http.server
import socketserver
import os
import webbrowser

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"Lofi Cam Booth running at {url}")
        print("Ctrl+C to stop.")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()
