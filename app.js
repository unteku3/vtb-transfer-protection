(function(){
'use strict';
const M=window.ProtectionModel, icon=window.ProtectionIcon, screens=window.ProtectionScreens;
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' ₽';
const UI={icon,escape,money,card:(html,classes='')=>`<section class="card ${classes}">${html}</section>`,badge:(text,kind='success')=>`<span class="tag ${kind}">${escape(text)}</span>`,note:(html,kind='neutral',symbol='info')=>`<div class="note note-${kind}">${icon(symbol,21)}<div>${html}</div></div>`,button:(label,action,kind='primary',attrs='')=>`<button class="button button-${kind}" data-action="${action}" ${attrs}>${label}</button>`,link:(label,action,attrs='')=>`<button class="text-link" data-action="${action}" ${attrs}>${label}</button>`,row:(title,sub,action,symbol='chevron',attrs='')=>`<button class="bank-row" data-action="${action}" ${attrs}><span class="row-icon">${icon(symbol,22)}</span><span class="row-copy"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${icon('chevron',17)}</button>`};
let state=M.createState(),role='client',route='home',stack=[],requestCounter=1,draft=makeDraft(),submittedId=null,formError='',scenario='new',supportActive=false,chatMessages=[],toastTimer,modalState=null;
function makeDraft(overrides={}){return {amount:300000,recipientId:'sergey',recipientName:'Сергей В. К.',kind:'phone',bank:'ВТБ',requestId:'draft-'+requestCounter++,...overrides};}
function t(){return M.current(state);}
function statusText(item){return ({pending:'Ожидает исполнения',frozen:'Перевод заморожен',executed:'Перевод исполнен',withdrawn:'Перевод отозван'})[item?.status]||'';}
function outcome(item=t()){return item?.status==='pending'?(role==='guardian'?'guardianPending':'pending'):item?.status==='frozen'?(role==='guardian'?'guardianFrozen':'frozen'):'transferDone';}
function enabledLabel(){return 'Защита переводов: '+(state.enabled?'включена':'выключена');}
function headerButton(symbol,action,label){return `<button class="icon-button" data-action="${action}" aria-label="${label}">${icon(symbol,22)}</button>`;}
const sceneGroups=[
{title:'Включить защиту',caption:'НОВЫЙ БЛОК В ПРИВЫЧНОМ СЕРВИСЕ',description:'Безопасность → Защита близких → Защита переводов. Клиент сам подключает защиту и выбирает право Анны на заморозку.',items:[['home','Главная ВТБ Онлайн'],['security','Безопасность'],['closeProtection','Защита близких'],['how','Как работает защита'],['trust','Доверенное лицо'],['enabled','Защита включена']]},
{title:'Отложить перевод',caption:'24 ЧАСА НА РЕШЕНИЕ',description:'Галине Петровне звонит «сотрудник Банка России» и требует срочно перевести 300 000 ₽ на «безопасный счёт».',items:[['transferForm','Перевод по телефону'],['transferConfirm','Подтверждение перевода'],['pending','Ожидание исполнения'],['receipt','Квитанция ожидания']]},
{title:'Остановить вместе',caption:'КЛИЕНТ · БЛИЗКИЙ ЧЕЛОВЕК · БАНК',description:'Перевод виден Галине и Анне. Заморозить его может любая из них; отозвать или разморозить — только вместе с сотрудником банка.',items:[['guardianHome','Уведомление Анне'],['guardianPending','Перевод в приложении Анны'],['guardianFrozen','Анна заморозила перевод'],['frozen','Что видит Галина'],['chat','Разговор с банком']]},
{title:'Отключение и исключения',caption:'ЗАЩИТА ОСТАЁТСЯ ВКЛЮЧЁННОЙ 48 ЧАСОВ',description:'Отключение нового блока занимает 48 часов. Переводы себе, прежним получателям и оплата покупок проходят без задержки.',items:[['disable','Отключить защиту'],['disablePending','48 часов ожидания'],['guardianDisable','Уведомление об отключении'],['history','История операций']]}
];
const sceneOrder=sceneGroups.flatMap(g=>g.items.map(([id])=>id));
function groupIndex(){const idx=sceneGroups.findIndex(g=>g.items.some(([id])=>id===route));return idx<0?(['call','transferDone'].includes(route)?2:0):idx;}

screens.home=()=>({title:'Главная',nav:true,home:true,html:`<section class="bank-hero"><div class="bank-account-label">Мастер-счёт в рублях <b>ВТБ</b></div><div class="bank-balance">${money(state.balance)}</div><div class="bank-subtitle">Дебетовая карта •• 4821${M.reserved(state)?' · В резерве '+money(M.reserved(state)):''}</div><div class="bank-hero-tiles"><button data-action="products">${icon('plus',21)}Пополнить счёт</button><button class="all-accounts" data-action="products"><span>Все мои счета<br>и продукты</span>${icon('wallet',23)}</button><button data-action="benefits">${icon('gift',21)}Выгода</button></div></section><section class="home-services"><h3>Платежи и переводы</h3><div class="service-grid"><button data-action="newTransfer"><span class="service-icon">${icon('user')}</span>Клиенту ВТБ</button><button data-action="newTransfer"><span class="service-icon">${icon('transfer')}</span>В другой банк</button><button data-action="qrPayment"><span class="service-icon">${icon('qr')}</span>Оплата по QR-коду</button><button data-action="payments"><span class="service-icon">${icon('mobile')}</span>Платежи</button></div></section>${t()?UI.card(UI.row(statusText(t()),money(t().amount)+' · '+escape(t().recipientName),'openTransfer',t().status==='frozen'?'snowflake':'clock')):''}<section class="card protection-entry"><div class="shield-illustration">${icon('shield',30)}</div><h3>Безопасность</h3><p>Самозапреты · Лимиты · Защита близких</p>${UI.link('Защита близких','closeProtection')}${UI.button('Безопасность','security','secondary')}</section>${UI.card(UI.row('История','','history','clock')+UI.row('Чат','','chat','chat'))}`});
screens.security=()=>({title:'Безопасность',nav:true,html:UI.card(UI.row('Самозапреты','','bans','lock')+UI.row('Лимиты','','limits','shield')+UI.row('Защита близких','','closeProtection','users'))});
screens.closeProtection=()=>({title:'Защита близких',html:UI.card(`<div class="identity"><span class="avatar">АП</span><div><strong>Анна П., дочь</strong><p class="small muted">+7 9•• •••-45-17</p>${UI.badge('Клиент ВТБ')}</div></div><p class="trust-existing-note">Доверенное лицо</p><button class="new-feature-row" data-action="protectionSettings"><span class="new-badge">новое</span><div><span>${enabledLabel()}</span>${icon('chevron',19)}</div></button>`)+ (state.enabled?UI.card(`<div class="detail-row"><span>Порог</span><span>50 000 ₽</span></div><div class="detail-row"><span>Задержка</span><span>24 часа</span></div>`):'')});
screens.protectionSettings=()=>({title:'Защита переводов',html:UI.card(`<div class="identity"><span class="row-icon">${icon('shieldCheck',29)}</span><strong>${state.enabled?'Защита переводов включена':'Защита переводов: выключена'}</strong></div><div class="divider"></div><p class="body-copy">Порог: 50 000 ₽ · Задержка: 24 часа · Доверенное лицо: Анна П.</p>`)+UI.card(UI.row('Кто поможет остановить перевод','Анна П., дочь','trust','users')+UI.row('Защита переводов: как это работает','','how','shield')+UI.row(state.disableAt?'Отключить защиту можно только через 48 часов':'Отключить защиту','',state.disableAt?'disablePending':'disable','clock'))});
screens.payments=()=>({title:'Платежи',nav:true,html:UI.card(UI.row('Переводы по номеру телефона','Сергей В. К.','newTransfer','user')+UI.row('Переводы между своими счетами','','ownTransfer','transfer')+UI.row('Переводы тем, кому вы уже переводили','Анна П., дочь','knownTransfer','users')+UI.row('Оплата в магазинах картой и по QR-коду','','qrPayment','qr'))});
screens.transferForm=()=>({title:draft.kind==='self'?'Переводы между своими счетами':draft.kind==='card'||draft.kind==='qr'?'Оплата в магазинах картой и по QR-коду':'Перевод по номеру телефона',html:UI.card(`<div class="identity"><span class="avatar sergey">${draft.recipientId==='anna'?'АП':draft.recipientId==='self'?'ГП':'СВ'}</span><div><strong>${escape(draft.recipientName)}</strong><p class="small muted">${escape(draft.bank)}</p></div></div><label class="form-label" for="transfer-amount">Сумма</label><input id="transfer-amount" class="form-input amount-input" value="${draft.amount}" inputmode="decimal" autocomplete="off" aria-describedby="form-error"><div id="form-error" class="form-error" role="alert">${escape(formError)}</div>`)+UI.card(`<div class="detail-row"><span>Доступно</span><span>${money(M.available(state))}</span></div>${M.reserved(state)?`<div class="detail-row"><span>Деньги в резерве на вашем счёте</span><span>${money(M.reserved(state))}</span></div>`:''}`)+UI.button('Подтверждение перевода','confirmTransfer')});
screens.products=()=>({title:'Продукты',nav:true,html:UI.card(`<p class="small muted">Мастер-счёт в рублях</p><div class="hero-amount">${money(state.balance)}</div><p class="small muted">Дебетовая карта •• 4821</p><div class="divider"></div><div class="detail-row"><span>Доступно</span><span>${money(M.available(state))}</span></div><div class="detail-row"><span>Деньги в резерве на вашем счёте</span><span>${money(M.reserved(state))}</span></div>`)+UI.button('Переводы между своими счетами','ownTransfer','secondary')});
screens.history=()=>({title:'История',nav:true,html:state.transfers.length?UI.card([...state.transfers].reverse().map(item=>UI.row(escape(item.recipientName),`${statusText(item)} · ${money(item.amount)}`,'openTransfer',item.status==='frozen'?'snowflake':'transfer',`data-transfer-id="${item.id}"`)).join('')):UI.card('<p class="body-copy">История переводов</p>')});
screens.transferDone=()=>({title:statusText(t()),html:`<div class="success-hero"><div class="success-icon">${icon(t()?.status==='withdrawn'?'shieldCheck':'check',60)}</div><h2>${statusText(t())}</h2><div class="hero-amount">${money(t()?.amount||0)}</div><p class="muted">${escape(t()?.recipientName||'')}</p></div>${UI.card(`<div class="detail-row"><span>${role==='guardian'?'Галина Петровна':'Доступно'}</span><span>${role==='guardian'?'Защита близких':money(M.available(state))}</span></div>`)}${UI.button('На главную','home')}`});
screens.chat=()=>({title:'Чат',nav:true,html:`<div class="message-bubble"><strong>Сотрудник банка</strong><p class="small muted">${t()?'Перевод '+money(t().amount)+' · '+escape(t().recipientName):'Защита переводов'}</p><div class="divider"></div><p>Отозвать или разморозить перевод можно только в разговоре с сотрудником банка (по телефону или в чате), разговор записывается.</p></div>${UI.note('Сотрудник банка никогда не спрашивает коды из СМС.','neutral','shield')}${chatMessages.map(m=>`<div class="message-bubble mine">${escape(m)}</div>`).join('')}<form class="chat-composer" id="chat-form"><input id="chat-input" aria-label="Написать в чат" placeholder="Написать в чат" maxlength="1000" autocomplete="off"><button type="submit" aria-label="Отправить">${icon('chevron',23)}</button></form>`});
screens.call=()=>({title:'Позвонить в банк сейчас',html:`<div class="call-orb">${icon('phone',45)}</div><div class="success-hero" style="padding-top:0"><h2>Сотрудник банка</h2><p>Сотрудник банка позвонит вам в течение 2 часов.</p></div>${UI.note('Сотрудник банка никогда не спрашивает коды из СМС.','neutral','shield')}${UI.button('Написать в чат','chat','secondary')}${UI.button('На главную','home','ghost')}`});
screens.support=()=>({title:'Позвать поддержку',html:UI.card('<p class="body-copy">Отозвать или разморозить перевод можно только в разговоре с сотрудником банка (по телефону или в чате), разговор записывается.</p>')+UI.button('Позвонить в банк сейчас','call')+UI.button('Написать в чат','chat','secondary')+UI.note('Сотрудник банка никогда не спрашивает коды из СМС.','neutral','shield')});
screens.limits=()=>({title:'Лимиты',html:UI.card(`<div class="detail-row"><span>Защита переводов</span><span>50 000 ₽</span></div><div class="detail-row"><span>Задержка</span><span>24 часа</span></div>`)+UI.row('Защита близких','','closeProtection','users')});
screens.bans=()=>({title:'Самозапреты',html:UI.card(UI.row('Безопасность','','security','shield')+UI.row('Защита близких','','closeProtection','users'))});
screens.benefits=()=>({title:'Выгода',nav:true,html:UI.card(`<div class="identity"><span class="row-icon">${icon('shield')}</span><strong>Защита переводов</strong></div><div class="divider"></div><p class="body-copy">Она бесплатная и добровольная.</p>`)+UI.button('Защита близких','closeProtection','secondary')});

const topRoutes=new Set(['home','payments','products','history','chat','guardianHome']);
const transferRoutes=new Set(['pending','frozen','guardianPending','guardianFrozen','receipt','transferDone']);
function normalize(id){
if(!screens[id])return role==='guardian'?'guardianHome':'home';
if(id==='home'&&role==='guardian')return 'guardianHome';
if(transferRoutes.has(id)){
if(!t())return role==='guardian'?'guardianHome':'history';
if(id==='receipt'&&t().status!=='pending')return outcome();
if(['pending','frozen','guardianPending','guardianFrozen','transferDone'].includes(id))return outcome();
}
if(id==='transferConfirm'&&submittedId){state.selectedId=submittedId;return outcome();}
if(id==='disablePending'&&!state.disableAt)return state.enabled?'protectionSettings':'closeProtection';
if(id==='guardianDisable'&&!state.disableAt)return 'guardianHome';
return id;
}
function routeRecord(){return {route,role,selectedId:state.selectedId,draft:{...draft},submittedId};}
function restoreRecord(record){role=record.role||'client';if(record.selectedId!==undefined)state.selectedId=record.selectedId;if(record.draft)draft={...record.draft};submittedId=record.submittedId||null;supportActive=role==='client'&&['chat','call'].includes(record.route);}
function snapshot(){return {vtbProtection:true,...routeRecord(),stack:[...stack]};}
function go(id,opts={}){
closeModal(false);const next=normalize(id);
if(!opts.replace&&next!==route){if(topRoutes.has(next))stack=[];else stack.push(routeRecord());}
route=next;render();const snap=snapshot();
if(opts.replace||opts.history===false)history.replaceState(snap,'','#'+route);else history.pushState(snap,'','#'+route);
}
function back(){const previous=stack.pop();if(previous&&typeof previous==='object'){restoreRecord(previous);go(previous.route,{replace:true});}else go(previous||'home',{replace:true});}
function switchRole(next){const previous=t();role=next;stack=[];go(next==='guardian'?'guardianHome':previous&&['guardianPending','guardianFrozen','transferDone'].includes(route)?outcome(previous):'home',{replace:false});}
function render(){
route=normalize(route);const def=screens[route](state,UI,{role,draft,transfer:t()});
$('phone').classList.toggle('home-view',!!def.home);$('role-note').hidden=role!=='guardian';
$('role-client').setAttribute('aria-pressed',String(role==='client'));$('role-guardian').setAttribute('aria-pressed',String(role==='guardian'));
$('phone-header').innerHTML=def.home?`<div class="home-header">${headerButton('user','profile','Профиль')}<h2 tabindex="-1">Галина Петровна</h2>${headerButton('search','search','Поиск')}${headerButton('bell','notifications','Уведомления')}</div>`:`<div class="phone-header">${headerButton('arrow','back','Назад')}<h2 tabindex="-1">${escape(def.title)}</h2>${['closeProtection','protectionSettings','how'].includes(route)?'<span class="header-spacer"></span>':''}</div>`;
$('screen').innerHTML=def.html;$('screen').setAttribute('aria-label',def.title);$('screen').scrollTop=0;
const navItems=[['home','home','Главная'],['payments','transfer','Платежи'],['products','grid','Продукты'],['history','clock','История'],['chat','chat','Чат']];
$('bottom-nav').innerHTML=def.nav?navItems.map(([id,symbol,label])=>`<button data-action="${id}" class="${route===id||(id==='home'&&['security','guardianHome'].includes(route))?'active':''}" ${route===id?'aria-current="page"':''}>${icon(symbol,21)}<span>${label}</span></button>`).join(''):'';
renderNavigation();renderControls();document.title=def.title+' · ВТБ Онлайн — учебный прототип';
const heading=$('phone-header').querySelector('h2');if(heading)heading.focus({preventScroll:true});
}
function renderNavigation(){
const index=groupIndex(),group=sceneGroups[index];
$('scene-nav').innerHTML=sceneGroups.map((g,i)=>`<div class="scene-group"><button class="group-button ${i===index?'active':''}" data-scene="${g.items[0][0]}"><span class="group-number">0${i+1}</span>${g.title}${icon('chevron',15)}</button>${index===i?`<div class="scene-children">${g.items.map(([id,label])=>`<button class="scene-child ${id===route?'active':''}" data-scene="${id}">${label}</button>`).join('')}</div>`:''}</div>`).join('');
$('stage-label').textContent=group.caption;$('context-title').textContent=group.title;$('context-description').textContent=group.description;
$('scene-select').innerHTML=sceneGroups.map(g=>`<optgroup label="${g.title}">${g.items.map(([id,label])=>`<option value="${id}" ${id===route?'selected':''}>${label}</option>`).join('')}</optgroup>`).join('');
if(!sceneOrder.includes(route))$('scene-select').insertAdjacentHTML('afterbegin',`<option value="${route}" selected>${escape(screens[route](state,UI,{role,draft,transfer:t()}).title)}</option>`);
const n=sceneOrder.indexOf(route);$('screen-counter').textContent=n<0?'Дополнительный экран':`${String(n+1).padStart(2,'0')} / ${sceneOrder.length}`;
}
function renderControls(){
const choices=[['new','Новый получатель · 300 000 ₽'],['repeat','Повторный перевод · 20 000 ₽'],['threshold','Новый получатель · 50 000 ₽'],['known','Прежний получатель · 60 000 ₽'],['own','Между своими счетами'],['qr','Покупка по QR · 60 000 ₽'],['card','Покупка картой · 60 000 ₽']];
$('scenario-controls').innerHTML=`<div class="control-label">ПРОВЕРИТЬ ПРАВИЛО</div>${choices.map(([id,label])=>`<button class="scenario-choice ${scenario===id?'active':''}" data-scenario="${id}">${label}</button>`).join('')}<p class="control-hint">Выбор запускает отдельный демонстрационный сценарий с включённой защитой. Состояние текущего показа сбрасывается.</p><div class="demo-balances"><div><span>Защита</span><b>${state.enabled?(state.disableAt?'Отключается':'Включена'):'Выключена'}</b></div><div><span>На счёте</span><b>${money(state.balance)}</b></div><div><span>В резерве</span><b>${money(M.reserved(state))}</b></div><div><span>Доступно</span><b>${money(M.available(state))}</b></div></div><div class="control-label">ВРЕМЯ ДЕМОНСТРАЦИИ</div><p class="control-hint">${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(state.now)}</p><div class="time-controls"><button data-action="advance" data-hours="24">+24 часа</button><button data-action="advance" data-hours="48">+48 часов</button></div><p class="control-hint">Перемотка времени показывает исполнение перевода и отключение защиты. Замороженные переводы остаются в резерве.</p>${['chat','call'].includes(route)&&role==='client'&&t()&&['pending','frozen'].includes(t().status)?`<div class="support-demo"><div class="control-label">РЕШЕНИЕ СОТРУДНИКА БАНКА</div><p>Только для ведущего презентации: имитация результата записанного разговора. Этих кнопок нет в приложении клиента или Анны.</p><button data-action="bankDecision" data-resolution="withdraw">После разговора → отозвать перевод</button><button data-action="bankDecision" data-resolution="resume" ${t().status!=='frozen'?'disabled':''}>После разговора → разморозить перевод</button></div>`:''}`;
}
function beginTransfer(overrides={}){role='client';draft=makeDraft(overrides);submittedId=null;formError='';supportActive=false;go('transferForm');}
function runScenario(name){
state=M.createState();M.enable(state);role='client';stack=[];submittedId=null;supportActive=false;chatMessages=[];scenario=name;
let values={};if(name==='repeat'){M.submit(state,makeDraft());values={amount:20000};}if(name==='threshold')values={amount:50000};if(name==='known')values={amount:60000,recipientId:'anna',recipientName:'Анна П., дочь'};if(name==='own')values={amount:60000,recipientId:'self',recipientName:'Галина Петровна',kind:'self'};if(name==='qr'||name==='card')values={amount:60000,recipientId:'store',recipientName:'Оплата в магазинах',kind:name};draft=makeDraft(values);formError='';go('transferConfirm',{replace:true});
}
function activateScene(id){
role=id.startsWith('guardian')?'guardian':'client';stack=[];formError='';
if(id==='home'){go('home',{replace:true});return;}
if(['enabled','transferForm','transferConfirm','pending','receipt','frozen','guardianHome','guardianPending','guardianFrozen','chat','disable','disablePending','guardianDisable'].includes(id))M.enable(state);
if(['transferForm','transferConfirm'].includes(id)){draft=makeDraft();submittedId=null;}
if(['pending','receipt','frozen','guardianHome','guardianPending','guardianFrozen','chat'].includes(id)){
const selected=t();if(!selected||!['pending','frozen'].includes(selected.status)||(['pending','receipt','guardianPending'].includes(id)&&selected.status==='frozen')){state=M.createState();M.enable(state);const result=M.submit(state,makeDraft());submittedId=result.transfer.id;}
if(['frozen','guardianFrozen'].includes(id))M.freeze(state,t().id,id==='guardianFrozen'?'guardian':'client');
}
if(['disablePending','guardianDisable'].includes(id))M.requestDisable(state);
if(id==='chat')supportActive=true;
go(id,{replace:true});
}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function openModal(target,html){
closeModal(false);const focus=document.activeElement;target.innerHTML=html;target.hidden=false;target.setAttribute('role','dialog');target.setAttribute('aria-modal','true');
const inert=[];let branch=target;while(branch&&branch!==document.body){for(const sib of branch.parentElement.children){if(sib!==branch&&!sib.inert&&!['SCRIPT','STYLE','LINK'].includes(sib.tagName)){sib.inert=true;inert.push(sib);}}branch=branch.parentElement;}
modalState={target,focus,inert};const heading=target.querySelector('h2,h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}else target.querySelector('button')?.focus();
}
function closeModal(restore=true){if(!modalState)return;const {target,focus,inert}=modalState;target.hidden=true;target.innerHTML='';inert.forEach(el=>el.inert=false);modalState=null;if(restore&&focus?.isConnected)focus.focus({preventScroll:true});}
function sheet(title,body){openModal($('phone-modal'),`<section class="sheet"><div class="sheet-header"><h3>${title}</h3>${headerButton('close','closeModal','Закрыть')}</div>${body}</section>`);$('phone-modal').setAttribute('aria-label',title);}
function map(){openModal($('map-modal'),`<div class="map-inner"><div class="map-top"><div><div class="eyebrow">ВТБ ОНЛАЙН / ЗАЩИТА ПЕРЕВОДОВ</div><h2>Один перевод. Время остановиться.</h2><p>Нажмите на экран, чтобы начать соответствующий фрагмент демонстрации.</p></div><button class="studio-button" data-action="closeModal">Закрыть ✕</button></div><div class="map-grid">${sceneGroups.map(g=>`<section class="map-column"><h3>${g.title}</h3>${g.items.map(([id,label])=>`<button class="map-node" data-scene="${id}">${label}<small>${id.startsWith('guardian')?'Приложение Анны':'Приложение Галины'} →</small></button>`).join('')}</section>`).join('')}</div></div>`);$('map-modal').setAttribute('aria-label','Схема сценариев');}
function shareReceipt(){
const item=t();if(!item||item.status!=='pending')return;
const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(item.dueAt);
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Учебная квитанция</title><body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto;padding:20px"><p>УЧЕБНЫЙ ПРОТОТИП · НЕ БАНКОВСКИЙ ДОКУМЕНТ</p><h1 style="padding:16px;background:#fff0dc;font-size:20px">ОТЛОЖЕННЫЙ ПЕРЕВОД</h1><p>Будет исполнен ${date}. До этого времени может быть заморожен или отозван.</p><hr><p>Сумма: ${money(item.amount)}</p><p>Получатель: ${escape(item.recipientName)}</p><p>Банк получателя: ${escape(item.bank)}</p><p>Клиент: Галина Петровна</p><p>Деньги в резерве на вашем счёте</p></body></html>`;
const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Учебная-квитанция-отложенного-перевода.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Квитанция отложенного перевода');
}
const actions={
home:()=>{stack=[];go('home');},client:()=>switchRole('client'),guardian:()=>switchRole('guardian'),back,
security:()=>go('security'),closeProtection:()=>go('closeProtection'),protectionSettings:()=>go(state.enabled?(state.disableAt?'disablePending':'protectionSettings'):'how'),how:()=>go('how'),trust:()=>go('trust'),enableIntro:()=>go('trust'),chooseTrust:()=>go('trustPicker'),selectAnna:()=>go('trust'),
saveTrust:()=>{M.enable(state);stack=[];go('enabled');},payments:()=>go(role==='guardian'?'guardianHome':'payments'),products:()=>go(role==='guardian'?'guardianHome':'products'),history:()=>go(role==='guardian'?'guardianHome':'history'),
newTransfer:()=>beginTransfer(),ownTransfer:()=>beginTransfer({amount:50000,recipientId:'self',recipientName:'Галина Петровна',kind:'self'}),knownTransfer:()=>beginTransfer({amount:60000,recipientId:'anna',recipientName:'Анна П., дочь'}),qrPayment:()=>beginTransfer({amount:60000,recipientId:'store',recipientName:'Оплата в магазинах',kind:'qr'}),
confirmTransfer:()=>{const amount=Number($('transfer-amount').value.replace(/\s/g,'').replace(',','.'));draft.amount=amount;if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)/100!==amount){formError='Проверьте сумму перевода.';$('form-error').textContent=formError;$('transfer-amount').setAttribute('aria-invalid','true');return;}if(amount>M.available(state)){formError='Недостаточно денег на счёте.';$('form-error').textContent=formError;$('transfer-amount').setAttribute('aria-invalid','true');return;}formError='';go('transferConfirm');},
submitTransfer:()=>{if(route!=='transferConfirm')return;const r=M.submit(state,draft);if(!r.ok){toast(r.error);return;}submittedId=r.transfer.id;stack=['home'];go(outcome(),{replace:true});},
openTransfer:el=>{if(el?.dataset.transferId)state.selectedId=el.dataset.transferId;go(outcome());},guardianTransfer:el=>{if(el?.dataset.transferId)state.selectedId=el.dataset.transferId;go(outcome());},
freeze:()=>{const item=t();if(!item)return;const r=M.freeze(state,item.id,role);if(!r.ok){toast(r.error);return;}stack=role==='guardian'?['guardianHome']:['home'];go(outcome(),{replace:true});},
support:()=>go('support'),call:()=>{supportActive=true;go('call');},chat:()=>{if(role==='guardian'){go('guardianHome');return;}supportActive=true;go('chat');},receipt:()=>go('receipt'),shareReceipt,
disable:()=>go(state.disableAt?'disablePending':'disable'),disablePending:()=>go('disablePending'),requestDisable:()=>{if(role!=='client')return;const r=M.requestDisable(state);if(!r.ok){toast(r.error);return;}go('disablePending',{replace:true});},guardianDisable:()=>{role='guardian';go('guardianDisable');},
advance:el=>{M.advance(state,Number(el.dataset.hours));go(route,{replace:true});},
bankDecision:el=>{if(!supportActive||role!=='client'||!['chat','call'].includes(route)||!t())return;const result=M.supportResolve(state,t().id,el.dataset.resolution);if(!result.ok){toast(result.error);return;}supportActive=false;stack=['home'];go(outcome(),{replace:true});},
limits:()=>go('limits'),bans:()=>go('bans'),benefits:()=>go('benefits'),
profile:()=>sheet('Галина Петровна',UI.card('<p>Галина Петровна, 68 лет</p>')+UI.button('Безопасность','security','secondary')),
search:()=>sheet('Поиск',UI.row('Безопасность','','security','shield')+UI.row('Защита близких','','closeProtection','users')+UI.row('История','','history','clock')),
notifications:()=>sheet('Уведомления',t()?UI.row(statusText(t()),money(t().amount),'openTransfer','clock'):UI.row('Защита близких','','closeProtection','users')),
openMap:map,closeModal:()=>closeModal(),toggleControls:()=>$('context-panel').classList.toggle('open'),
reset:()=>{state=M.createState();role='client';stack=[];draft=makeDraft();submittedId=null;formError='';scenario='new';supportActive=false;chatMessages=[];go('home',{replace:true});},
previousScene:()=>activateScene(sceneOrder[Math.max(0,sceneOrder.indexOf(route)-1)]),nextScene:()=>activateScene(sceneOrder[Math.min(sceneOrder.length-1,sceneOrder.indexOf(route)+1)])
};
document.addEventListener('click',event=>{
const el=event.target.closest('[data-action],[data-scene],[data-scenario]');if(!el||el.disabled||el.closest('[inert]'))return;
if(el.matches('input[type="checkbox"]'))return;event.preventDefault();
if(el.dataset.scene){closeModal(false);activateScene(el.dataset.scene);return;}if(el.dataset.scenario){runScenario(el.dataset.scenario);return;}
actions[el.dataset.action]?.(el);
});
document.addEventListener('change',event=>{if(event.target.id==='scene-select')activateScene(event.target.value);if(event.target.id==='guardian-permission'){M.setGuardianPermission(state,event.target.checked);renderControls();}});
document.addEventListener('submit',event=>{if(event.target.id!=='chat-form')return;event.preventDefault();const text=$('chat-input').value.trim();if(!text)return;chatMessages.push(text);render();$('chat-input').focus();$('screen').scrollTop=$('screen').scrollHeight;});
document.addEventListener('keydown',event=>{if(!modalState)return;if(event.key==='Escape'){event.preventDefault();closeModal();return;}if(event.key!=='Tab')return;const els=[...modalState.target.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')].filter(e=>e.getClientRects().length);if(!els.length){event.preventDefault();return;}const first=els[0],last=els.at(-1),active=document.activeElement;if(event.shiftKey&&(active===first||!els.includes(active))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(active===last||!els.includes(active))){event.preventDefault();first.focus();}});
window.addEventListener('popstate',event=>{closeModal(false);const snap=event.state;if(snap?.vtbProtection){restoreRecord(snap);stack=snap.stack||[];route=normalize(snap.route);}else route=normalize(location.hash.slice(1));render();history.replaceState(snapshot(),'','#'+route);});
let initial=location.hash.slice(1);if(initial&&sceneOrder.includes(initial)&&initial!=='home')activateScene(initial);else go('home',{replace:true});
window.ProtectionApp={getState:()=>state,getRoute:()=>route,getRole:()=>role,getDraft:()=>draft,activateScene,runScenario,actions,UI};
})();
