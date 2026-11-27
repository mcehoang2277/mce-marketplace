const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('auth page does not expose demo credentials or simulated identity verification', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'auth.html'), 'utf8');

  for (const forbidden of [
    '889966',
    '123456',
    '0981234567',
    'nguyenvanan.mce@gmail.com',
    '99.4%',
    '99.1%',
    'CSDL Quốc Gia Xác Thực',
    'MCE Passport ID',
    'Kích Hoạt Tài Khoản Thành Công'
  ]) {
    assert.equal(html.includes(forbidden), false, `auth.html must not contain demo value: ${forbidden}`);
  }

  assert.match(html, /eKYC chưa khả dụng/);
  assert.match(html, /Đăng ký tạm thời chưa khả dụng/);

  const webhook = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'payments', 'payment-webhook.controller.ts'), 'utf8');
  assert.equal(webhook.includes('simulateWebhook'), false);
  assert.equal(webhook.includes('SIM-TX-'), false);
});
