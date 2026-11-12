(function (root) {
  'use strict';

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const START = Date.parse('2026-05-14T14:05:00+03:00');
  const ACTIVE = new Set(['pending', 'frozen']);
  const KINDS = new Set(['phone', 'self', 'card', 'qr']);
  const cents = value => Math.round(Number(value) * 100);
  const rubles = value => Math.round(value) / 100;
  const fail = error => ({ ok: false, error });
  const lookup = (state, id) => state.transfers.find(t => String(t.id) === String(id)) || null;

  function createState() {
    return {
      enabled: false,
      enabledAt: null,
      guardianCanFreeze: true,
      now: START,
      balance: 584300,
      transfers: [],
      selectedId: null,
      disableAt: null,
      disableRequestedAt: null,
      guardianDisableNotified: false,
      knownBefore: Object.freeze(['anna']),
      nextId: 1,
      notifications: []
    };
  }

  function reserved(state) {
    return rubles(state.transfers.reduce((sum, t) => sum + (ACTIVE.has(t.status) ? cents(t.amount) : 0), 0));
  }

  function available(state) {
    return rubles(cents(state.balance) - cents(reserved(state)));
  }

  function current(state) {
    return lookup(state, state.selectedId);
  }

  function execute(state, transfer, executedAt) {
    if (transfer.status !== 'pending') return;
    state.balance = rubles(cents(state.balance) - cents(transfer.amount));
    transfer.status = 'executed';
    transfer.executedAt = executedAt;
  }

  function settle(state) {
    // A frozen transfer remains reserved after its original deadline and after disabling.
    for (const t of state.transfers) {
      if (t.status === 'pending' && t.dueAt <= state.now) execute(state, t, t.dueAt);
    }
    if (state.enabled && state.disableAt !== null && state.now >= state.disableAt) {
      state.enabled = false;
      state.disabledAt = state.disableAt;
      state.disableAt = null;
    }
  }

  function enable(state) {
    settle(state);
    if (state.enabled) return { ok: true };
    // Snapshot previous recipients at enablement; later payments never expand this list.
    const previous = state.transfers
      .filter(t => t.status === 'executed' && t.kind === 'phone' && t.createdAt <= state.now)
      .map(t => t.recipientId);
    state.knownBefore = Object.freeze([...new Set([...state.knownBefore, ...previous])]);
    state.enabled = true;
    state.enabledAt = state.now;
    state.disableAt = null;
    state.disableRequestedAt = null;
    state.guardianDisableNotified = false;
    return { ok: true };
  }

  function setGuardianPermission(state, value) {
    if (typeof value !== 'boolean') return fail('Проверьте настройку доверенного лица.');
    state.guardianCanFreeze = value;
    return { ok: true };
  }

  function classify(state, draft) {
    if (!state.enabled || (state.disableAt !== null && state.now >= state.disableAt)) {
      return { delayed: false, reason: 'unprotected' };
    }
    if (draft.kind === 'self' || draft.recipientId === 'self') return { delayed: false, reason: 'own-accounts' };
    if (draft.kind === 'card') return { delayed: false, reason: 'card-payment' };
    if (draft.kind === 'qr') return { delayed: false, reason: 'qr-payment' };
    if (state.knownBefore.includes(draft.recipientId)) return { delayed: false, reason: 'known-recipient' };
    const repeated = state.transfers.some(t =>
      t.kind === 'phone' && t.recipientId === draft.recipientId &&
      t.createdAt > state.now - DAY && t.createdAt <= state.now
    );
    if (repeated) return { delayed: true, reason: 'repeated-new-recipient' };
    if (draft.amount > 50000) return { delayed: true, reason: 'new-recipient' };
    return { delayed: false, reason: 'within-threshold' };
  }

  function validateDraft(draft) {
    if (!draft || !KINDS.has(draft.kind)) return 'Проверьте перевод.';
    if (typeof draft.amount !== 'number' || !Number.isFinite(draft.amount) || draft.amount <= 0 ||
        !Number.isSafeInteger(cents(draft.amount)) || Math.abs(draft.amount - rubles(cents(draft.amount))) > 1e-8) {
      return 'Проверьте сумму перевода.';
    }
    if (typeof draft.recipientId !== 'string' || !draft.recipientId.trim() ||
        typeof draft.recipientName !== 'string' || !draft.recipientName.trim()) {
      return 'Проверьте получателя.';
    }
    return null;
  }

  function submit(state, draft) {
    const error = validateDraft(draft);
    if (error) return fail(error);
    settle(state);
    // A controller may attach a stable requestId to guard repeated submission of one form.
    if (draft.requestId) {
      const sameRequest = state.transfers.find(t => t.requestId === draft.requestId);
      if (sameRequest) {
        state.selectedId = sameRequest.id;
        return { ok: true, transfer: sameRequest, duplicate: true };
      }
    }
    if (cents(draft.amount) > cents(available(state))) return fail('Недостаточно денег на счёте.');
    const classification = classify(state, draft);
    const isFirst = state.transfers.length === 0;
    const transfer = {
      id: String(state.nextId++),
      amount: rubles(cents(draft.amount)),
      recipientId: draft.recipientId,
      recipientName: draft.recipientName,
      kind: draft.kind,
      bank: draft.bank || 'ВТБ',
      status: classification.delayed ? 'pending' : 'executed',
      createdAt: state.now,
      dueAt: classification.delayed ? state.now + DAY : state.now,
      executedAt: classification.delayed ? null : state.now,
      guardianNotified: classification.delayed,
      frozenBy: null,
      frozenAt: null,
      reason: classification.reason,
      requestId: draft.requestId || null
    };
    state.transfers.push(transfer);
    state.selectedId = transfer.id;
    if (classification.delayed) {
      state.notifications.push({ type: 'transfer', transferId: transfer.id, createdAt: state.now, read: false });
    } else {
      state.balance = rubles(cents(state.balance) - cents(transfer.amount));
    }
    // Presentation clock: the first submitted transfer is opened two minutes later.
    if (isFirst) state.now += 2 * 60 * 1000;
    settle(state);
    return { ok: true, transfer };
  }

  function freeze(state, id, actor) {
    if (actor !== 'client' && actor !== 'guardian') return fail('Заморозить перевод может клиент или доверенное лицо.');
    if (actor === 'guardian' && !state.guardianCanFreeze) return fail('Анна не может заморозить перевод.');
    settle(state);
    const transfer = lookup(state, id);
    if (!transfer) return fail('Перевод не найден.');
    if (transfer.status === 'frozen') return { ok: true, transfer };
    if (transfer.status !== 'pending') return fail('Этот перевод уже не ожидает исполнения.');
    transfer.status = 'frozen';
    transfer.frozenBy = actor;
    transfer.frozenAt = state.now;
    state.selectedId = transfer.id;
    return { ok: true, transfer };
  }

  function requestDisable(state) {
    settle(state);
    if (!state.enabled) return fail('Защита переводов: выключена');
    if (state.disableAt === null) {
      state.disableRequestedAt = state.now;
      state.disableAt = state.now + 48 * HOUR;
      state.guardianDisableNotified = true;
      state.notifications.push({ type: 'disable', createdAt: state.now, disableAt: state.disableAt, read: false });
    }
    return { ok: true, disableAt: state.disableAt };
  }

  function advance(state, hours) {
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || !Number.isSafeInteger(Math.round(state.now + hours * HOUR))) {
      return fail('Проверьте время.');
    }
    state.now = Math.round(state.now + hours * HOUR);
    settle(state);
    return { ok: true };
  }

  function supportResolve(state, id, resolution) {
    if (resolution !== 'withdraw' && resolution !== 'resume') return fail('Решение принимаете вы вместе с сотрудником банка.');
    settle(state);
    const transfer = lookup(state, id);
    if (!transfer) return fail('Перевод не найден.');
    if (resolution === 'withdraw' && transfer.status === 'withdrawn') return { ok: true, transfer };
    if (resolution === 'resume' && transfer.status === 'pending' && transfer.supportResolution === 'resume') return { ok: true, transfer };
    if (!ACTIVE.has(transfer.status) || (resolution === 'resume' && transfer.status !== 'frozen')) {
      return fail('Этот перевод уже не ожидает исполнения.');
    }
    transfer.supportResolution = resolution;
    transfer.supportResolvedAt = state.now;
    transfer.supportConversationRecorded = true;
    if (resolution === 'withdraw') {
      transfer.status = 'withdrawn';
    } else {
      transfer.status = 'pending';
      // Preserve the original deadline. An already due transfer executes after the bank conversation.
      if (transfer.dueAt <= state.now) execute(state, transfer, state.now);
    }
    state.selectedId = transfer.id;
    return { ok: true, transfer };
  }

  const api = { createState, enable, setGuardianPermission, classify, submit, freeze, requestDisable, advance, supportResolve, current, available, reserved };
  root.ProtectionModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
