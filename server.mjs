import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAdminState,
  getPublicState,
  getParticipantSecurityQuestion,
  authenticateParticipant,
  resetPassword,
  placeBid,
  registerParticipant,
  updateAuctionSettings,
} from './src/auctionCore.mjs';
import { JsonAuctionStore } from './src/store.mjs';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(rootDir, 'public');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      throw new Error('Request body is too large.');
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function isAuthorized(request, adminPassword) {
  const candidate = (
    request.headers['x-admin-password']
    ?? (typeof request.headers.authorization === 'string'
      ? request.headers.authorization.replace(/^Bearer\s+/i, '')
      : undefined)
    ?? ''
  ).trim();

  return candidate === String(adminPassword).trim();
}

async function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const requested = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, requested);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    await access(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

export function createServerApp(options = {}) {
  const store = new JsonAuctionStore(
    options.dataFile ?? join(rootDir, 'data', 'auction.json'),
    options.defaultAuction
  );
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? 'admin123';

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/api/public') {
        const auction = await store.load();
        sendJson(response, 200, getPublicState(auction));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/register') {
        const body = await readJsonBody(request);
        const auction = await store.update((current) => registerParticipant(current, body));
        sendJson(response, 200, getPublicState(auction));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await readJsonBody(request);
        const auction = await store.load();
        const participant = authenticateParticipant(auction, body);
        sendJson(response, 200, {
          phone: participant.phone,
          name: participant.name,
          securityQuestion: participant.securityQuestion,
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/security-question') {
        const phone = url.searchParams.get('phone');
        const auction = await store.load();
        const securityQuestion = getParticipantSecurityQuestion(auction, phone);
        sendJson(response, 200, { securityQuestion });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/forgot-password') {
        const body = await readJsonBody(request);
        const auction = await store.update((current) => resetPassword(current, body));
        sendJson(response, 200, { ok: true, phone: body.phone });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/bids') {
        const body = await readJsonBody(request);
        const auction = await store.update((current) => placeBid(current, body));
        sendJson(response, 200, getPublicState(auction));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/admin') {
        if (!isAuthorized(request, adminPassword)) {
          sendJson(response, 401, { error: 'Admin password is required.' });
          return;
        }
        const auction = await store.load();
        sendJson(response, 200, getAdminState(auction));
        return;
      }

      if (request.method === 'PUT' && url.pathname === '/api/admin/auction') {
        if (!isAuthorized(request, adminPassword)) {
          sendJson(response, 401, { error: 'Admin password is required.' });
          return;
        }
        const body = await readJsonBody(request);
        const auction = await store.update((current) => updateAuctionSettings(current, body));
        sendJson(response, 200, getAdminState(auction));
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(request, response);
        return;
      }

      sendJson(response, 405, { error: 'Method not allowed.' });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });

  return {
    listen(port = 3000, host = '0.0.0.0') {
      return new Promise((resolve) => {
        server.listen(port, host, () => resolve(server));
      });
    },
    server,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const dataFile = process.env.DATA_FILE ?? join(rootDir, 'data', 'auction.json');
  const app = createServerApp({ dataFile });
  const server = await app.listen(port, host);
  const address = server.address();
  console.log(`Auction site running at http://${address.address}:${address.port}`);
  console.log(`Admin password: ${process.env.ADMIN_PASSWORD ?? 'admin123'}`);
}
