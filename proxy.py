#!/usr/bin/env python3
"""
Lokálny dev server pre pripoisti-sk (app.html).
- Servuje statické súbory z aktuálneho priečinka
- Passthrough /pillow/* a /bcrm/* → https://api.pripoisti.sk/*
  (obchádza CORS — prod backend povoľuje len Origin https://pripoisti.sk)
Spustenie:  python3 proxy.py   →  http://localhost:8080/app.html
"""
import http.server, urllib.request, urllib.error, ssl, os

TARGET = 'https://api.pripoisti.sk'
PROXY_PREFIXES = ('/pillow/', '/bcrm/')
PORT = int(os.environ.get('PORT', '8091'))

def _ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

class Handler(http.server.SimpleHTTPRequestHandler):
    def _is_proxy(self):
        return any(self.path.startswith(p) for p in PROXY_PREFIXES)

    def do_GET(self):
        if self._is_proxy():
            self._proxy('GET', None)
        else:
            self._no_cache = self.path.endswith('.html') or self.path in ('/', '')
            super().do_GET()

    def do_POST(self):
        if self._is_proxy():
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else None
            self._proxy('POST', body)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, RestUid')
        self.end_headers()

    def _proxy(self, method, body):
        url = TARGET + self.path
        fwd = {}
        for h in ('Content-Type', 'RestUid'):
            v = self.headers.get(h)
            if v:
                fwd[h] = v
        try:
            req = urllib.request.Request(url, data=body, headers=fwd, method=method)
            with urllib.request.urlopen(req, context=_ctx(), timeout=30) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/octet-stream'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'text/plain'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(str(e).encode())

    def send_response(self, code, message=None):
        super().send_response(code, message)
        if getattr(self, '_no_cache', False):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self._no_cache = False

    def log_message(self, fmt, *args):
        print(f'[{self.address_string()}] {fmt % args}')

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f'Server beží na http://localhost:{PORT}/app.html')
print(f'Passthrough: /pillow/* a /bcrm/* → {TARGET}')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
