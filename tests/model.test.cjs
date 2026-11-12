'use strict';
const assert = require('node:assert/strict');
const M = require('../model.js');
let passed = 0;
const draft = overrides => ({ amount: 300000, recipientId: 'sergey', recipientName: 'Сергей В. К.', kind: 'phone', bank: 'ВТБ', ...overrides });
const enabled = () => { const s = M.createState(); M.enable(s); return s; };
function test(name, body) { body(); passed++; console.log('PASS', name); }
function account(s, balance, reserve, available) {
  assert.equal(s.balance, balance); assert.equal(M.reserved(s), reserve); assert.equal(M.available(s), available);
}

test('first protected transfer reserves money and leaves 23h58m at 14:07', () => {
  const s = enabled(), start = s.now, r = M.submit(s, draft());
  assert.equal(r.ok, true); assert.equal(r.transfer.status, 'pending');
  assert.equal(r.transfer.dueAt, start + 24 * 3600000);
  assert.equal(r.transfer.dueAt - s.now, (23 * 60 + 58) * 60000);
  assert.equal(r.transfer.guardianNotified, true); assert.equal(s.notifications.length, 1);
  account(s, 584300, 300000, 284300);
});
test('strict threshold accepts 50000 and delays 50000.01', () => {
  const a = enabled(), b = enabled();
  assert.equal(M.submit(a, draft({ amount: 50000 })).transfer.status, 'executed');
  assert.equal(M.submit(b, draft({ amount: 50000.01 })).transfer.status, 'pending');
});
test('repeat small transfer to a new recipient waits even after a small first transfer', () => {
  const s = enabled(); M.submit(s, draft({ amount: 1000 }));
  const second = M.submit(s, draft({ amount: 1 }));
  assert.equal(second.transfer.status, 'pending'); assert.equal(second.transfer.reason, 'repeated-new-recipient');
  assert.equal(s.knownBefore.includes('sergey'), false);
  account(s, 583300, 1, 583299);
});
test('repeat window excludes a transfer exactly 24 hours old', () => {
  const s = enabled(); M.submit(s, draft({ amount: 1 }));
  M.advance(s, 23 + 58 / 60);
  assert.equal(M.classify(s, draft({ amount: 1 })).delayed, false);
});
test('known recipient, own accounts, card and QR stay immediate above threshold', () => {
  for (const change of [{ recipientId: 'anna' }, { kind: 'self', recipientId: 'self' }, { kind: 'card' }, { kind: 'qr' }]) {
    const s = enabled(), r = M.submit(s, draft(change));
    assert.equal(r.transfer.status, 'executed'); account(s, 284300, 0, 284300);
  }
});
test('disabled protection leaves an ordinary transfer immediate', () => {
  const s = M.createState(); assert.equal(M.submit(s, draft()).transfer.status, 'executed');
});
test('recipients paid before enabling enter an immutable whitelist snapshot', () => {
  const s = M.createState(); M.submit(s, draft({ amount: 100 })); M.enable(s);
  assert.equal(M.classify(s, draft()).reason, 'known-recipient');
  assert.throws(() => s.knownBefore.push('intruder'), TypeError);
});
test('reserved money cannot be spent a second time', () => {
  const s = enabled(); M.submit(s, draft());
  const r = M.submit(s, draft({ amount: 300000, recipientId: 'anna' }));
  assert.equal(r.ok, false); assert.equal(s.transfers.length, 1); account(s, 584300, 300000, 284300);
});
test('pending transfer executes precisely at the deadline and only once', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  M.advance(s, 23 + 57 / 60); assert.equal(t.status, 'pending');
  M.advance(s, 1 / 60); assert.equal(t.status, 'executed'); account(s, 284300, 0, 284300);
  M.advance(s, 100); account(s, 284300, 0, 284300);
});
test('client freeze never expires or changes the account balance', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  assert.equal(M.freeze(s, t.id, 'client').ok, true);
  M.advance(s, 72); assert.equal(t.status, 'frozen'); account(s, 584300, 300000, 284300);
});
test('guardian freeze updates the same transfer and cannot be overwritten by repeated freezes', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  assert.equal(M.freeze(s, t.id, 'guardian').ok, true); assert.equal(M.current(s), t);
  assert.equal(M.freeze(s, t.id, 'client').ok, true); assert.equal(t.frozenBy, 'guardian');
});
test('guardian permission off blocks freeze while preserving notifications', () => {
  const s = enabled(); M.setGuardianPermission(s, false); const t = M.submit(s, draft()).transfer;
  assert.equal(t.guardianNotified, true); assert.equal(M.freeze(s, t.id, 'guardian').ok, false);
  assert.equal(t.status, 'pending'); assert.equal(M.freeze(s, t.id, 'client').ok, true);
});
test('unknown actor cannot freeze and executed transfer cannot be frozen', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  assert.equal(M.freeze(s, t.id, 'bank').ok, false); M.advance(s, 24);
  assert.equal(M.freeze(s, t.id, 'client').ok, false); assert.equal(t.status, 'executed');
});
test('disable request notifies guardian once and cannot shorten or restart 48h delay', () => {
  const s = enabled(); M.requestDisable(s); const deadline = s.disableAt;
  assert.equal(s.guardianDisableNotified, true); M.advance(s, 24); M.requestDisable(s); M.enable(s);
  assert.equal(s.enabled, true); assert.equal(s.disableAt, deadline);
  assert.equal(s.notifications.filter(n => n.type === 'disable').length, 1);
  M.advance(s, 23 + 59 / 60); assert.equal(s.enabled, true);
  M.advance(s, 1 / 60); assert.equal(s.enabled, false); assert.equal(s.disableAt, null);
});
test('disabling never releases frozen reserves or prematurely executes a later hold', () => {
  const s = enabled(); M.requestDisable(s);
  const frozen = M.submit(s, draft()).transfer; M.freeze(s, frozen.id, 'guardian');
  M.advance(s, 47);
  const pending = M.submit(s, draft({ amount: 60000, recipientId: 'new-other' })).transfer;
  M.advance(s, 1); assert.equal(s.enabled, false); assert.equal(frozen.status, 'frozen'); assert.equal(pending.status, 'pending');
  account(s, 584300, 360000, 224300);
});
test('bank conversation can withdraw a frozen transfer and release its reserve', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  M.freeze(s, t.id, 'guardian'); M.advance(s, 26);
  assert.equal(M.supportResolve(s, t.id, 'withdraw').ok, true);
  assert.equal(t.status, 'withdrawn'); assert.equal(t.supportConversationRecorded, true);
  account(s, 584300, 0, 584300); M.advance(s, 48); account(s, 584300, 0, 584300);
});
test('bank conversation can withdraw a still pending transfer', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  M.supportResolve(s, t.id, 'withdraw'); assert.equal(t.status, 'withdrawn'); account(s, 584300, 0, 584300);
});
test('resume before deadline preserves deadline and executes on schedule', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer, due = t.dueAt;
  M.freeze(s, t.id, 'client'); M.advance(s, 2); M.supportResolve(s, t.id, 'resume');
  assert.equal(t.status, 'pending'); assert.equal(t.dueAt, due); M.advance(s, 22);
  assert.equal(t.status, 'executed'); account(s, 284300, 0, 284300);
});
test('resume after deadline executes only after recorded bank conversation', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer;
  M.freeze(s, t.id, 'client'); M.advance(s, 30);
  assert.equal(t.status, 'frozen'); M.supportResolve(s, t.id, 'resume');
  assert.equal(t.status, 'executed'); assert.equal(t.executedAt, s.now); account(s, 284300, 0, 284300);
  assert.equal(M.supportResolve(s, t.id, 'resume').ok, false); account(s, 284300, 0, 284300);
});
test('stable form requestId prevents duplicate reservation', () => {
  const s = enabled(), d = draft({ requestId: 'form-1' }); const first = M.submit(s, d), second = M.submit(s, d);
  assert.equal(second.duplicate, true); assert.equal(second.transfer, first.transfer); assert.equal(s.transfers.length, 1);
  account(s, 584300, 300000, 284300);
});
test('invalid and overprecise amounts do not mutate state', () => {
  for (const amount of [0, -1, NaN, Infinity, '100', 1.001, Number.MAX_SAFE_INTEGER]) {
    const s = enabled(), before = JSON.stringify(s); assert.equal(M.submit(s, draft({ amount })).ok, false); assert.equal(JSON.stringify(s), before);
  }
  const s = enabled(); assert.equal(M.submit(s, draft({ amount: 0.29 })).ok, true); account(s, 584299.71, 0, 584299.71);
});
test('invalid time shifts and unsupported resolution leave frozen transfer intact', () => {
  const s = enabled(), t = M.submit(s, draft()).transfer; M.freeze(s, t.id, 'client');
  const before = JSON.stringify(s);
  for (const h of [-1, NaN, Infinity, '24']) assert.equal(M.advance(s, h).ok, false);
  assert.equal(M.supportResolve(s, t.id, 'cancel').ok, false); assert.equal(JSON.stringify(s), before);
});
console.log(`\n${passed} model regressions passed.`);
