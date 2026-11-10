"""A tiny stand-in for the Gemini API, so the real request path can be tested without a key."""
import json, re
from http.server import BaseHTTPRequestHandler, HTTPServer

import os

LOG = os.environ.get("MOCK_LOG") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", "mock-gemini.log")
os.makedirs(os.path.dirname(LOG), exist_ok=True)

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        prompt = body["contents"][0]["parts"][0]["text"]
        text = re.search(r"<user_text>\n(.*?)\n</user_text>", prompt, re.S).group(1)
        model = re.search(r"/models/([^:]+):generateContent", self.path).group(1)
        with open(LOG, "a", encoding="utf-8") as log:
            log.write(json.dumps({"path": self.path, "model": model, "key_header": self.headers.get("x-goog-api-key"),
                                  "key_in_url": "key=" in self.path, "has_system": bool(body.get("systemInstruction")), "text": text}) + "\n")
        reply = {"candidates": [{"content": {"role": "model", "parts": [{"text": "IMPROVED: " + text[:70]}]}, "finishReason": "STOP"}]}
        data = json.dumps(reply).encode()
        self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self, *args): pass

HTTPServer(("127.0.0.1", 8999), Handler).serve_forever()
