# Dev server cho src/ — như http.server nhưng tắt cache để JS/CSS luôn mới.
# Dùng: python tools/dev_server.py [port]
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory='src')
    print(f'Serving src/ at http://localhost:{port} (cache disabled)')
    ThreadingHTTPServer(('', port), handler).serve_forever()
