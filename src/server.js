const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const server = createApp().listen(PORT, () => {
  console.log(`ShipIt listening on port ${PORT}`);
});

// Shut down cleanly when the platform stops the container.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
