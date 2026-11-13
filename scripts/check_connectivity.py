"""Check the network path to the Gemini host from the backend's own Python (no key is used or read).

Reports, for each phase, the elapsed time and the outcome: DNS, TCP connect, TLS handshake, and one unauthenticated HTTPS
request. The unauthenticated request is expected to fail with HTTP 403 when the host is reachable. Proxy settings are reported
by name only, because their values can contain credentials.

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\check_connectivity.py
"""

from __future__ import annotations

import socket
import ssl
import sys
import time
import urllib.error
import urllib.request

HOST = "generativelanguage.googleapis.com"
URL = f"https://{HOST}/v1beta/models/gemini-3.6-flash"
TIMEOUT = 20.0


def phase(name: str, action):
    started = time.monotonic()
    try:
        result = action()
        print(f"{name:18} ok    {time.monotonic() - started:6.2f} s")
        return result
    except Exception as error:  # diagnostic: report the class only
        print(f"{name:18} FAIL  {time.monotonic() - started:6.2f} s  {type(error).__name__}")
        return None


def main() -> int:
    print(f"python {sys.version.split()[0]} on {sys.platform}")
    proxies = urllib.request.getproxies()
    print("proxy settings:", ", ".join(sorted(proxies)) if proxies else "none detected")
    address = phase("DNS lookup", lambda: socket.getaddrinfo(HOST, 443, type=socket.SOCK_STREAM)[0][4])
    if address is None:
        return 1
    raw = phase("TCP connect", lambda: socket.create_connection((address[0], 443), timeout=TIMEOUT))
    if raw is None:
        return 1
    context = ssl.create_default_context()
    tls = phase("TLS handshake", lambda: context.wrap_socket(raw, server_hostname=HOST))
    if tls is not None:
        tls.close()
    started = time.monotonic()
    try:
        urllib.request.urlopen(urllib.request.Request(URL), timeout=TIMEOUT)  # noqa: S310 - fixed https host
        print(f"{'HTTPS request':18} ok    {time.monotonic() - started:6.2f} s (unexpected without a key)")
    except urllib.error.HTTPError as error:
        print(f"{'HTTPS request':18} HTTP {error.code} {time.monotonic() - started:6.2f} s (host reachable)")
    except Exception as error:
        print(f"{'HTTPS request':18} FAIL  {time.monotonic() - started:6.2f} s  {type(error).__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
