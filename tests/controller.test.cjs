'use strict';
// State, routing and action-wiring tests. This deliberately does not pretend to test browser layout.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '..');
function boot() {
  const elements = new Map(), listeners = {}, windowListeners = {};
  const document = { activeElement: null, title: '', addEventListener: (type, fn) => { listeners[type] = fn; }, getElementById: id => element(id), createElement: tag => new Element('', tag), body: null };
  class Element {
    constructor(id, tag = 'DIV') {
      this.id = id; this.tagName = tag.toUpperCase(); this.attrs = {}; this.dataset = {}; this.value = ''; this._html = ''; this.textContent = ''; this.children = []; this.parentElement = document.body; this.hidden = false; this.inert = false; this.isConnected = true;
      const classes = new Set(); this.classList = { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n), toggle: (n, force) => { const on = force ?? !classes.has(n); on ? classes.add(n) : classes.delete(n); return on; } };
    }
    set innerHTML(value) {
      this._html = value;
      for (const m of value.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)) {
        const input = element(m[1]); input.value = m[0].match(/\bvalue="([^"]*)"/)?.[1] || ''; input.tagName = 'INPUT';
      }
    }
    get innerHTML() { return this._html; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    insertAdjacentHTML(position, html) { this._html = position === 'afterbegin' ? html + this._html : this._html + html; }
    querySelector(selector) {
      const wanted = selector.includes('h2') ? 'h2' : selector.includes('h3') ? 'h3' : selector === 'button' ? 'button' : null;
      if (!wanted || !this._html.includes('<' + wanted)) return null;
      const node = new Element('', wanted); node.textContent = this._html.match(new RegExp('<' + wanted + '[^>]*>([\\s\\S]*?)</' + wanted + '>'))?.[1] || ''; return node;
    }
    querySelectorAll() { return []; }
    focus() { document.activeElement = this; }
    append(child) { this.children.push(child); child.parentElement = this; }
    remove() { this.isConnected = false; }
    click() {}
    getClientRects() { return [{}]; }
  }
  document.body = new Element('body', 'BODY'); document.body.parentElement = null; document.activeElement = document.body;
  function element(id) { if (!elements.has(id)) { const el = new Element(id); elements.set(id, el); document.body.children.push(el); } return elements.get(id); }
  const location = { hash: '' }, entries = []; let historyIndex = -1;
  const history = {
    pushState(state, _, url) { entries.splice(historyIndex + 1); entries.push({ state: structuredClone(state), url }); historyIndex++; location.hash = url; },
    replaceState(state, _, url) { if (historyIndex < 0) { historyIndex = 0; entries.push(null); } entries[historyIndex] = { state: structuredClone(state), url }; location.hash = url; },
    back() { if (historyIndex > 0) { const entry = entries[--historyIndex]; location.hash = entry.url; windowListeners.popstate({ state: structuredClone(entry.state) }); } },
    forward() { if (historyIndex < entries.length - 1) { const entry = entries[++historyIndex]; location.hash = entry.url; windowListeners.popstate({ state: structuredClone(entry.state) }); } }
  };
  const window = { addEventListener: (type, fn) => { windowListeners[type] = fn; } };
  const context = { window, document, history, location, Intl, Date, Number, Math, Set, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: () => 1, clearTimeout() {} };
  vm.createContext(context);
  for (const file of ['model.js', 'icons.js', 'screens.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, { filename: file });
  const app = window.ProtectionApp;
  return { app, model: window.ProtectionModel, screens: window.ProtectionScreens, element, history, entries, listeners, action: (name, dataset = {}) => app.actions[name]({ dataset }) };
}
let passed = 0;
function test(name, body) { body(); passed++; console.log('PASS', name); }
function submit(h, amount) { h.action('newTransfer'); h.element('transfer-amount').value = String(amount); h.action('confirmTransfer'); h.action('submitTransfer'); return h.app.getState().selectedId; }

test('activation follows the existing security/service path and enables on Done only', () => {
  const h = boot(); h.action('security'); h.action('closeProtection'); h.action('protectionSettings');
  assert.equal(h.app.getRoute(), 'how'); assert.equal(h.app.getState().enabled, false);
  h.action('enableIntro'); assert.equal(h.app.getRoute(), 'trust'); h.action('saveTrust');
  assert.equal(h.app.getState().enabled, true); assert.equal(h.app.getRoute(), 'enabled'); h.action('home'); assert.equal(h.app.getRoute(), 'home');
});
test('ordinary bank navigation does not silently enable the optional protection', () => {
  const h = boot(); h.action('payments'); h.action('newTransfer');
  assert.equal(h.app.getState().enabled, false); assert.equal(h.app.getRoute(), 'transferForm');
});
test('new-transfer submit reserves exactly once, including duplicate action and browser Back', () => {
  const h = boot(); h.model.enable(h.app.getState()); submit(h, 300000); const s = h.app.getState();
  assert.equal(h.app.getRoute(), 'pending'); assert.equal(h.model.reserved(s), 300000);
  h.action('submitTransfer'); assert.equal(s.transfers.length, 1);
  h.history.back(); h.action('confirmTransfer'); h.action('submitTransfer'); assert.equal(s.transfers.length, 1); assert.equal(s.balance, 584300);
});
test('invalid and unaffordable form amounts stay on the form without creating transfers', () => {
  const h = boot(); h.action('newTransfer');
  for (const amount of ['', '-1', '0', '1.001', '900000']) {
    h.element('transfer-amount').value = amount; h.action('confirmTransfer'); assert.equal(h.app.getRoute(), 'transferForm'); assert.equal(h.app.getState().transfers.length, 0);
  }
});
test('switching to Anna preserves the same transfer and shared freeze is visible to Galina', () => {
  const h = boot(); h.model.enable(h.app.getState()); const id = submit(h, 300000);
  h.action('guardian'); assert.equal(h.app.getRole(), 'guardian'); h.action('guardianTransfer', { transferId: id }); h.action('freeze');
  assert.equal(h.app.getRoute(), 'guardianFrozen'); h.action('client'); assert.equal(h.app.getRoute(), 'frozen'); assert.equal(h.app.getState().transfers[0].frozenBy, 'guardian');
});
test('guardian disabled permission blocks freeze without affecting the transfer', () => {
  const h = boot(); h.model.enable(h.app.getState()); h.model.setGuardianPermission(h.app.getState(), false); const id = submit(h, 300000);
  h.action('guardian'); h.action('guardianTransfer', { transferId: id }); h.action('freeze');
  assert.equal(h.app.getRoute(), 'guardianPending'); assert.equal(h.app.getState().transfers[0].status, 'pending');
});
test('pending expiry renders the executed result, not a zero-time waiting screen', () => {
  const h = boot(); h.model.enable(h.app.getState()); submit(h, 300000); h.action('advance', { hours: '24' });
  assert.equal(h.app.getRoute(), 'transferDone'); assert.equal(h.app.getState().transfers[0].status, 'executed'); assert.equal(h.app.getState().balance, 284300);
});
test('freeze survives 48h and keeps money reserved while the application remains on frozen result', () => {
  const h = boot(); h.model.enable(h.app.getState()); submit(h, 300000); h.action('freeze'); h.action('advance', { hours: '48' });
  assert.equal(h.app.getRoute(), 'frozen'); assert.equal(h.model.reserved(h.app.getState()), 300000); assert.equal(h.app.getState().balance, 584300);
});
test('bank decision cannot run from a normal transfer screen or from guardian role', () => {
  const h = boot(); h.model.enable(h.app.getState()); const id = submit(h, 300000);
  h.action('bankDecision', { resolution: 'withdraw' }); assert.equal(h.app.getState().transfers[0].status, 'pending');
  h.action('chat'); h.action('guardian'); h.action('guardianTransfer', { transferId: id }); h.action('bankDecision', { resolution: 'withdraw' });
  assert.equal(h.app.getState().transfers[0].status, 'pending');
});
test('recorded bank conversation resolves the selected hold and removes presenter controls afterward', () => {
  const h = boot(); h.model.enable(h.app.getState()); submit(h, 300000); h.action('freeze'); h.action('chat');
  assert.match(h.element('scenario-controls').innerHTML, /data-action="bankDecision"/);
  assert.doesNotMatch(h.element('screen').innerHTML, /data-action="bankDecision"/);
  h.action('bankDecision', { resolution: 'withdraw' }); assert.equal(h.app.getRoute(), 'transferDone'); assert.equal(h.model.reserved(h.app.getState()), 0);
  assert.doesNotMatch(h.element('scenario-controls').innerHTML, /data-action="bankDecision"/);
});
test('48h disable expiry exits the countdown rather than restarting it', () => {
  const h = boot(); h.model.enable(h.app.getState()); h.action('disable'); h.action('requestDisable'); h.action('advance', { hours: '48' });
  assert.equal(h.app.getState().enabled, false); assert.equal(h.app.getRoute(), 'closeProtection');
});
test('guardian disable notification also exits the countdown after expiry', () => {
  const h = boot(); h.model.enable(h.app.getState()); h.action('requestDisable'); h.action('guardianDisable'); h.action('advance', { hours: '48' });
  assert.equal(h.app.getState().enabled, false); assert.notEqual(h.app.getRoute(), 'guardianDisable');
});
test('all rendered action attributes map to a controller action or the explicit switch handler', () => {
  const h = boot(); h.model.enable(h.app.getState()); submit(h, 300000); h.action('requestDisable');
  const s = h.app.getState(), known = new Set([...Object.keys(h.app.actions), 'toggleGuardian']);
  for (const [name, fn] of Object.entries(h.screens)) {
    const r = fn(s, h.app.UI, { role: name.startsWith('guardian') ? 'guardian' : 'client', draft: h.app.getDraft(), transfer: h.model.current(s) });
    for (const m of r.html.matchAll(/data-action="([^"]+)"/g)) assert.ok(known.has(m[1]), `${name}: ${m[1]}`);
  }
});
test('browser history restores selected transfer instead of showing the last viewed transfer', () => {
  const h = boot(); h.model.enable(h.app.getState()); const first = submit(h, 300000); h.action('home'); const second = submit(h, 20000);
  h.action('guardian'); h.action('guardianTransfer', { transferId: first }); h.action('home'); h.action('guardianTransfer', { transferId: second });
  h.history.back(); h.history.back();
  assert.equal(h.app.getRoute(), 'guardianPending'); assert.equal(h.app.getState().selectedId, first);
});
test('browser history restores the matching draft after opening a different recipient', () => {
  const h = boot(); h.model.enable(h.app.getState()); h.action('newTransfer'); h.element('transfer-amount').value = '100000'; h.action('confirmTransfer');
  const firstId = h.app.getDraft().requestId; h.action('home'); h.action('knownTransfer');
  assert.equal(h.app.getDraft().recipientId, 'anna'); h.history.back(); h.history.back();
  assert.equal(h.app.getRoute(), 'transferConfirm'); assert.equal(h.app.getDraft().recipientId, 'sergey');
  assert.equal(h.app.getDraft().amount, 100000); assert.equal(h.app.getDraft().requestId, firstId);
});
test('home top-up entry opens account context without creating an outgoing transfer', () => {
  const h = boot(), html = h.element('screen').innerHTML;
  const action = html.match(/<button\b[^>]*data-action="([^"]+)"[^>]*>(?:(?!<\/button>)[\s\S])*?Пополнить счёт<\/button>/)?.[1];
  assert.ok(action); h.action(action); assert.equal(h.app.getState().transfers.length, 0); assert.equal(h.app.getState().balance, 584300);
});
console.log(`\n${passed} controller regressions passed.`);
