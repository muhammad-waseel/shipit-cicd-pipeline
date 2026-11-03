const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { loadServices, DEFAULT_SERVICES } = require('../src/services');

const fakeStatus = {
  checkedAt: '2026-11-03T10:00:00.000Z',
  services: [{ id: 'taskflow', name: 'TaskFlow', state: 'up', httpStatus: 200, ms: 120 }],
  summary: { up: 1 },
};

function makeApp(env = {}) {
  const calls = [];
  const checker = { getStatus: async (opts) => { calls.push(opts); return fakeStatus; } };
  const app = createApp({ checker, env: { NODE_ENV: 'test', ...env } });
  return { app, calls };
}

test('GET /api/health reports ok with build info', async () => {
  const { app } = makeApp({ RENDER_GIT_COMMIT: 'abc1234def', RENDER_GIT_BRANCH: 'main' });
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.commit, 'abc1234def');
  assert.equal(res.body.branch, 'main');
  assert.equal(typeof res.body.uptimeSeconds, 'number');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('commit falls back to "local" when not deployed', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/version');
  assert.equal(res.body.commit, 'local');
  assert.match(res.body.version, /^\d+\.\d+\.\d+$/);
});

test('GET /api/status returns checks plus build info', async () => {
  const { app, calls } = makeApp({ GIT_COMMIT: 'cafe123' });
  const res = await request(app).get('/api/status');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.services, fakeStatus.services);
  assert.equal(res.body.build.commit, 'cafe123');
  assert.deepEqual(calls[0], { force: false });
});

test('GET /api/status?refresh=1 forces a fresh check', async () => {
  const { app, calls } = makeApp();
  await request(app).get('/api/status?refresh=1');
  assert.deepEqual(calls[0], { force: true });
});

test('status errors return a clean 500', async () => {
  const checker = { getStatus: async () => { throw new Error('boom'); } };
  const app = createApp({ checker, env: { NODE_ENV: 'test' } });
  const res = await request(app).get('/api/status');
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { message: 'Something went wrong' });
});

test('the status page is served at /', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<title>ShipIt/);
});

test('unknown API routes return 404 JSON', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Not found');
});

test('security headers are set and x-powered-by is hidden', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/health');
  assert.ok(res.headers['content-security-policy']);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('services can be overridden with SERVICES_JSON', () => {
  const custom = [{ id: 'x', name: 'X', url: 'https://x.example' }];
  assert.deepEqual(loadServices({ SERVICES_JSON: JSON.stringify(custom) }), custom);
  assert.equal(loadServices({}), DEFAULT_SERVICES);
  assert.throws(() => loadServices({ SERVICES_JSON: '{"not":"an array"}' }), /must be a JSON array/);
});
