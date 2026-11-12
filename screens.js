(function () {
  'use strict';

  const MS_HOUR = 3600000;
  const MS_DAY = 24 * MS_HOUR;
  const DEFAULT_DATE = new Date('2026-05-14T14:05:00+03:00').getTime();
  const copy = {
    disable: 'Отключить защиту можно только через 48 часов. Так мошенник не сможет уговорить вас отключить её и сразу перевести деньги.',
    guardian: 'Анна может заморозить подозрительный перевод из своего приложения',
    guardianLimit: 'Отменить перевод Анна не может. Она только останавливает его, а решение принимаете вы вместе с сотрудником банка.',
    warning: 'Сотрудники банков и Банка России никогда не просят переводить деньги на «безопасный счёт». Если вам так сказали, это мошенник.',
    frozen: 'Перевод не будет исполнен, пока вы не поговорите с сотрудником банка. Деньги в безопасности на вашем счёте.',
    bankOnly: 'Отозвать или разморозить перевод можно только в разговоре с сотрудником банка (по телефону или в чате), разговор записывается.'
  };

  function now(state) { return Number.isFinite(state.now) ? state.now : DEFAULT_DATE; }
  function transfer(state, view) {
    return view.transfer || {
      id: null, amount: 300000, recipientId: 'sergey', recipientName: 'Сергей В. К.', bank: 'ВТБ',
      kind: 'phone', status: 'pending', createdAt: DEFAULT_DATE, dueAt: DEFAULT_DATE + MS_DAY,
      guardianNotified: true, frozenBy: null
    };
  }
  function time(value) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value); }
  function day(value) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(value); }
  function dayKey(value) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); }
  function when(value, state) {
    if (dayKey(value) === dayKey(now(state) + MS_DAY)) return 'завтра в ' + time(value);
    if (dayKey(value) === dayKey(now(state))) return 'сегодня в ' + time(value);
    return day(value) + ' в ' + time(value);
  }
  function countdown(value, state) {
    const minutes = Math.max(0, Math.ceil((value - now(state)) / 60000));
    return Math.floor(minutes / 60) + ' ч ' + String(minutes % 60).padStart(2, '0') + ' мин';
  }
  function anna(UI) {
    return '<div class="identity"><span class="avatar avatar-anna" aria-hidden="true">АП</span><div><strong>Анна П., дочь</strong><p class="muted small">+7 9•• •••-45-17</p>' + UI.badge('Клиент ВТБ', 'success') + '</div></div>';
  }
  function person(UI, t, guardian) {
    return '<div class="transfer-identity"><span class="avatar" aria-hidden="true">' + (guardian ? 'ГП' : 'СВ') + '</span><div><strong>' + (guardian ? 'Галина Петровна' : UI.escape(t.recipientName)) + '</strong>' + (guardian ? '<p class="muted small">' + UI.escape(t.recipientName) + '</p>' : '<p class="muted small">' + UI.escape(t.bank || 'ВТБ') + '</p>') + '</div></div>';
  }
  function amount(UI, t) { return '<div class="hero-amount">' + UI.money(t.amount) + '</div>'; }
  function freezeButton(UI, disabled) {
    return '<button class="button button-primary" data-action="freeze"' + (disabled ? ' disabled' : '') + '>' + UI.icon('snowflake', 23) + '<span>Заморозить</span></button>';
  }
  function detail(UI, title, value) { return '<div class="detail-row"><span class="muted">' + title + '</span><strong>' + UI.escape(value) + '</strong></div>'; }
  function pendingInfo(state, UI, view, guardian) {
    const t = transfer(state, view);
    const dueAt = t.dueAt || now(state) + MS_DAY;
    return person(UI, t, guardian) + amount(UI, t) + '<div class="status-pill status-warning">' + UI.icon('clock', 17) + '<span>Ожидает исполнения</span></div>' +
      '<p class="countdown">Будет исполнен через ' + countdown(dueAt, state) + ' (' + when(dueAt, state) + ')</p>' +
      UI.card('<div class="reserve-line">' + UI.icon('wallet', 23) + '<span>' + (guardian ? 'Пока перевод ждёт, деньги остаются на счёте клиента в резерве.' : 'Деньги в резерве на вашем счёте') + '</span></div>' +
      (!guardian && t.guardianNotified ? '<div class="reserve-line">' + UI.icon('user', 23) + '<span>Анна П. получила уведомление</span></div>' : ''));
  }

  const screens = {
    how(state, UI) {
      const steps = [
        ['clock', 'Перевод незнакомому получателю больше 50 000 ₽ исполнится через 24 часа.'],
        ['wallet', 'Пока перевод ждёт, деньги остаются на вашем счёте.'],
        ['shield', 'Если сомневаетесь, нажмите «Заморозить» или «Позвать поддержку». Банк свяжется с вами и поможет разобраться.']
      ];
      const exceptions = ['Переводы между своими счетами', 'Переводы тем, кому вы уже переводили', 'Переводы до 50 000 ₽', 'Оплата в магазинах картой и по QR-коду'];
      return { title: 'Защита переводов', html:
        '<div class="feature-heading"><span class="feature-symbol">' + UI.icon('shieldCheck', 38) + '</span><span class="new-badge">новое</span></div>' +
        '<ol class="step-list">' + steps.map(([symbol, text], index) => '<li class="step"><span class="step-number" aria-hidden="true">' + UI.icon(symbol, 23) + '</span><p class="step-copy"><span class="sr-only">' + (index + 1) + '. </span>' + text + '</p></li>').join('') + '</ol>' +
        UI.card('<h3 class="section-title">Без задержки</h3><ul class="check-list">' + exceptions.map(text => '<li>' + UI.icon('check', 19) + '<span>' + text + '</span></li>').join('') + '</ul>') +
        UI.note(copy.disable, 'neutral', 'clock') +
        UI.button('Включить защиту', 'enableIntro')
      };
    },

    trust(state, UI) {
      return { title: 'Кто поможет остановить перевод', html:
        UI.card(anna(UI)) +
        UI.card('<label class="switch-row" for="guardian-permission"><span>' + copy.guardian + '</span><input class="switch" type="checkbox" role="switch" id="guardian-permission" data-action="toggleGuardian" aria-label="' + copy.guardian + '"' + (state.guardianCanFreeze ? ' checked' : '') + '></label>') +
        '<p class="muted body-copy">' + copy.guardianLimit + '</p>' +
        UI.link('Выбрать другое доверенное лицо', 'chooseTrust') +
        UI.button('Готово', 'saveTrust')
      };
    },

    trustPicker(state, UI) {
      return { title: 'Выбрать другое доверенное лицо', html:
        '<p class="section-label">Защита близких</p>' +
        '<button class="card choice-row" data-action="selectAnna">' + anna(UI) + UI.icon('check', 22) + '</button>' +
        UI.row('Защита близких', '', 'closeProtection', 'shield')
      };
    },

    enabled(state, UI) {
      return { title: 'Защита переводов', html:
        '<div class="success-hero"><div class="success-icon">' + UI.icon('shieldCheck', 74) + '</div><h2>Защита переводов включена</h2><p class="body-copy muted">Порог: 50 000 ₽ · Задержка: 24 часа · Доверенное лицо: Анна П.</p></div>' +
        UI.button('На главную', 'home')
      };
    },

    transferConfirm(state, UI, view) {
      const draft = view.draft || { amount: 300000, recipientId: 'sergey', recipientName: 'Сергей В. К.', bank: 'ВТБ', kind: 'phone' };
      const rule = window.ProtectionModel.classify(state, draft);
      const dueAt = now(state) + MS_DAY;
      const message = rule.delayed && rule.reason === 'repeated-new-recipient'
        ? 'Второй и следующие переводы тому же новому получателю в течение суток тоже ждут 24 часа при любой сумме.'
        : 'Получатель новый. Перевод будет исполнен ' + when(dueAt, state) + '. До этого деньги останутся на вашем счёте.';
      return { title: 'Подтверждение перевода', html:
        person(UI, draft, false) + amount(UI, draft) +
        UI.card(detail(UI, 'Банк получателя', draft.bank || 'ВТБ')) +
        (rule.delayed ? UI.note(message, 'warning', 'clock') : '') +
        (draft.recipientId === 'sergey' && draft.kind === 'phone' ? UI.note(copy.warning, 'danger', 'alert') : '') +
        UI.button(rule.delayed ? 'Перевести ' + when(dueAt, state) : 'Перевести', 'submitTransfer')
      };
    },

    pending(state, UI, view) {
      return { title: 'Перевод ожидает исполнения', html:
        pendingInfo(state, UI, view, false) +
        '<div class="stack">' + freezeButton(UI, false) + UI.button('Позвать поддержку', 'support', 'secondary') + '</div>' +
        '<p class="phone-footnote">Отменить перевод можно только вместе с сотрудником банка.</p>' +
        UI.link('Квитанция отложенного перевода', 'receipt')
      };
    },

    receipt(state, UI, view) {
      const t = transfer(state, view), dueAt = t.dueAt || DEFAULT_DATE + MS_DAY;
      return { title: 'Квитанция отложенного перевода', html:
        '<div class="receipt-banner">' + UI.icon('clock', 21) + '<span>ОТЛОЖЕННЫЙ ПЕРЕВОД</span></div>' +
        UI.card('<p class="body-copy">Будет исполнен ' + day(dueAt) + ' в ' + time(dueAt) + '. До этого времени может быть заморожен или отозван.</p><div class="divider"></div>' +
          '<div class="receipt-grid">' + detail(UI, 'Сумма', UI.money(t.amount)) + detail(UI, 'Получатель', t.recipientName) + detail(UI, 'Банк получателя', t.bank || 'ВТБ') + detail(UI, 'Клиент', 'Галина Петровна') + '</div>') +
        UI.button('Поделиться', 'shareReceipt', 'primary')
      };
    },

    frozen(state, UI, view) {
      const t = transfer(state, view);
      return { title: 'Перевод заморожен', html:
        '<div class="success-hero frozen-hero"><div class="freeze-icon">' + UI.icon('snowflake', 63) + '</div><h2>Перевод заморожен</h2><p class="body-copy">' + copy.frozen + '</p></div>' +
        UI.card('<p class="body-copy">Сотрудник банка позвонит вам в течение 2 часов.</p>') +
        '<div class="stack">' + UI.button('Позвонить в банк сейчас', 'call') + UI.button('Написать в чат', 'chat', 'secondary') + '</div>' +
        '<p class="phone-footnote">Сотрудник банка никогда не спрашивает коды из СМС.</p>'
      };
    },

    guardianHome(state, UI, view) {
      const notified = (state.transfers || []).filter(item => item.guardianNotified === true).slice().reverse();
      const statuses = {
        pending: ['Перевод ожидает исполнения', 'clock'],
        frozen: ['Перевод заморожен', 'snowflake'],
        executed: ['Перевод исполнен', 'check'],
        withdrawn: ['Перевод отозван', 'shield']
      };
      let html = UI.card('<div class="identity"><span class="avatar" aria-hidden="true">ГП</span><div><strong>Галина Петровна</strong><p class="muted small">Защита близких</p></div></div>');
      if (notified.length) html += '<p class="section-label">Защита переводов <span class="new-badge">новое</span></p>' + notified.map(t => {
        const status = statuses[t.status] || statuses.pending;
        return '<button class="card guardian-notification" data-action="guardianTransfer" data-transfer-id="' + UI.escape(t.id) + '"><div class="reserve-line">' + UI.icon(status[1], 26) + '<span><strong>' + status[0] + '</strong></span>' + UI.icon('chevron', 18) + '</div><div class="notification-amount">' + UI.money(t.amount) + '</div><p class="muted small">' + UI.escape(t.recipientName) + '</p></button>';
      }).join('');
      if (state.disableAt) html += UI.row('Отключить защиту можно только через 48 часов', 'Защита переводов', 'guardianDisable', 'clock');
      if (!notified.length && !state.disableAt) html += UI.note('Доверенное лицо из «Защиты близких» получает уведомление о каждом отложенном переводе и может заморозить его из своего приложения ВТБ. Отменить перевод оно не может.', 'neutral', 'shield');
      return { title: 'Защита близких', nav: true, html };
    },

    guardianPending(state, UI, view) {
      const t = transfer(state, view);
      if (t.status === 'frozen') return screens.guardianFrozen(state, UI, view);
      return { title: 'Перевод ожидает исполнения', html:
        pendingInfo(state, UI, view, true) +
        (state.guardianCanFreeze ? freezeButton(UI, false) : '') +
        UI.note(copy.bankOnly, 'neutral', 'lock')
      };
    },

    guardianFrozen(state, UI, view) {
      const t = transfer(state, view);
      return { title: 'Перевод заморожен', html:
        '<div class="success-hero frozen-hero"><div class="freeze-icon">' + UI.icon('snowflake', 63) + '</div><h2>Перевод заморожен</h2></div>' +
        UI.card(person(UI, t, true) + amount(UI, t)) +
        UI.note(copy.bankOnly, 'neutral', 'lock') +
        UI.button('На главную', 'home')
      };
    },

    disable(state, UI) {
      return { title: 'Защита переводов', html:
        '<div class="success-hero"><div class="freeze-icon">' + UI.icon('clock', 57) + '</div><h2>Отключить защиту можно только через 48 часов</h2></div>' +
        UI.note(copy.disable, 'neutral', 'clock') +
        UI.card(anna(UI)) +
        UI.button('Отключить защиту', 'requestDisable')
      };
    },

    disablePending(state, UI) {
      const until = state.disableAt || now(state) + 48 * MS_HOUR;
      return { title: 'Защита переводов', html:
        '<div class="success-hero"><div class="freeze-icon">' + UI.icon('clock', 57) + '</div><h2>Отключить защиту можно только через 48 часов</h2><div class="hero-amount disable-countdown">' + countdown(until, state) + '</div></div>' +
        UI.card('<div class="reserve-line">' + UI.icon('user', 23) + '<span>Анна П. получила уведомление</span></div>') +
        UI.note(copy.disable, 'neutral', 'clock') +
        UI.button('На главную', 'home')
      };
    },

    guardianDisable(state, UI) {
      return { title: 'Защита переводов', html:
        UI.card('<div class="identity"><span class="avatar" aria-hidden="true">ГП</span><div><strong>Галина Петровна</strong><p class="muted small">Защита близких</p></div></div>') +
        UI.note('Отключить защиту можно только через 48 часов, доверенное лицо получает уведомление.', 'warning', 'clock') +
        '<div class="hero-amount disable-countdown">' + countdown(state.disableAt || now(state) + 48 * MS_HOUR, state) + '</div>' +
        UI.button('На главную', 'home')
      };
    }
  };

  window.ProtectionScreens = screens;
})();
