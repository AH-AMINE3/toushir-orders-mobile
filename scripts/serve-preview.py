#!/usr/bin/env python3
"""Serve the Expo browser preview at /mobile with a same-origin API proxy."""
import argparse,http.server,urllib.request,urllib.error,pathlib
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8086);p.add_argument('--api',default='http://127.0.0.1:5860');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent/'dist'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect)
class Handler(http.server.SimpleHTTPRequestHandler):
 def translate_path(self,path):
  path=path.split('?',1)[0].removeprefix('/mobile').lstrip('/')
  dest=(root/path).resolve()
  if not dest.is_relative_to(root.resolve()):return str(root/'index.html')
  return str(dest if dest.is_file() else root/'index.html')
 def proxy(self):
  body=self.rfile.read(int(self.headers.get('Content-Length',0))) if self.headers.get('Content-Length') else None
  req=urllib.request.Request(a.api+self.path,data=body,method=self.command,headers={k:v for k,v in self.headers.items() if k.lower() not in ['connection','content-length']})
  try:r=opener.open(req,timeout=30)
  except urllib.error.HTTPError as e:r=e
  self.send_response(r.status)
  for k,v in r.headers.items():
   if k.lower() not in ['transfer-encoding','connection']:self.send_header(k,v)
  self.end_headers();self.wfile.write(r.read())
 def do_GET(self):
  if not self.path.startswith('/mobile'):self.proxy()
  else:super().do_GET()
 def do_POST(self):self.proxy()
 def do_PATCH(self):self.proxy()
 def do_PUT(self):self.proxy()
 def do_DELETE(self):self.proxy()
 def log_message(self,*args):pass
print(f'Mobile preview: http://localhost:{a.port}/mobile/merchant and /mobile/driver',flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
