import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT || 4317);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8'};
createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad path');return;}
  let file=resolve(root,`.${pathname}`);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  try{
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const body=await readFile(file);
    const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Robots-Tag':'noindex, nofollow','Accept-Ranges':'bytes'};
    // Browsers fetch video in byte ranges, and Safari will not play without them; one range per request is enough here.
    const range=req.method==='GET'?/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||''):null; // HEAD ignores Range (RFC 9110).
    if(range&&(range[1]||range[2])){
      const size=body.length;
      const start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
      const end=range[1]&&range[2]?Math.min(Number(range[2]),size-1):size-1;
      if(start>=size||start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
      res.end(req.method==='HEAD'?undefined:body.subarray(start,end+1));
      return;
    }
    res.writeHead(200,headers);
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Page not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local company preview: http://127.0.0.1:${port}`));
