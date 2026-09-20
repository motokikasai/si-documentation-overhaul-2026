#!/usr/bin/env python3
"""
Serve the prototypes with caching turned OFF.

    python3 articles/build/serve.py [port]      # from projects/schiller-wp-rebuild/

`python3 -m http.server` sends a Last-Modified and nothing else, so a browser
caches the ES modules, the stylesheets and the JSON payloads on 127.0.0.1 and
keeps showing yesterday's draft after an edit. This sends `Cache-Control:
no-store` on everything and answers every conditional request with a fresh 200.
"""
import functools, http.server, os, socketserver, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_header(self, keyword, value):
        if keyword == 'Last-Modified':      # nothing to revalidate against
            return
        super().send_header(keyword, value)

    def log_message(self, fmt, *args):
        if '" 200' not in (fmt % args):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8761
with Server(('127.0.0.1', port), functools.partial(NoCache, directory=ROOT)) as httpd:
    print('serving %s at http://127.0.0.1:%d/articles/  (no-store)' % (ROOT, port))
    httpd.serve_forever()
