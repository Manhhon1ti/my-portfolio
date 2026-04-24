import http.server
import socketserver

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

class CustomHandler(Handler):
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/about-creative-dark.html'
        return super().do_GET()

try:
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Localhost is running at: http://localhost:{PORT}")
        print("Serving about-creative-dark.html as the homepage.")
        httpd.serve_forever()
except OSError as e:
    print(f"Port {PORT} might be in use. Trying port 8080...")
    PORT = 8080
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Localhost is running at: http://localhost:{PORT}")
        print("Serving about-creative-dark.html as the homepage.")
        httpd.serve_forever()
