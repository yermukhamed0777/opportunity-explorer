import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createPreviewServer() {
  return createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    try {
      const path = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      if (path.includes('\0')) {
        res.writeHead(400);
        res.end();
        return;
      }
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      res.writeHead(
        error instanceof URIError
          ? 400
          : ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)
            ? 404
            : 500,
      );
      res.end();
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4173);
  createPreviewServer().listen(port, '127.0.0.1', () =>
    console.log('Opportunity Explorer: http://127.0.0.1:' + port),
  );
}
