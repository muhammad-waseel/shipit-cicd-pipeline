// The live projects ShipIt keeps an eye on.
// Override with SERVICES_JSON='[{"id":"x","name":"X","url":"https://..."}]' if needed.

const DEFAULT_SERVICES = [
  {
    id: 'taskflow',
    name: 'TaskFlow',
    description: 'Full-stack task manager (React, Express, MongoDB)',
    url: 'https://taskflow-waseel-eac0.onrender.com/api/health',
    link: 'https://taskflow-waseel-eac0.onrender.com',
  },
  {
    id: 'shopo-ai',
    name: 'ShopO-AI',
    description: 'AI price comparison and product authenticity (FYP)',
    url: 'https://shopo-ai.onrender.com/api/health',
    link: 'https://shopo-ai.onrender.com',
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Personal portfolio on GitHub Pages',
    url: 'https://muhammad-waseel.github.io/',
    link: 'https://muhammad-waseel.github.io',
  },
];

function loadServices(env = process.env) {
  if (!env.SERVICES_JSON) return DEFAULT_SERVICES;
  const parsed = JSON.parse(env.SERVICES_JSON);
  if (!Array.isArray(parsed)) throw new Error('SERVICES_JSON must be a JSON array');
  return parsed;
}

module.exports = { DEFAULT_SERVICES, loadServices };
