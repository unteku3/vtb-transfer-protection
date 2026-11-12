'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../model.js');
const base = path.resolve(__dirname, '..');
const context = { window: { ProtectionModel: M }, Intl, Date, Number, Math };
vm.createContext(context);
for (const file of ['icons.js', 'screens.js']) vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context, { filename: file });
const screens = context.window.ProtectionScreens;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const UI = {
  icon: context.window.ProtectionIcon,
  escape,
  money: value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' ₽',
  button: (label, action, kind = 'primary', attrs = '') => `<button class="button button-${kind}" data-action="${action}" ${attrs}>${label}</button>`,
  link: (label, action, attrs = '') => `<button class="text-link" data-action="${action}" ${attrs}>${label}</button>`,
  row: (title, sub, action, symbol = 'chevron') => `<button data-action="${action}">${context.window.ProtectionIcon(symbol)}<strong>${title}</strong><span>${sub}</span></button>`,
  badge: (text, kind) => `<span class="badge badge-${kind}">${text}</span>`,
  card: (html, classes = '') => `<section class="card ${classes}">${html}</section>`,
  note: (html, kind = 'neutral', symbol = 'info') => `<div class="note note-${kind}">${context.window.ProtectionIcon(symbol)}<p>${html}</p></div>`
};
const draft = values => ({ amount: 300000, recipientId: 'sergey', recipientName: 'Сергей В. К.', kind: 'phone', bank: 'ВТБ', ...values });
const state = () => { const s = M.createState(); M.enable(s); return s; };
const render = (name, s, values = {}) => screens[name](s, UI, { role: name.startsWith('guardian') ? 'guardian' : 'client', draft: draft(), transfer: M.current(s), ...values });
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0|\u202f/g, ' ');
const actions = html => [...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const buttons = html => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => plain(m[1]).trim());
let passed = 0;
function test(name, body) { body(); passed++; console.log('PASS', name); }
function containsAll(text, list) { for (const copy of list) assert.ok(text.includes(copy), `Missing approved copy: ${copy}`); }

test('every protected-flow screen renders nonempty Russian content with finite values', () => {
  const s = state(); M.submit(s, draft()); M.requestDisable(s);
  for (const name of Object.keys(screens)) {
    const output = render(name, s);
    assert.ok(output.title && /[А-Яа-я]/.test(output.title), name);
    assert.ok(output.html.length > 40, name);
    assert.ok(!/undefined|NaN|Invalid Date/.test(output.html), name);
  }
});
test('three activation explanations retain the exact approved copy', () => {
  containsAll(plain(render('how', state()).html), [
    'Перевод незнакомому получателю больше 50 000 ₽ исполнится через 24 часа.',
    'Пока перевод ждёт, деньги остаются на вашем счёте.',
    'Если сомневаетесь, нажмите «Заморозить» или «Позвать поддержку». Банк свяжется с вами и поможет разобраться.'
  ]);
});
test('activation includes all four exceptions and the delayed-disable explanation', () => {
  const html = render('how', state()).html;
  containsAll(plain(html), ['Без задержки', 'Переводы между своими счетами', 'Переводы тем, кому вы уже переводили', 'Переводы до 50 000 ₽', 'Оплата в магазинах картой и по QR-коду', 'Отключить защиту можно только через 48 часов. Так мошенник не сможет уговорить вас отключить её и сразу перевести деньги.']);
  assert.ok(actions(html).includes('enableIntro')); assert.ok(buttons(html).includes('Включить защиту'));
});
test('trusted-person screen has Anna identity, masked phone, and client label', () => {
  const r = render('trust', state());
  assert.equal(r.title, 'Кто поможет остановить перевод');
  containsAll(plain(r.html), ['Анна П., дочь', '+7 9•• •••-45-17', 'Клиент ВТБ', 'Выбрать другое доверенное лицо', 'Готово']);
});
test('guardian permission switch follows actual state and has an accessible name', () => {
  const s = state(); const before = render('trust', s).html;
  assert.match(before, /role="switch"[^>]*aria-label="Анна может заморозить подозрительный перевод из своего приложения"[^>]* checked/);
  M.setGuardianPermission(s, false); assert.doesNotMatch(render('trust', s).html, /\schecked(?:\s|>)/);
});
test('trusted-person screen preserves the restriction on cancellation', () => {
  const html = render('trust', state()).html;
  assert.ok(plain(html).includes('Отменить перевод Анна не может. Она только останавливает его, а решение принимаете вы вместе с сотрудником банка.'));
  assert.ok(!buttons(html).some(text => /отменить|отозвать|разморозить/i.test(text)));
});
test('enabled screen has the exact approved summary and home action', () => {
  const html = render('enabled', state()).html;
  containsAll(plain(html), ['Защита переводов включена', 'Порог: 50 000 ₽ · Задержка: 24 часа · Доверенное лицо: Анна П.']);
  assert.deepEqual(actions(html), ['home']);
});
test('new-recipient confirmation shows both exact alerts and the delayed CTA', () => {
  const r = render('transferConfirm', state());
  containsAll(plain(r.html), ['Сергей В. К.', '300 000 ₽', 'Банк получателя', 'Получатель новый. Перевод будет исполнен завтра в 14:05. До этого деньги останутся на вашем счёте.', 'Сотрудники банков и Банка России никогда не просят переводить деньги на «безопасный счёт». Если вам так сказали, это мошенник.']);
  assert.ok(buttons(r.html).includes('Перевести завтра в 14:05'));
});
test('repeat confirmation explains the any-amount rule and uses the new deadline', () => {
  const s = state(); M.submit(s, draft({ amount: 50000 }));
  const r = render('transferConfirm', s, { draft: draft({ amount: 100 }) });
  assert.ok(plain(r.html).includes('Второй и следующие переводы тому же новому получателю в течение суток тоже ждут 24 часа при любой сумме.'));
  assert.ok(buttons(r.html).includes('Перевести завтра в 14:07'));
});
test('first transfer exactly 50000 uses an immediate CTA without orange delay promise', () => {
  const html = render('transferConfirm', state(), { draft: draft({ amount: 50000 }) }).html;
  assert.ok(buttons(html).includes('Перевести')); assert.doesNotMatch(html, /note-warning/);
});
test('all four exceptions stay immediate in rendered confirmation', () => {
  for (const change of [{ recipientId: 'anna' }, { kind: 'self', recipientId: 'self' }, { kind: 'card' }, { kind: 'qr' }]) {
    const html = render('transferConfirm', state(), { draft: draft(change) }).html;
    assert.ok(buttons(html).includes('Перевести')); assert.doesNotMatch(html, /note-warning/);
  }
});
test('pending screen uses the real held transfer and exact 23h58m copy', () => {
  const s = state(); M.submit(s, draft()); const r = render('pending', s);
  assert.equal(r.title, 'Перевод ожидает исполнения');
  containsAll(plain(r.html), ['300 000 ₽', 'Сергей В. К.', 'Ожидает исполнения', 'Будет исполнен через 23 ч 58 мин (завтра в 14:05)', 'Деньги в резерве на вашем счёте', 'Анна П. получила уведомление']);
});
test('pending actions offer freeze and support with no direct cancellation', () => {
  const s = state(); M.submit(s, draft()); const html = render('pending', s).html;
  assert.ok(buttons(html).includes('Заморозить')); assert.ok(buttons(html).includes('Позвать поддержку'));
  assert.ok(!buttons(html).some(text => /отменить|отозвать|разморозить/i.test(text)));
  assert.ok(plain(html).includes('Отменить перевод можно только вместе с сотрудником банка.'));
});
test('receipt distinguishes a delayed payment from an executed payment', () => {
  const s = state(); M.submit(s, draft()); const html = render('receipt', s).html;
  containsAll(plain(html), ['ОТЛОЖЕННЫЙ ПЕРЕВОД', 'Будет исполнен 15 мая в 14:05. До этого времени может быть заморожен или отозван.', '300 000 ₽', 'Сергей В. К.', 'Галина Петровна']);
  assert.deepEqual(actions(html), ['shareReceipt']);
});
test('receipt date follows the actual transfer instead of remaining hardcoded', () => {
  const s = state(); M.advance(s, 24); M.submit(s, draft());
  assert.ok(plain(render('receipt', s).html).includes('Будет исполнен 16 мая в 14:05.'));
});
test('frozen screen has the exact safety text and two bank contact actions', () => {
  const s = state(), t = M.submit(s, draft()).transfer; M.freeze(s, t.id, 'client'); const html = render('frozen', s).html;
  containsAll(plain(html), ['Перевод заморожен', 'Перевод не будет исполнен, пока вы не поговорите с сотрудником банка. Деньги в безопасности на вашем счёте.', 'Сотрудник банка позвонит вам в течение 2 часов.', 'Сотрудник банка никогда не спрашивает коды из СМС.']);
  assert.deepEqual(actions(html), ['call', 'chat']);
});
test('guardian sees every delayed transfer, with independent selection IDs', () => {
  const s = state(); const first = M.submit(s, draft()).transfer; const second = M.submit(s, draft({ amount: 1000 })).transfer;
  const html = render('guardianHome', s).html;
  assert.equal(actions(html).filter(a => a === 'guardianTransfer').length, 2);
  assert.ok(html.includes(`data-transfer-id="${first.id}"`)); assert.ok(html.includes(`data-transfer-id="${second.id}"`));
});
test('guardian does not receive ordinary immediate payments as delayed notifications', () => {
  const s = state(); M.submit(s, draft({ amount: 1000 }));
  assert.ok(!actions(render('guardianHome', s).html).includes('guardianTransfer'));
});
test('guardian notification status updates when one transfer is frozen', () => {
  const s = state(), first = M.submit(s, draft()).transfer; M.submit(s, draft({ amount: 1000 })); M.freeze(s, first.id, 'client');
  const html = render('guardianHome', s).html;
  containsAll(plain(html), ['Перевод заморожен', 'Перевод ожидает исполнения']);
});
test('guardian view targets a selected transfer rather than silently using the latest', () => {
  const s = state(), first = M.submit(s, draft()).transfer; M.submit(s, draft({ amount: 1000 }));
  const html = render('guardianPending', s, { transfer: first }).html;
  assert.ok(plain(html).includes('300 000 ₽')); assert.ok(!plain(html).includes('1 000 ₽'));
});
test('guardian freeze permission controls the visible freeze action', () => {
  const s = state(); M.submit(s, draft());
  assert.ok(actions(render('guardianPending', s).html).includes('freeze'));
  M.setGuardianPermission(s, false); assert.ok(!actions(render('guardianPending', s).html).includes('freeze'));
});
test('guardian has no withdraw, resume, or bank-resolution controls on any screen', () => {
  const s = state(); M.submit(s, draft()); M.requestDisable(s);
  for (const name of Object.keys(screens).filter(n => n.startsWith('guardian'))) {
    const html = render(name, s).html;
    assert.ok(!actions(html).some(action => /withdraw|resume|resolve|cancel/i.test(action)), name);
    assert.ok(!buttons(html).some(text => /отменить|отозвать|разморозить/i.test(text)), name);
  }
});
test('guardian pending view switches to frozen screen after either actor freezes it', () => {
  for (const actor of ['client', 'guardian']) {
    const s = state(), t = M.submit(s, draft()).transfer; M.freeze(s, t.id, actor);
    const r = render('guardianPending', s); assert.equal(r.title, 'Перевод заморожен'); assert.ok(!actions(r.html).includes('freeze'));
  }
});
test('disable request shows a live 48h countdown and notification to Anna', () => {
  const s = state(); M.requestDisable(s);
  containsAll(plain(render('disablePending', s).html), ['48 ч 00 мин', 'Анна П. получила уведомление']);
  M.advance(s, 1); assert.ok(plain(render('disablePending', s).html).includes('47 ч 00 мин'));
  assert.ok(actions(render('guardianHome', s).html).includes('guardianDisable'));
});
test('new recipient names and banks are escaped before rendering', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const html = render('transferConfirm', state(), { draft: draft({ recipientName: malicious, bank: malicious }) }).html;
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img'));
});
test('no screen contains a standalone cancel button', () => {
  const s = state(); M.submit(s, draft()); M.requestDisable(s);
  for (const name of Object.keys(screens)) {
    assert.ok(!buttons(render(name, s).html).some(text => /^(Отменить|Отозвать|Разморозить)( перевод)?$/i.test(text)), name);
  }
});
console.log(`\n${passed} model + screen integration checks passed.`);
