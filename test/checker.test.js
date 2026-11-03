const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkService, createChecker, classify } = require('../src/checker');

const svc = { id: 'demo', name: 'Demo', url: 'https://demo.example/health' };

// A fake clock so timings are predictable.
function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('classify maps responses to states', () => {
  assert.equal(classify({ ok: true, ms: 120 }), 'up');
  assert.equal(classify({ ok: true, ms: 5000 }), 'slow');
  assert.equal(classify({ ok: false, ms: 100 }), 'down');
  assert.equal(classify({ ok: false, ms: 8000, timedOut: true }), 'sleeping');
});

test('a healthy service is reported as up', async () => {
  const c = clock();
  const fetchImpl = async () => { c.advance(150); return { ok: true, status: 200 }; };
  const r = await checkService(svc, { fetchImpl, now: c.now });
  assert.deepEqual(r, { id: 'demo', name: 'Demo', httpStatus: 200, ms: 150, state: 'up' });
});

test('a slow response is reported as slow', async () => {
  const c = clock();
  const fetchImpl = async () => { c.advance(4200); return { ok: true, status: 200 }; };
  const r = await checkService(svc, { fetchImpl, now: c.now });
  assert.equal(r.state, 'slow');
});

test('an HTTP error is reported as down', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  const r = await checkService(svc, { fetchImpl });
  assert.equal(r.state, 'down');
  assert.equal(r.httpStatus, 503);
});

test('a network failure is reported as down and unreachable', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  const r = await checkService(svc, { fetchImpl });
  assert.equal(r.state, 'down');
  assert.equal(r.error, 'unreachable');
});

test('a timeout is reported as sleeping', async () => {
  const fetchImpl = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  const r = await checkService(svc, { fetchImpl, timeoutMs: 20 });
  assert.equal(r.state, 'sleeping');
  assert.equal(r.error, 'timeout');
});

test('the checker caches results and can be forced to refresh', async () => {
  const c = clock();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200 }; };
  const checker = createChecker([svc], { fetchImpl, now: c.now, cacheMs: 60000 });

  await checker.getStatus();
  await checker.getStatus();
  assert.equal(calls, 1, 'second call within the cache window uses the cache');

  c.advance(61000);
  await checker.getStatus();
  assert.equal(calls, 2, 'cache expires after cacheMs');

  await checker.getStatus({ force: true });
  assert.equal(calls, 3, 'force bypasses the cache');
});

test('concurrent requests share one check', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; await new Promise((r) => setTimeout(r, 10)); return { ok: true, status: 200 }; };
  const checker = createChecker([svc], { fetchImpl });
  await Promise.all([checker.getStatus(), checker.getStatus(), checker.getStatus()]);
  assert.equal(calls, 1);
});

test('the summary counts services by state', async () => {
  const services = [
    { id: 'a', name: 'A', url: 'a' },
    { id: 'b', name: 'B', url: 'b' },
    { id: 'c', name: 'C', url: 'c' },
  ];
  const fetchImpl = async (url) => (url === 'c' ? { ok: false, status: 500 } : { ok: true, status: 200 });
  const status = await createChecker(services, { fetchImpl }).getStatus();
  assert.deepEqual(status.summary, { up: 2, down: 1 });
  assert.equal(status.services.length, 3);
  assert.ok(status.checkedAt);
});
