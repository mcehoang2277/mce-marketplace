const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { verifySePaySignature } = require('../dist/modules/payments/sepay-signature.js');

const secret = 'sepay-test-secret-that-is-longer-than-thirty-two-characters';
const timestamp = '1795610000';
const now = 1795610000;
const body = Buffer.from('{"id":123,"transferType":"in","transferAmount":100000}');

function signatureFor(payload = body, time = timestamp) {
  return 'sha256=' + createHmac('sha256', secret).update(time + '.').update(payload).digest('hex');
}

test('accepts a valid SePay HMAC over timestamp and exact raw body', () => {
  assert.equal(verifySePaySignature(secret, timestamp, signatureFor(), body, now), true);
});

test('rejects a modified raw body', () => {
  const modified = Buffer.from(body.toString() + ' ');
  assert.equal(verifySePaySignature(secret, timestamp, signatureFor(), modified, now), false);
});

test('rejects stale timestamps', () => {
  assert.equal(verifySePaySignature(secret, timestamp, signatureFor(), body, now + 301), false);
});

test('rejects short secrets and malformed signatures', () => {
  assert.equal(verifySePaySignature('short-secret', timestamp, signatureFor(), body, now), false);
  assert.equal(verifySePaySignature(secret, timestamp, 'not-a-signature', body, now), false);
});
