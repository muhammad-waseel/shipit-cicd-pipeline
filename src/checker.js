// Checks whether each service is up, with a timeout and a short cache
// so visiting the status page never hammers the apps it watches.

const SLOW_MS = 3000;
// Render's free plan answers with these while a sleeping app is starting up.
const WAKING_STATUSES = new Set([429, 502, 503]);

function classify({ ok, ms, timedOut, status }) {
  if (timedOut) return 'sleeping'; // free Render apps take ~50s to wake up
  if (WAKING_STATUSES.has(status)) return 'sleeping';
  if (!ok) return 'down';
  if (ms > SLOW_MS) return 'slow';
  return 'up';
}

async function checkService(service, { fetchImpl = fetch, timeoutMs = 8000, now = Date.now } = {}) {
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(service.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'shipit-status/1.0' },
      redirect: 'follow',
    });
    const ms = now() - started;
    return { id: service.id, name: service.name, httpStatus: res.status, ms, state: classify({ ok: res.ok, ms, status: res.status }) };
  } catch (err) {
    const ms = now() - started;
    const timedOut = err.name === 'AbortError';
    return { id: service.id, name: service.name, httpStatus: null, ms, state: classify({ ok: false, ms, timedOut }), error: timedOut ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

function createChecker(services, { cacheMs = 60000, now = Date.now, ...options } = {}) {
  let cache = null;
  let inFlight = null;

  async function run() {
    const results = await Promise.all(services.map((s) => checkService(s, { now, ...options })));
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    const merged = services.map((s) => ({ ...s, ...byId[s.id] }));
    const counts = merged.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] || 0) + 1 }), {});
    cache = { checkedAt: new Date(now()).toISOString(), at: now(), services: merged, summary: counts };
    return cache;
  }

  return {
    async getStatus({ force = false } = {}) {
      if (!force && cache && now() - cache.at < cacheMs) return cache;
      if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}

module.exports = { checkService, createChecker, classify, SLOW_MS, WAKING_STATUSES };
