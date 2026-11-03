const path = require('path');
const express = require('express');
const helmet = require('helmet');
const pkg = require('../package.json');
const { createChecker } = require('./checker');
const { loadServices } = require('./services');

function buildInfo(env = process.env) {
  return {
    version: pkg.version,
    commit: env.RENDER_GIT_COMMIT || env.GIT_COMMIT || 'local',
    branch: env.RENDER_GIT_BRANCH || env.GIT_BRANCH || 'local',
    startedAt: new Date().toISOString(),
  };
}

function createApp({ checker, env = process.env } = {}) {
  const app = express();
  const info = buildInfo(env);
  const statusChecker = checker || createChecker(loadServices(env));

  app.disable('x-powered-by');
  app.use(helmet());

  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', ...info, uptimeSeconds: Math.round(process.uptime()) });
  });

  app.get('/api/version', (req, res) => {
    res.json({ version: info.version, commit: info.commit });
  });

  app.get('/api/status', async (req, res, next) => {
    try {
      const status = await statusChecker.getStatus({ force: req.query.refresh === '1' });
      res.set('Cache-Control', 'no-store');
      res.json({ ...status, build: { version: info.version, commit: info.commit } });
    } catch (err) {
      next(err);
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m' }));

  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  });

  return app;
}

module.exports = { createApp, buildInfo };
