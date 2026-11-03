const LABELS = {
  up: 'Operational',
  slow: 'Slow',
  sleeping: 'Waking up',
  down: 'Down',
};

const HINTS = {
  sleeping: 'Free hosting puts this app to sleep when idle; it wakes up in about a minute.',
  down: 'The service did not respond successfully.',
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

function render(data) {
  const grid = document.getElementById('services');
  grid.replaceChildren(
    ...data.services.map((s) =>
      el('article', { class: `card ${s.state}`, 'data-service': s.id }, [
        el('div', { class: 'card-head' }, [
          el('h3', { text: s.name }),
          el('span', { class: `pill ${s.state}`, text: LABELS[s.state] || s.state }),
        ]),
        el('p', { class: 'muted', text: s.description || '' }),
        el('div', { class: 'stats' }, [
          el('span', { text: s.httpStatus ? `HTTP ${s.httpStatus}` : 'No response' }),
          el('span', { text: `${s.ms} ms` }),
        ]),
        ...(HINTS[s.state] ? [el('p', { class: 'hint', text: HINTS[s.state] })] : []),
        el('a', { href: s.link, target: '_blank', rel: 'noreferrer', text: 'Open ↗' }),
      ])
    )
  );

  const total = data.services.length;
  const up = (data.summary.up || 0) + (data.summary.slow || 0);
  document.getElementById('headline').textContent =
    up === total ? 'All systems operational' : `${up} of ${total} services operational`;
  document.getElementById('checked').textContent = new Date(data.checkedAt).toLocaleTimeString();
  document.getElementById('version').textContent = data.build.version;
  document.getElementById('commit').textContent = String(data.build.commit).slice(0, 7);
}

async function load(force = false) {
  const btn = document.getElementById('refresh');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    const res = await fetch(`/api/status${force ? '?refresh=1' : ''}`);
    render(await res.json());
  } catch {
    document.getElementById('headline').textContent = 'Could not load status';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
  }
}

document.getElementById('refresh').addEventListener('click', () => load(true));
load();
