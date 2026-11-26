const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = Boolean(process.env.DATABASE_URL);

test('readiness endpoint confirms PostgreSQL connectivity', { skip: !enabled }, async () => {
  const { createApp } = require('../dist/app.js');
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health/ready`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'READY');
    assert.equal(body.dependencies.database, 'ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
