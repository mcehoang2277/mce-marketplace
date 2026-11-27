const test = require('node:test');
const assert = require('node:assert/strict');
const { VIETNAM_BANKS, searchVietnamBanks, findVietnamBank } = require('../dist/modules/payments/vietnam-banks.js');

test('vietnam bank directory exposes NAPAS banks and supports accent-insensitive search', () => {
  assert.ok(VIETNAM_BANKS.length >= 35);

  const byAlias = searchVietnamBanks('quan doi');
  assert.ok(byAlias.some((bank) => bank.code === 'MB' && bank.bin === '970422'));

  const byBin = findVietnamBank('970436');
  assert.equal(byBin?.shortName, 'Vietcombank');

  const byShort = findVietnamBank('Techcombank');
  assert.equal(byShort?.code, 'TCB');
});
