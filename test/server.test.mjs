import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createServerApp } from '../server.mjs';

async function withServer(t) {
  const dir = await mkdtemp(join(tmpdir(), 'auction-test-'));
  const app = createServerApp({
    dataFile: join(dir, 'auction.json'),
    adminPassword: 'testpass',
    defaultAuction: {
      title: 'Test Asset',
      description: 'A rentable test asset',
      startingPrice: 100,
      minIncrement: 25,
      deposit: 50,
      rentalPeriod: 'One week',
      startsAt: '2000-01-01T00:00:00.000Z',
      endsAt: '2099-01-01T00:00:00.000Z',
    },
  });
  const server = await app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  return { response, body };
}

function registerPayload(overrides = {}) {
  return {
    name: 'User',
    phone: '13812340000',
    password: '123456',
    securityQuestion: 'my question',
    securityAnswer: 'my answer',
    ...overrides,
  };
}

test('registers, logs in, bids, and masks the public bid history', async (t) => {
  const baseUrl = await withServer(t);

  let result = await requestJson(baseUrl, '/api/register', {
    method: 'POST',
    body: JSON.stringify(registerPayload({ name: 'Zhang San', phone: '13812342468' })),
  });
  assert.equal(result.response.status, 200);

  result = await requestJson(baseUrl, '/api/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13812342468', password: '123456' }),
  });
  assert.equal(result.response.status, 200);

  result = await requestJson(baseUrl, '/api/bids', {
    method: 'POST',
    body: JSON.stringify({ phone: '13812342468', password: '123456', amount: 100 }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.currentPrice, 100);
  assert.equal(result.body.bidHistory[0].phoneLast4, '2468');
  assert.equal(result.body.bidHistory[0].phone, undefined);
});

test('supports password reset by security question', async (t) => {
  const baseUrl = await withServer(t);

  await requestJson(baseUrl, '/api/register', {
    method: 'POST',
    body: JSON.stringify(registerPayload({ name: 'Li Si', phone: '13912348120' })),
  });

  const resetResult = await requestJson(baseUrl, '/api/forgot-password', {
    method: 'POST',
    body: JSON.stringify({
      phone: '13912348120',
      securityAnswer: 'my answer',
      newPassword: '654321',
    }),
  });
  assert.equal(resetResult.response.status, 200);

  const login = await requestJson(baseUrl, '/api/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13912348120', password: '654321' }),
  });
  assert.equal(login.response.status, 200);
});

test('admin state exposes full participant details with the password', async (t) => {
  const baseUrl = await withServer(t);

  await requestJson(baseUrl, '/api/register', {
    method: 'POST',
    body: JSON.stringify(registerPayload({ name: 'Li Si', phone: '13912348120' })),
  });

  await requestJson(baseUrl, '/api/bids', {
    method: 'POST',
    body: JSON.stringify({ phone: '13912348120', password: '123456', amount: 125 }),
  });

  const unauthorized = await requestJson(baseUrl, '/api/admin');
  assert.equal(unauthorized.response.status, 401);

  const authorized = await requestJson(baseUrl, '/api/admin', {
    headers: { 'X-Admin-Password': 'testpass' },
  });
  assert.equal(authorized.response.status, 200);
  assert.equal(authorized.body.participants[0].phone, '13912348120');
  assert.equal(authorized.body.bids[0].phone, '13912348120');
});

test('rejects bids after the configured deadline', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'auction-test-'));
  const app = createServerApp({
    dataFile: join(dir, 'auction.json'),
    adminPassword: 'testpass',
    defaultAuction: {
      title: 'Closed Asset',
      description: 'Closed',
      startingPrice: 100,
      minIncrement: 25,
      deposit: 50,
      rentalPeriod: 'One week',
      startsAt: '1999-01-01T00:00:00.000Z',
      endsAt: '2000-01-01T00:00:00.000Z',
    },
  });
  const server = await app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  await requestJson(baseUrl, '/api/register', {
    method: 'POST',
    body: JSON.stringify(registerPayload({ name: 'Wang Wu', phone: '18600000935' })),
  });

  const result = await requestJson(baseUrl, '/api/bids', {
    method: 'POST',
    body: JSON.stringify({ phone: '18600000935', password: '123456', amount: 100 }),
  });

  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /ended/);
});

test('prevents bidding before the start time while allowing registration', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'auction-test-'));
  const app = createServerApp({
    dataFile: join(dir, 'auction.json'),
    adminPassword: 'testpass',
    defaultAuction: {
      title: 'Future Asset',
      description: 'Not started',
      startingPrice: 100,
      minIncrement: 25,
      deposit: 50,
      rentalPeriod: 'One week',
      startsAt: '2099-01-01T00:00:00.000Z',
      endsAt: '2099-01-02T00:00:00.000Z',
    },
  });
  const server = await app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const registration = await requestJson(baseUrl, '/api/register', {
    method: 'POST',
    body: JSON.stringify(registerPayload({ name: 'Future User', phone: '13700001234' })),
  });
  assert.equal(registration.response.status, 200);

  const bid = await requestJson(baseUrl, '/api/bids', {
    method: 'POST',
    body: JSON.stringify({ phone: '13700001234', password: '123456', amount: 100 }),
  });
  assert.equal(bid.response.status, 400);
  assert.match(bid.body.error, /not started/);

  const publicState = await requestJson(baseUrl, '/api/public');
  assert.equal(publicState.body.isStarted, false);
  assert.equal(publicState.body.canBid, false);
});
