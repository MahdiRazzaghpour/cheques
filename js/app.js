import * as C from './core.js';
import { Store, newLedger } from './store.js';
import { demoLedger } from './demo.js';

const params = new URLSearchParams(location.search);
const store = new Store(params.has('demo') ? demoLedger() : null);
const $app = document.getElementById('app');

const state = {
  tab: ['overview', 'month', 'accounts', 'settings'].includes(params.get('tab')) ? params.get('tab') : 'overview',
  stacks: { overview: [], month: [], accounts: [], settings: [] },
  month: C.Month.of(C.Day.today()),
  modal: null,
  search: '', filter: 'open',
  lastRouteKey: null,
};
if (params.get('screen') === 'plan') state.stacks.overview.push({ name: 'plan', period: C.Period.monthOf(C.Day.today()) });
if (params.get('screen') === 'account') state.stacks.accounts.push({ name: 'account', id: store.ledger?.accounts[0]?.id });

const COMMON_BANKS = ['Melli', 'Mellat', 'Saderat', 'Tejarat', 'Sepah', 'Keshavarzi', 'Maskan', 'Refah', 'Pasargad',
  'Parsian', 'Saman', 'Eghtesad Novin', 'Sina', 'Shahr', 'Dey', 'Resalat', 'Karafarin', 'Post Bank', "Tose'e Ta'avon",
  'Middle East', 'Iran Zamin'];

// ---------- small helpers ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nowISO = () => new Date().toISOString();
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const ICON = {
  house: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.5 11h2.6v9.3h5.2v-5.8h3.4v5.8h5.2V11h2.6z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" stroke-linecap="round"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 2.5 7.5v2h19v-2zM4.5 11h2.5v7H4.5zm4.5 0h2.5v7H9zm4.5 0H16v7h-2.5zm4.5 0h2.5v7H18zM2.5 19.5h19V22h-19z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.5 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>',
};

function topbar({ back = false, left = '', title = '', right = '' } = {}) {
  return `<div class="topbar">
    <div class="slot">${back ? `<button class="tb-btn" data-act="back">${ICON.left}Back</button>` : left}</div>
    <div class="title">${esc(title)}</div>
    <div class="slot end">${right}</div></div>`;
}

function group(head, body, foot = '') {
  return `${head ? `<div class="group-head">${esc(head)}</div>` : ''}<div class="group"><div class="card">${body}</div>${foot ? `<div class="group-foot">${foot}</div>` : ''}</div>`;
}

// ---------- computed view of the ledger ----------

function calc() {
  const L = store.ledger, S = store.settings;
  const now = new Date();
  const today = C.Day.today(now);
  const bank = new C.BankCalendar(S.closedWeekdays, L.holidays.map(h => C.Day.parse(h.date)?.key).filter(Boolean));
  const accounts = [...L.accounts].sort((a, b) => C.accountName(a).localeCompare(C.accountName(b)));
  const data = accounts.map(account => ({
    account, entries: L.entries.filter(e => e.accountID === account.id), cheques: L.cheques.filter(c => c.accountID === account.id),
  }));
  const summaries = new Map(data.map(d => [d.account.id, C.summarize(d.account, d.entries, d.cheques, today, S.horizonDays, bank)]));
  const cover = new Map();
  for (const s of summaries.values()) for (const [id, cv] of s.cover) cover.set(id, cv);
  return {
    L, S, now, today, bank, accounts, data, summaries, cover, unit: S.unit,
    money: rials => C.money(rials, S.unit),
    account: id => L.accounts.find(a => a.id === id),
    pharmacy: id => L.pharmacies.find(p => p.id === id),
  };
}

function badge(k, c) {
  if (c.status === 'cleared') return ['Cleared', 'var(--sub)'];
  if (c.status === 'cancelled') return ['Cancelled', 'var(--sub)'];
  if (c.status === 'bounced') return ['Bounced', 'var(--red)'];
  const cv = k.cover.get(c.id);
  const past = C.Day.parse(c.due).key < k.today.key;
  if (!cv) return ['Open', 'var(--sub)'];
  if (cv.covered) return past ? ['Past due · covered', 'var(--orange)'] : ['Covered', 'var(--green)'];
  return past ? ['Past due · short', 'var(--red)'] : [`Short ${k.money(cv.shortfall)}`, 'var(--red)'];
}

function chequeRow(k, c, { showAccount = true } = {}) {
  const account = k.account(c.accountID);
  const due = C.Day.parse(c.due);
  const [label, color] = badge(k, c);
  const where = [showAccount ? (account ? C.accountName(account) : 'No account') : null, k.pharmacy(c.pharmacyID)?.name || 'No pharmacy'].filter(Boolean).join(' · ');
  return `<div class="row" role="button" data-act="edit-cheque" data-id="${esc(c.id)}">
    <span class="stripe" style="background:${C.colorOf(account)}"></span>
    <div class="grow"><div dir="auto" style="${c.status === 'cancelled' ? 'text-decoration:line-through' : ''}">${esc(c.recipient || 'No recipient')}</div>
      <div class="sub">${esc(where)}</div>${c.sayadID ? `<div class="sub num">Sayad ${esc(c.sayadID)}</div>` : ''}
      ${C.sharePart(c) ? `<div class="sub"><bdi>${esc(c.shareName || 'Someone')}</bdi> pays ${esc(k.money(C.sharePart(c)))} · ${c.shareReceived ? '<span class="green">paid in ✓</span>' : '<span class="orange">not paid in yet</span>'}</div>` : ''}</div>
    <div style="text-align:right"><div class="num">${esc(k.money(c.amountRials))}</div>
      <div class="sub">${esc(due.formattedShort)} · ${esc(due.relative(k.today))}</div>
      <span class="pill" style="color:${color};background:color-mix(in srgb, ${color} 15%, transparent)">${esc(label)}</span></div></div>`;
}

function balanceLine(k, s) {
  const latest = s.balance.latest;
  if (!latest) return '<div class="sub orange">No balance entered yet</div>';
  const when = C.Day.fromDate(new Date(latest.enteredAt)).relative(k.today);
  return `<div class="sub">Balance ${esc(k.money(s.balance.available))} · updated ${esc(when)}${latest.enteredBy ? ` by ${esc(latest.enteredBy)}` : ''}</div>`;
}

function statusLines(k, s) {
  let html = '';
  if (s.status === 'none') html = '<div class="sub">No open cheques</div>';
  else if (s.status === 'covered') html = `<div class="green">✓ All ${s.outstanding.length} open cheques covered</div>`;
  else if (s.status === 'coveredForHorizon') {
    html = `<div class="green">✓ Covered for the next ${k.S.horizonDays} days</div>`;
    if (s.firstGap) { const d = C.Day.parse(s.firstGap.due); html += `<div class="sub">Short ${esc(k.money(s.totalShortfall))} later · first gap ${esc(d.formattedShort)} (${esc(d.relative(k.today))})</div>`; }
  } else {
    html = `<div class="red bold">⚠︎ Transfer ${esc(k.money(s.shortfallInHorizon))}</div>`;
    if (s.transferBy) html += `<div class="sub">by ${esc(s.transferBy.formattedWithWeekday)} (${esc(s.transferBy.relative(k.today))}) · covers cheques due through ${esc(s.horizonEnd.formattedShort)}</div>`;
  }
  const soon = k.today.addDays(2);
  const dueSoon = s.outstanding.some(c => { const d = C.Day.parse(c.due); return d.key >= k.today.key && d.key <= soon.key; });
  const stale = !s.balance.lastUpdated || (k.now - s.balance.lastUpdated) > 48 * 3600000;
  if ((s.status === 'covered' || s.status === 'coveredForHorizon') && dueSoon && stale) {
    html += '<div class="sub orange">Balance is over 2 days old and a cheque is due soon. Confirm it.</div>';
  }
  return html + owedLine(k, s.owedInHorizon);
}

/// "Shadi still owes 200,000,000 IRR of these cheques": shared parts not paid in yet.
function owedLine(k, owed) {
  if (!owed || !owed.size) return '';
  return `<div class="sub orange">${[...owed].map(([name, amount]) => `<bdi>${esc(name)}</bdi> still owes ${esc(k.money(amount))}`).join(' · ')} of these cheques</div>`;
}

function transferLine(k, amount, by) {
  return amount > 0 ? `<span class="red">↓ Transfer ${esc(k.money(amount))} by ${esc(by.formattedShort)}</span>` : '<span class="green">✓ Covered</span>';
}

// ---------- screens ----------

function onboarding() {
  return `<div style="padding-top:calc(env(safe-area-inset-top) + 24px)"></div>
    <h1 class="large">Cheque Tracker</h1>
    ${installBanner()}
    ${group('', '<div class="row">Track the cheques you have written, which account each one is drawn on, and how much to transfer before it is cashed.</div>')}
    ${group('Your name', `<div class="field full"><input id="onboard-name" placeholder="e.g. Saba" value="${esc(store.settings.userName)}" autocomplete="given-name"></div>`, 'Shown next to balances and cheques you enter.')}
    ${group('Start', `<button class="row action" id="start-btn" data-act="start" ${store.settings.userName.trim() ? '' : 'disabled style="opacity:.4"'}>Start a new ledger</button>`, 'Everything is stored on this phone.')}
    ${group('', '<button class="row action" data-act="restore">Restore from a backup file…</button>', 'New phone or reinstalled? Pick the backup file you saved from Settings → Backup.')}`;
}

function installBanner() {
  if (!isIOS() || isStandalone()) return '';
  return `<div class="banner"><div style="font-size:22px">⬆︎</div><div class="grow"><b>Install on your iPhone</b>
    <div class="sub">In Safari tap the Share button, then <b>Add to Home Screen</b>. It then opens like an app and works offline.</div></div></div>`;
}

function backupBanner(k) {
  const last = k.S.lastBackupAt ? new Date(k.S.lastBackupAt) : null;
  const hasData = k.L.cheques.length + k.L.entries.length > 0;
  if (!hasData || (last && k.now - last < 7 * 86400000)) return '';
  const when = last ? `Last backup ${C.Day.fromDate(last).relative(k.today)}.` : 'No backup yet.';
  return `<div class="banner"><div style="font-size:22px">💾</div><div class="grow"><b>Save a backup</b>
    <div class="sub">Everything is only on this phone. ${esc(when)}</div></div>
    <button class="accent bold" data-act="backup">Save</button></div>`;
}

/// Today's reminders: the ones the iPhone version would have sent as notifications today.
function remindersSection(k) {
  const list = C.planReminders(k.data, k.today.at(0, 0), { offsets: k.S.offsets }, k.bank, k.unit)
    .filter(r => r.day.key === k.today.key);
  if (!list.length) return '';
  const rows = list.map(r => `<div class="row stack"><div class="bold ${r.kind === 'confirmBalance' ? 'orange' : 'red'}">${esc(r.title)}</div>
    <div class="sub" style="white-space:pre-line">${esc(r.body)}</div></div>`).join('');
  return group('Reminders today', rows);
}

function overview(k) {
  let html = topbar({ right: k.L.accounts.length ? `<button class="tb-btn" data-act="new-cheque" aria-label="Add cheque">${ICON.plus}</button>` : '' });
  html += '<h1 class="large">Overview</h1>' + installBanner() + backupBanner(k) + remindersSection(k);
  const dups = C.duplicateSayad(k.L.cheques);
  if (dups.length) html += group('', dups.map(g => `<div class="row orange">Sayad ${esc(g[0].sayadID)} is entered ${g.length} times. Delete the extra copy.</div>`).join(''));
  if (!k.L.accounts.length) {
    return html + group('', `<div class="row">Add the bank accounts you write cheques from.</div><button class="row action" data-act="new-account">Add account</button>`);
  }
  const month = C.Period.monthOf(k.today), quarter = C.Period.quarterOf(k.today);
  const planRow = (label, period) => {
    const p = C.periodPlan(period, k.data, k.L.pharmacies);
    return `<div class="row link stack" role="button" data-act="push" data-route="plan" data-period="${period.kind}:${period.y}:${period.n}">
      <div class="bold">${esc(label)} · ${esc(period.title)}</div>
      <div class="sub">${esc(k.money(p.totalStillToPay))} still to pay${p.totalCashed ? ` · ${esc(k.money(p.totalCashed))} cashed` : ''}</div>
      ${transferLine(k, p.totalTransfer, period.end)}${owedLine(k, p.owedByEnd)}</div>`;
  };
  html += group('Plan', planRow('This month', month) + planRow('This quarter', quarter));
  html += group('Accounts', k.accounts.map(a => {
    const s = k.summaries.get(a.id);
    return `<div class="row link" role="button" data-act="push" data-route="account" data-id="${esc(a.id)}">
      <span class="stripe" style="background:${C.colorOf(a)}"></span>
      <div class="grow"><div class="bold">${esc(C.accountName(a))}</div>${balanceLine(k, s)}${statusLines(k, s)}</div></div>`;
  }).join(''));
  const attention = [...k.summaries.values()].flatMap(s => s.overdue.filter(c => c.status === 'bounced' || !k.cover.get(c.id)?.covered));
  if (attention.length) html += group('Needs attention', attention.map(c => chequeRow(k, c)).join(''));
  if (k.L.pharmacies.length) {
    const totals = C.pharmacyTotals(k.L.cheques, k.today, k.S.horizonDays);
    html += group('By pharmacy', k.L.pharmacies.map(p => {
      const t = totals.get(p.id) || { openCount: 0, openTotal: 0, dueInHorizon: 0 };
      return `<div class="row stack"><div>${esc(p.name)}</div><div class="sub">${t.openCount} open · ${esc(k.money(t.openTotal))} total · ${esc(k.money(t.dueInHorizon))} due in ${k.S.horizonDays} days</div></div>`;
    }).join(''));
  }
  return html;
}

function monthView(k) {
  const pharmacies = k.L.pharmacies;
  const cols = Math.max(1, pharmacies.length);
  const grid = `grid-template-columns: 42px repeat(${cols}, minmax(0, 1fr))`;
  const rows = C.monthRows(state.month, k.L.cheques, pharmacies.map(p => p.id), k.bank);
  const isCurrent = state.month.equals(C.Month.of(k.today));
  let html = topbar({
    left: `<button class="tb-btn" data-act="month-prev" aria-label="Previous month">${ICON.left}</button><button class="tb-btn" data-act="month-next" aria-label="Next month">${ICON.right}</button>`,
    title: state.month.title,
    right: `${isCurrent ? '' : '<button class="tb-btn" data-act="month-today">Today</button>'}<button class="tb-btn" data-act="push" data-route="search" aria-label="Search">${ICON.search}</button>`,
  });
  const open = rows.reduce((s, r) => s + r.open, 0);
  const cashed = rows.reduce((s, r) => s + r.total - r.open, 0);
  // Cashed cheques leave the sheet unless asked for: they no longer need money, and they stay in the records.
  const visible = list => (k.S.showCashed ? list : list.filter(c => c.status !== 'cleared'));
  const cashedCount = rows.reduce((s, r) => s + [...r.sections.flat(), ...r.unassigned].filter(c => c.status === 'cleared').length, 0);
  html += `<div class="sheet-head" style="${grid}"><div>Day</div>${pharmacies.length ? pharmacies.map(p => `<div>${esc(p.name)}</div>`).join('') : '<div>Cheques</div>'}
    <div class="sheet-total">Still to pay ${esc(k.money(open))}${cashed ? ` · cashed ${esc(k.money(cashed))}` : ''}
      ${cashedCount ? `<button class="sheet-toggle" data-act="toggle-cashed">${k.S.showCashed ? 'Hide cashed' : `Show cashed (${cashedCount})`}</button>` : ''}</div></div>`;
  const chip = c => {
    const account = k.account(c.accountID);
    const hex = C.colorOf(account);
    const cv = k.cover.get(c.id);
    let mark = '';
    if (c.status === 'cleared') mark = '<span class="mark sub">✓</span>';
    else if (c.status === 'bounced') mark = '<span class="mark red">⛔︎</span>';
    else if (c.status === 'open' && cv && !cv.covered) mark = '<span class="mark red">●</span>';
    return `<button class="chip ${c.status === 'cleared' ? 'cleared' : ''}" data-act="edit-cheque" data-id="${esc(c.id)}" style="background:${hex}26">
      <span class="stripe" style="background:${hex}"></span><span class="grow"><span class="who" dir="auto">${esc(c.recipient || '—')}</span>
      <span class="amt">${esc(C.moneyNumber(c.amountRials, k.unit))}</span>
      ${C.sharePart(c) ? `<span class="share"><bdi>${esc(c.shareName || 'Someone')}</bdi>: ${esc(C.moneyNumber(C.sharePart(c), k.unit))}${c.shareReceived ? ' ✓' : ''}</span>` : ''}</span>${mark}</button>`;
  };
  const add = (day, pharmacyID) => `<button class="add" data-act="new-cheque" data-due="${day.numeric}" data-pharmacy="${esc(pharmacyID || '')}" aria-label="Add cheque on ${day.formatted}">+</button>`;
  for (const r of rows) {
    const label = `<div class="day-label ${r.bankOpen ? '' : 'closed'}"><b>${r.day.d}</b><span>${C.WEEKDAYS[r.day.weekday]}</span></div>`;
    let cells;
    if (pharmacies.length) cells = r.sections.map((list, i) => `<div class="cell">${visible(list).map(chip).join('')}${add(r.day, pharmacies[i].id)}</div>`).join('');
    else cells = `<div class="cell">${visible(r.unassigned).map(chip).join('')}${add(r.day, null)}</div>`;
    const loose = pharmacies.length && visible(r.unassigned).length ? `<div class="cell loose"><div class="sub">No pharmacy</div>${visible(r.unassigned).map(chip).join('')}</div>` : '';
    html += `<div class="day-row ${r.day.equals(k.today) ? 'today' : ''}" id="d-${r.day.key}" style="${grid}">${label}${cells}${loose}</div>`;
  }
  return html;
}

function searchView(k) {
  let html = topbar({ back: true, title: 'Cheques', right: k.L.accounts.length ? `<button class="tb-btn" data-act="new-cheque">${ICON.plus}</button>` : '' });
  html += `<div class="seg">${['open', 'cleared', 'all'].map(f => `<button class="${state.filter === f ? 'on' : ''}" data-act="filter" data-filter="${f}">${f === 'open' ? 'Open' : f === 'cleared' ? 'Cleared' : 'All'}</button>`).join('')}</div>`;
  html += `<div class="group"><div class="card"><div class="field full"><input id="search" type="search" placeholder="Recipient or Sayad ID" value="${esc(state.search)}"></div></div></div>`;
  return html + `<div id="search-results">${searchResults(k)}</div>`;
}

function searchResults(k) {
  const q = C.normalizeDigits(state.search.trim()).toLowerCase();
  const list = k.L.cheques.filter(c => {
    if (state.filter === 'open' && !C.isOutstanding(c.status)) return false;
    if (state.filter === 'cleared' && c.status !== 'cleared') return false;
    return !q || (c.recipient || '').toLowerCase().includes(q) || (c.sayadID || '').includes(q);
  }).sort((a, b) => C.Day.parse(a.due).key - C.Day.parse(b.due).key);
  if (state.filter === 'cleared') list.reverse();
  if (!list.length) return '<div class="empty">No cheques here.</div>';
  const months = [];
  for (const c of list) {
    const title = C.Day.parse(c.due).monthTitle;
    if (!months.length || months[months.length - 1].title !== title) months.push({ title, items: [] });
    months[months.length - 1].items.push(c);
  }
  return months.map(m => group(`${m.title} · ${k.money(m.items.reduce((s, c) => s + c.amountRials, 0))}`, m.items.map(c => chequeRow(k, c)).join(''))).join('');
}

function planView(k, route) {
  const period = route.period;
  const p = C.periodPlan(period, k.data, k.L.pharmacies);
  let html = topbar({ back: true, title: period.isQuarter ? 'Quarter plan' : 'Month plan' });
  html += `<div class="seg"><button class="${period.isQuarter ? '' : 'on'}" data-act="plan-kind" data-kind="month">Month</button><button class="${period.isQuarter ? 'on' : ''}" data-act="plan-kind" data-kind="quarter">Quarter</button></div>`;
  html += group('', `<div class="row"><button class="tb-btn" data-act="plan-step" data-step="-1">${ICON.left}</button>
    <div class="grow" style="text-align:center"><div class="bold">${esc(period.title)}</div><div class="sub">${esc(period.start.formattedShort)} – ${esc(period.end.formatted)}</div></div>
    <button class="tb-btn" data-act="plan-step" data-step="1">${ICON.right}</button></div>`);
  html += group('', `<div class="row"><div class="grow bold">Still to pay</div><div class="value num">${esc(k.money(p.totalStillToPay))}</div></div>
    ${p.totalCashed ? `<div class="row"><div class="grow">Cashed so far</div><div class="value num">${esc(k.money(p.totalCashed))}</div></div>` : ''}
    <div class="row stack">${transferLine(k, p.totalTransfer, period.end)}${owedLine(k, p.owedByEnd)}</div>`,
  `Cheques marked Cleared drop out of “still to pay”; keep them, don't delete them. Transfer covers every uncashed cheque due by ${esc(period.end.formatted)}, including earlier ones, per account.`);
  html += group('Accounts', p.rows.map(r => `<div class="row"><span class="stripe" style="background:${C.colorOf(r.account)}"></span>
    <div class="grow"><div class="bold">${esc(C.accountName(r.account))}</div>
    <div class="sub">${r.openCount} to pay · ${esc(k.money(r.stillOpenInPeriod))}${r.cashedInPeriod ? ` · ${esc(k.money(r.cashedInPeriod))} cashed` : ''}</div>
    ${transferLine(k, r.transferByEnd, period.end)}${owedLine(k, r.owedByEnd)}</div></div>`).join('') || '<div class="row sub">No accounts</div>');
  if (k.L.pharmacies.length) {
    const loose = p.toPayByPharmacy.get(null);
    html += group('Still to pay by pharmacy', k.L.pharmacies.map(ph => `<div class="row"><div class="grow">${esc(ph.name)}</div><div class="value num">${esc(k.money(p.toPayByPharmacy.get(ph.id) || 0))}</div></div>`).join('')
      + (loose ? `<div class="row"><div class="grow">No pharmacy</div><div class="value num">${esc(k.money(loose))}</div></div>` : ''),
    'A shared part named after a pharmacy counts under that pharmacy.');
  }
  return html;
}

function accountsView(k) {
  let html = topbar({ right: `<button class="tb-btn" data-act="new-account" aria-label="Add account">${ICON.plus}</button>` }) + '<h1 class="large">Accounts</h1>';
  if (!k.accounts.length) return html + '<div class="empty">No accounts yet. Add every account you write cheques from, with its owner.</div>';
  return html + group('', k.accounts.map(a => `<div class="row link" role="button" data-act="push" data-route="account" data-id="${esc(a.id)}">
    <span class="stripe" style="background:${C.colorOf(a)}"></span>
    <div class="grow"><div class="bold">${esc(C.accountName(a))}</div>${a.number ? `<div class="sub num">${esc(a.number)}</div>` : ''}${balanceLine(k, k.summaries.get(a.id))}</div></div>`).join(''));
}

function accountView(k, route) {
  const a = k.account(route.id);
  if (!a) return topbar({ back: true }) + '<div class="empty">This account was deleted.</div>';
  const s = k.summaries.get(a.id);
  const b = s.balance;
  let html = topbar({ back: true, title: C.accountName(a), right: `<button class="tb-btn" data-act="edit-account" data-id="${esc(a.id)}">Edit</button>` });
  html += group('', `<div class="row stack">${statusLines(k, s)}</div>`);
  let balance = `<div class="row"><div class="grow">Available for cheques</div><div class="value num">${esc(k.money(b.available))}</div></div>`;
  if (b.base) balance += `<div class="row stack"><div style="display:flex"><div class="grow">Bank balance</div><div class="value num">${esc(k.money(b.base.amountRials))}</div></div>
    <div class="sub">Read ${esc(C.dateTime(new Date(b.base.enteredAt)))}${b.base.enteredBy ? ` by ${esc(b.base.enteredBy)}` : ''}</div></div>`;
  if (b.depositsSinceBase) balance += `<div class="row"><div class="grow">+ Deposits since</div><div class="value num">${esc(k.money(b.depositsSinceBase))}</div></div>`;
  if (b.clearedSinceBase) balance += `<div class="row"><div class="grow">− Cheques cleared since</div><div class="value num">${esc(k.money(b.clearedSinceBase))}</div></div>`;
  balance += `<button class="row action" data-act="new-entry" data-account="${esc(a.id)}" data-kind="bankBalance">Set balance from bank app</button>
    <button class="row action" data-act="new-entry" data-account="${esc(a.id)}" data-kind="deposit">Add deposit</button>`;
  html += group('Balance', balance, 'Set the balance whenever you check the bank app. Deposits add to it, and cheques marked Cleared after it are taken off it.');
  html += group('Open cheques', s.outstanding.map(c => chequeRow(k, c, { showAccount: false })).join('') || '<div class="row sub">None</div>');
  const entries = k.L.entries.filter(e => e.accountID === a.id).sort((x, y) => Date.parse(y.enteredAt) - Date.parse(x.enteredAt));
  html += group('Balance history', entries.map(e => `<div class="row" role="button" data-act="edit-entry" data-id="${esc(e.id)}">
    <div class="grow"><div>${esc(C.ENTRY_LABEL[e.kind])}</div><div class="sub">${esc(C.dateTime(new Date(e.enteredAt)))}${e.enteredBy ? ` · ${esc(e.enteredBy)}` : ''}</div>
    ${e.note ? `<div class="sub" dir="auto">${esc(e.note)}</div>` : ''}</div><div class="num">${e.kind === 'deposit' ? '+' : ''}${esc(k.money(e.amountRials))}</div></div>`).join('') || '<div class="row sub">Nothing entered yet</div>');
  html += group('Details', `<div class="row"><div class="grow">Bank</div><div class="value">${esc(a.bank)}</div></div>
    <div class="row"><div class="grow">Account number</div><div class="value num">${esc(a.number)}</div></div>
    <div class="row"><div class="grow">Owner</div><div class="value">${esc(a.owner)}</div></div>
    <div class="row"><div class="grow">Default pharmacy</div><div class="value">${esc(k.pharmacy(a.defaultPharmacyID)?.name || 'None')}</div></div>`);
  return html;
}

function settingsView(k) {
  const S = k.S;
  let html = topbar() + '<h1 class="large">Settings</h1>';
  html += group('You', `<div class="field"><label>Your name</label><input data-setting="userName" placeholder="e.g. Saba" value="${esc(S.userName)}"></div>`);
  html += group('Ledger', `<div class="row link" role="button" data-act="push" data-route="pharmacies"><div class="grow">Pharmacies</div><div class="value">${k.L.pharmacies.length}</div></div>`);
  const last = S.lastBackupAt ? C.dateTime(new Date(S.lastBackupAt)) : 'never';
  html += group('Backup', `<button class="row action" data-act="backup">Save a backup file</button>
    <button class="row action" data-act="restore">Restore from a backup file…</button>
    <button class="row action" data-act="export-csv">Export to Excel (CSV)</button>`,
  `Everything is stored only on this phone. Save a backup file every week or so, for example to Files or Telegram Saved Messages. Last backup: ${esc(last)}.`);
  html += group('Reminders', [30, 14, 7, 3, 2, 1].map(d => `<label class="field"><span style="flex:1">${d} day${d === 1 ? '' : 's'} before</span>
    <input type="checkbox" class="toggle" data-offset="${d}" ${S.offsets.includes(d) ? 'checked' : ''}></label>`).join(''),
  'Reminders appear on the Overview when you open the app. One is skipped when the balance already covers the cheque; the 2- and 1-day ones only if the balance was updated in the last 2 days.');
  html += group('Display', `<div class="field"><label>Amounts in</label><select data-setting="unit">
      <option value="rial" ${S.unit === 'rial' ? 'selected' : ''}>IRR</option><option value="toman" ${S.unit === 'toman' ? 'selected' : ''}>Toman</option></select></div>
    <div class="field"><label>Overview looks ahead</label><select data-setting="horizonDays">${[7, 14, 30, 45, 60, 90, 120].map(d => `<option value="${d}" ${S.horizonDays === d ? 'selected' : ''}>${d} days</option>`).join('')}</select></div>`);
  html += group('Banks closed on', [[C.THURSDAY, 'Thursday'], [C.FRIDAY, 'Friday']].map(([wd, name]) => `<label class="field"><span style="flex:1">${name}</span>
    <input type="checkbox" class="toggle" data-weekday="${wd}" ${S.closedWeekdays.includes(wd) ? 'checked' : ''}></label>`).join('')
    + `<div class="row link" role="button" data-act="push" data-route="holidays"><div class="grow">Bank holidays</div><div class="value">${k.L.holidays.length}</div></div>`,
  'Reminders and transfer deadlines move to the last day banks are open.');
  html += group('Install', `<div class="row stack"><div>${isStandalone() ? '✓ Installed on the Home Screen' : 'Not installed yet'}</div>
    <div class="sub">On iPhone: open this page in Safari, tap Share, then Add to Home Screen.</div></div>
    <div class="row"><div class="grow">Version</div><div class="value" id="app-version">…</div></div>`,
  'Updates arrive by themselves: open the app with internet on. If a change does not show, close the app fully and open it again.');
  return html;
}

function pharmaciesView(k) {
  let html = topbar({ back: true, title: 'Pharmacies', right: `<button class="tb-btn" data-act="add-pharmacy">${ICON.plus}</button>` });
  if (!k.L.pharmacies.length) return html + '<div class="empty">Add both pharmacies so every cheque can be filed under one.</div>';
  return html + group('', k.L.pharmacies.map(p => {
    const count = k.L.cheques.filter(c => c.pharmacyID === p.id).length;
    return `<div class="row"><div class="grow" role="button" data-act="rename-pharmacy" data-id="${esc(p.id)}">${esc(p.name)}<div class="sub">${count} cheques · tap to rename</div></div>
      <button class="red" data-act="delete-pharmacy" data-id="${esc(p.id)}">Delete</button></div>`;
  }).join(''), 'The month sheet shows one column per pharmacy, in this order.');
}

function holidaysView(k) {
  const year = k.today.y;
  let html = topbar({ back: true, title: 'Bank holidays', right: `<button class="tb-btn" data-act="new-holiday">${ICON.plus}</button>` });
  const list = [...k.L.holidays].sort((a, b) => C.Day.parse(a.date).key - C.Day.parse(b.date).key);
  html += group('', list.map(h => `<div class="row"><div class="grow">${esc(h.name || 'Holiday')}<div class="sub">${esc(C.Day.parse(h.date).formattedWithWeekday)}</div></div>
    <button class="red" data-act="delete-holiday" data-id="${esc(h.id)}">Delete</button></div>`).join('') || '<div class="row sub">None yet</div>',
  'Days banks are closed besides the weekly closed days. Lunar holidays move every year, so add them when the official calendar is out.');
  return html + group('', `<button class="row action" data-act="fixed-holidays" data-year="${year}">Add fixed national holidays for ${year}</button>
    <button class="row action" data-act="fixed-holidays" data-year="${year + 1}">Add fixed national holidays for ${year + 1}</button>`);
}

const VIEWS = { overview, month: monthView, accounts: accountsView, settings: settingsView, search: searchView, plan: planView, account: accountView, pharmacies: pharmaciesView, holidays: holidaysView };

// ---------- forms ----------

function datePicker(name, day) {
  const years = [];
  for (let y = day.y - 2; y <= day.y + 3; y++) years.push(y);
  const opts = (values, selected, label = v => v) => values.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${label(v)}</option>`).join('');
  return `<div class="date-picker">
    <select name="${name}-d" data-date="${name}">${opts(Array.from({ length: 31 }, (_, i) => i + 1), day.d)}</select>
    <select name="${name}-m" data-date="${name}">${opts(Array.from({ length: 12 }, (_, i) => i + 1), day.m, m => C.MONTHS[m - 1])}</select>
    <select name="${name}-y" data-date="${name}">${opts(years, day.y)}</select></div>`;
}

function readDate(form, name) {
  const y = +form[`${name}-y`].value, m = +form[`${name}-m`].value, d = +form[`${name}-d`].value;
  return C.Day.of(y, m, Math.min(d, C.daysInMonth(y, m)));
}

function amountField(label, rials, unit) {
  const value = rials != null ? C.editableMoney(rials, unit) : { text: '', unit };
  return `<div class="field"><label>${esc(label)}</label><input name="amount" inputmode="numeric" placeholder="0" value="${esc(value.text)}" data-amount class="num">
    <select name="unit" class="unit-select" data-amount><option value="rial" ${value.unit === 'rial' ? 'selected' : ''}>IRR</option><option value="toman" ${value.unit === 'toman' ? 'selected' : ''}>Toman</option></select></div>
    <div class="amount-preview sub num" id="amount-preview">${amountPreview(value.text, value.unit)}</div>`;
}

function amountPreview(text, unit) {
  if (!text) return '';
  const rials = C.parseMoney(text, unit);
  return rials == null ? '<span class="red">Digits only, no decimals</span>' : `${esc(C.money(rials, 'rial'))} · ${esc(C.money(rials, 'toman'))}`;
}

function dueNote(k, day) {
  if (!day) return '';
  let text = `${day.formattedWithWeekday}.`;
  if (!k.bank.isOpen(day)) text += ' Banks are closed that day.';
  return `${text} Money must be in by ${k.bank.lastOpenBefore(day).formattedWithWeekday}.`;
}

function modalShell(title, body, { save = 'Save', canDelete = false } = {}) {
  return `<div class="modal"><form id="modal-form" onsubmit="return false">
    ${topbar({ left: '<button type="button" class="tb-btn" data-act="modal-cancel">Cancel</button>', title, right: `<button type="button" class="tb-btn bold" data-act="modal-save">${save}</button>` })}
    <div style="height:8px"></div>${body}
    ${canDelete ? group('', '<button type="button" class="row danger" data-act="modal-delete">Delete</button>') : ''}</form></div>`;
}

function chequeModal(k, m) {
  const c = m.id ? k.L.cheques.find(x => x.id === m.id) : null;
  const due = c ? C.Day.parse(c.due) : (m.due ? C.Day.parse(m.due) : k.today);
  let accountID = c?.accountID || (k.accounts.length === 1 ? k.accounts[0].id : '');
  let pharmacyID = c ? c.pharmacyID : (m.pharmacyID || k.account(accountID)?.defaultPharmacyID || '');
  const recent = [...new Set([...k.L.cheques].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)).map(x => (x.recipient || '').trim()).filter(Boolean))].slice(0, 30);
  const body = group('', `<div class="field"><label>Account</label><select name="account" data-account-select><option value="">Choose…</option>
      ${k.accounts.map(a => `<option value="${esc(a.id)}" ${a.id === accountID ? 'selected' : ''}>${esc(C.accountName(a))}</option>`).join('')}</select></div>
    <div class="field"><label>Pharmacy</label><select name="pharmacy"><option value="">None</option>
      ${k.L.pharmacies.map(p => `<option value="${esc(p.id)}" ${p.id === pharmacyID ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Recipient</label><input name="recipient" dir="auto" list="recipients" placeholder="Name" value="${esc(c?.recipient || '')}"></div>
    <datalist id="recipients">${recent.map(r => `<option value="${esc(r)}">`).join('')}</datalist>`)
  + group('', amountField('Amount', c?.amountRials ?? null, k.unit) + `<div class="field"><label>Due date</label>${datePicker('due', due)}</div>`,
    `<span id="due-note">${esc(dueNote(k, due))}</span>`)
  + shareSection(k, c)
  + group('', `<div class="field"><label>Sayad ID</label><input name="sayad" inputmode="numeric" placeholder="16 digits" value="${esc(c?.sayadID || '')}" class="num" data-sayad></div>`,
    `<span id="sayad-note" class="orange"></span>`)
  + (c ? group('', `<div class="field"><label>Status</label><select name="status">${C.STATUSES.map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${C.STATUS_LABEL[s]}</option>`).join('')}</select></div>`,
    'Mark Cleared once it is cashed. Bounced cheques stay counted against the balance until cleared or cancelled.') : '')
  + group('', `<div class="field full"><textarea name="note" dir="auto" placeholder="Note">${esc(c?.note || '')}</textarea></div>`);
  return modalShell(c ? 'Edit cheque' : 'New cheque', body, { canDelete: !!c });
}

/// A cheque paid together with someone else (e.g. the other pharmacy): the full amount stays on the cheque,
/// their part is recorded here, and "paid in" adds their money to the account as a deposit.
function shareSection(k, c) {
  const share = c ? C.sharePart(c) : 0;
  const unit = c ? C.editableMoney(c.amountRials, k.unit).unit : k.unit;
  const shareText = share ? String(unit === 'toman' ? share / 10 : share) : '';
  const names = [...new Set([...k.L.cheques.map(x => (x.shareName || '').trim()), ...k.L.pharmacies.map(p => p.name)].filter(Boolean))];
  return group('Shared cost', `<div class="field"><label>Part paid by</label><input name="shareName" dir="auto" list="share-names" placeholder="Nobody" value="${esc(share ? c.shareName : '')}"></div>
    <datalist id="share-names">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="field"><label>Their part</label><input name="shareAmount" inputmode="numeric" class="num" placeholder="0" value="${esc(shareText)}" data-share></div>
    <div class="amount-preview sub num" id="share-preview"></div>
    <label class="field"><span style="flex:1">They have paid it in</span><input type="checkbox" class="toggle" name="shareReceived" ${c?.shareReceived ? 'checked' : ''}></label>`,
  'For a cheque shared with someone, e.g. Shadi or the other pharmacy. Enter the <b>full cheque</b> as Amount: the account still needs all of it. Their part uses the same unit as Amount. Turn on “paid in” when their money reaches this account; it is added to the balance.');
}

function accountModal(k, m) {
  const a = m.id ? k.account(m.id) : null;
  const color = a ? (a.colorIndex ?? C.stableColor(a.bank)) : C.suggestColor('', k.L.accounts);
  const body = group('', `<div class="field"><label>Bank</label><input name="bank" list="banks" placeholder="e.g. Melli" value="${esc(a?.bank || '')}" data-bank></div>
      <datalist id="banks">${COMMON_BANKS.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <div class="field"><label>Account number</label><input name="number" inputmode="numeric" class="num" placeholder="Number" value="${esc(a?.number || '')}"></div>
      <div class="field"><label>Owner</label><input name="owner" placeholder="Account holder" value="${esc(a?.owner || '')}" dir="auto"></div>`)
  + group('Color on the month sheet', `<input type="hidden" name="color" value="${color}"><div class="swatches">${C.COLORS.map((c, i) =>
    `<button type="button" class="swatch ${i === color ? 'on' : ''}" style="background:${c.hex}" data-act="pick-color" data-index="${i}" aria-label="${c.name}"></button>`).join('')}</div>`,
  'Accounts at the same bank start with the same color.')
  + group('', `<div class="field"><label>Default pharmacy</label><select name="pharmacy"><option value="">None</option>
      ${k.L.pharmacies.map(p => `<option value="${esc(p.id)}" ${p.id === a?.defaultPharmacyID ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`,
  'New cheques on this account start with this pharmacy selected.');
  return modalShell(a ? 'Edit account' : 'New account', body, { canDelete: !!a });
}

function entryModal(k, m) {
  const e = m.id ? k.L.entries.find(x => x.id === m.id) : null;
  const kind = e?.kind || m.entryKind || 'bankBalance';
  const at = e ? new Date(e.enteredAt) : new Date();
  const day = C.Day.fromDate(at);
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: C.TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  const body = `<input type="hidden" name="kind" value="${kind}"><div class="seg">${C.ENTRY_KINDS.map(x =>
    `<button type="button" class="${x === kind ? 'on' : ''}" data-act="pick-kind" data-kind="${x}">${C.ENTRY_LABEL[x]}</button>`).join('')}</div>`
  + group('', amountField(kind === 'bankBalance' ? 'Balance' : 'Deposit', e?.amountRials ?? null, k.unit)
    + `<div class="field"><label>Date</label>${datePicker('at', day)}</div><div class="field"><label>Time</label><input type="time" name="time" value="${hhmm}"></div>`,
  kind === 'bankBalance' ? 'The balance the bank app shows right now. It replaces earlier entries.' : 'Money moved into this account since the last bank balance.')
  + group('', `<div class="field full"><textarea name="note" dir="auto" placeholder="Note">${esc(e?.note || '')}</textarea></div>`);
  return modalShell(e ? 'Edit entry' : C.ENTRY_LABEL[kind], body, { canDelete: !!e });
}

function holidayModal(k) {
  return modalShell('New holiday', group('', `<div class="field"><label>Date</label>${datePicker('date', k.today)}</div>
    <div class="field"><label>Name</label><input name="holidayName" placeholder="Optional"></div>`));
}

const MODALS = { cheque: chequeModal, account: accountModal, entry: entryModal, holiday: holidayModal };

// ---------- rendering ----------

function currentRoute() {
  const stack = state.stacks[state.tab];
  return stack[stack.length - 1] || { name: state.tab };
}

function render({ keepScroll = true } = {}) {
  const y = window.scrollY;
  if (!store.hasLedger) { $app.innerHTML = onboarding(); return; }
  const k = calc();
  const route = currentRoute();
  const routeKey = `${state.tab}/${route.name}/${route.id || ''}/${route.name === 'month' ? state.month.id : ''}`;
  let html = VIEWS[route.name](k, route);
  html += `<nav class="tabbar">${[['overview', 'Overview', ICON.house], ['month', 'Month', ICON.calendar], ['accounts', 'Accounts', ICON.bank], ['settings', 'Settings', ICON.gear]]
    .map(([id, label, icon]) => `<button class="tab ${state.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon}<span>${label}</span></button>`).join('')}</nav>`;
  if (state.modal) html += MODALS[state.modal.kind](k, state.modal);
  $app.innerHTML = html;
  document.body.style.overflow = state.modal ? 'hidden' : '';

  const head = document.querySelector('.sheet-head');
  const bar = document.querySelector('.topbar');
  if (head && bar) {
    head.style.top = `${bar.offsetHeight}px`;
    const margin = `${bar.offsetHeight + head.offsetHeight}px`;
    document.querySelectorAll('.day-row').forEach(r => { r.style.scrollMarginTop = margin; });
  }
  if (routeKey !== state.lastRouteKey) {
    state.lastRouteKey = routeKey;
    window.scrollTo(0, 0);
    if (route.name === 'month' && state.month.contains(k.today) && params.get('screen') !== 'monthTop') {
      document.getElementById(`d-${k.today.key}`)?.scrollIntoView({ block: 'start' });
    }
  } else if (keepScroll) {
    window.scrollTo(0, y);
  }
  if (state.modal?.kind === 'cheque') updateSayadNote();
  const versionCell = document.getElementById('app-version');
  // The offline cache is named after the version (sw.js VERSION), so this shows which version the phone really has.
  if (versionCell && window.caches) {
    caches.keys().then(keys => {
      const v = keys.filter(key => key.startsWith('cheques-v')).map(key => +key.slice(9)).sort((a, b) => b - a)[0];
      versionCell.textContent = v ? String(v) : 'not saved for offline yet';
    });
  }
}

function updateSayadNote() {
  const form = document.getElementById('modal-form');
  const note = document.getElementById('sayad-note');
  if (!form || !note) return;
  const digits = C.sayadDigits(form.sayad.value);
  let text = '';
  if (digits && digits.length !== 16) text = `Sayad IDs have 16 digits; this has ${digits.length}.`;
  else if (digits && store.ledger.cheques.some(c => c.id !== state.modal.id && C.sayadDigits(c.sayadID) === digits)) text = 'Another cheque already has this Sayad ID.';
  note.textContent = text;
}

// ---------- actions ----------

function persistAndRender() { store.saveLedger(); state.modal = null; render(); }

async function shareFile(name, type, text) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

const stamp = () => C.Day.today().numeric.replace(/\//g, '-');

const ACTIONS = {
  tab(el) {
    const tab = el.dataset.tab;
    if (tab === state.tab) state.stacks[tab] = [];
    state.tab = tab;
    render();
  },
  push(el) {
    const route = { name: el.dataset.route, id: el.dataset.id };
    if (el.dataset.period) { const [kind, y, n] = el.dataset.period.split(':'); route.period = new C.Period(kind, +y, +n); }
    state.stacks[state.tab].push(route);
    render();
  },
  back() { state.stacks[state.tab].pop(); render(); },
  'month-prev'() { state.month = state.month.add(-1); render(); },
  'month-next'() { state.month = state.month.add(1); render(); },
  'month-today'() { state.month = C.Month.of(C.Day.today()); render(); },
  'toggle-cashed'() { store.settings.showCashed = !store.settings.showCashed; store.saveSettings(); render(); },
  filter(el) { state.filter = el.dataset.filter; render(); },
  'plan-kind'(el) {
    const route = currentRoute();
    const today = C.Day.today();
    const anchor = route.period.contains(today) ? today : route.period.start;
    route.period = el.dataset.kind === 'quarter' ? C.Period.quarterOf(anchor) : C.Period.monthOf(anchor);
    render();
  },
  'plan-step'(el) { const route = currentRoute(); route.period = route.period.add(+el.dataset.step); render(); },

  'new-cheque'(el) {
    if (!store.ledger.accounts.length) { alert('Add an account first.'); return; }
    state.modal = { kind: 'cheque', id: null, due: el.dataset.due, pharmacyID: el.dataset.pharmacy || null };
    render();
  },
  'edit-cheque'(el) { state.modal = { kind: 'cheque', id: el.dataset.id }; render(); },
  'new-account'() { state.modal = { kind: 'account', id: null }; render(); },
  'edit-account'(el) { state.modal = { kind: 'account', id: el.dataset.id }; render(); },
  'new-entry'(el) { state.modal = { kind: 'entry', id: null, accountID: el.dataset.account, entryKind: el.dataset.kind }; render(); },
  'edit-entry'(el) { const e = store.ledger.entries.find(x => x.id === el.dataset.id); state.modal = { kind: 'entry', id: e.id, accountID: e.accountID }; render(); },
  'new-holiday'() { state.modal = { kind: 'holiday' }; render(); },
  'modal-cancel'() { state.modal = null; render(); },
  'pick-color'(el) {
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s === el));
    document.querySelector('[name=color]').value = el.dataset.index;
    document.querySelector('[name=color]').dataset.touched = '1';
  },
  'pick-kind'(el) {
    document.querySelectorAll('[data-act=pick-kind]').forEach(b => b.classList.toggle('on', b === el));
    document.querySelector('[name=kind]').value = el.dataset.kind;
  },
  'modal-save'() { SAVE[state.modal.kind](document.getElementById('modal-form')); },
  'modal-delete'() { DELETE[state.modal.kind](); },

  start() {
    const name = document.getElementById('onboard-name').value.trim();
    if (!name) return;
    store.settings.userName = name;
    store.saveSettings();
    store.replaceLedger(newLedger());
    render();
  },
  async backup() {
    const ok = await shareFile(`cheques-backup-${stamp()}.json`, 'application/json', store.backupJSON());
    if (ok) { store.settings.lastBackupAt = nowISO(); store.saveSettings(); render(); }
  },
  restore() { document.getElementById('restore-file').click(); },
  async 'export-csv'() {
    await shareFile(`cheques-${stamp()}.csv`, 'text/csv', C.chequesCSV(store.ledger));
    await shareFile(`balances-${stamp()}.csv`, 'text/csv', C.balancesCSV(store.ledger));
  },
  'add-pharmacy'() {
    const name = (prompt('Pharmacy name') || '').trim();
    if (!name) return;
    store.ledger.pharmacies.push({ id: uid(), name, createdAt: nowISO() });
    persistAndRender();
  },
  'rename-pharmacy'(el) {
    const p = store.ledger.pharmacies.find(x => x.id === el.dataset.id);
    const name = (prompt('Pharmacy name', p.name) || '').trim();
    if (!name) return;
    p.name = name;
    persistAndRender();
  },
  'delete-pharmacy'(el) {
    const L = store.ledger;
    if (L.cheques.some(c => c.pharmacyID === el.dataset.id)) { alert('This pharmacy has cheques. Move them to the other pharmacy first.'); return; }
    if (!confirm('Delete this pharmacy?')) return;
    L.pharmacies = L.pharmacies.filter(p => p.id !== el.dataset.id);
    L.accounts.forEach(a => { if (a.defaultPharmacyID === el.dataset.id) a.defaultPharmacyID = null; });
    persistAndRender();
  },
  'delete-holiday'(el) { store.ledger.holidays = store.ledger.holidays.filter(h => h.id !== el.dataset.id); persistAndRender(); },
  'fixed-holidays'(el) {
    const existing = new Set(store.ledger.holidays.map(h => h.date));
    for (const h of C.fixedHolidays(+el.dataset.year)) {
      if (!existing.has(h.day.numeric)) store.ledger.holidays.push({ id: uid(), date: h.day.numeric, name: h.name });
    }
    persistAndRender();
  },
};

/// When someone's shared part is paid in, it is a deposit on the cheque's account. Kept in step with the cheque:
/// added when ticked, updated if the amount or account changes, removed if unticked.
function syncShareDeposit(L, c) {
  const existing = c.shareDepositID ? L.entries.find(e => e.id === c.shareDepositID) : null;
  if (!c.shareReceived) {
    if (existing) L.entries = L.entries.filter(e => e.id !== existing.id);
    c.shareDepositID = null;
    return;
  }
  const fields = { accountID: c.accountID, kind: 'deposit', amountRials: c.shareAmountRials, note: `${c.shareName}'s part of the cheque to ${c.recipient || 'a supplier'}` };
  if (existing) {
    Object.assign(existing, fields);
  } else {
    const entry = { id: uid(), ...fields, enteredAt: nowISO(), enteredBy: store.settings.userName };
    L.entries.push(entry);
    c.shareDepositID = entry.id;
  }
}

const SAVE = {
  cheque(f) {
    const amount = C.parseMoney(f.amount.value, f.unit.value);
    if (!f.account.value) { alert('Choose the account this cheque is drawn on.'); return; }
    if (!amount) { alert('Enter the amount in digits.'); return; }
    const shareName = f.shareName.value.trim();
    const shareText = f.shareAmount.value.trim();
    const share = shareText ? C.parseMoney(shareText, f.unit.value) : 0;
    if (share == null) { alert('Enter their part in digits.'); return; }
    if (share && !shareName) { alert('Who pays that part? Enter a name, e.g. Shadi.'); return; }
    if (shareName && !share) { alert(`Enter how much ${shareName} pays.`); return; }
    if (share >= amount) { alert('Their part must be less than the full cheque amount.'); return; }
    const due = readDate(f, 'due');
    const L = store.ledger;
    let c = state.modal.id ? L.cheques.find(x => x.id === state.modal.id) : null;
    if (!c) {
      c = { id: uid(), status: 'open', statusChangedAt: null, createdAt: nowISO(), createdBy: store.settings.userName };
      L.cheques.push(c);
    } else if (f.status && f.status.value !== c.status) {
      c.status = f.status.value;
      c.statusChangedAt = nowISO();
    }
    Object.assign(c, {
      accountID: f.account.value, pharmacyID: f.pharmacy.value || null, recipient: f.recipient.value.trim(),
      amountRials: amount, due: due.numeric, sayadID: C.sayadDigits(f.sayad.value), note: f.note.value.trim(),
      shareName: share ? shareName : '', shareAmountRials: share || 0, shareReceived: !!share && f.shareReceived.checked,
    });
    syncShareDeposit(L, c);
    persistAndRender();
  },
  account(f) {
    const bank = f.bank.value.trim();
    if (!bank) { alert('Enter the bank name.'); return; }
    const L = store.ledger;
    let a = state.modal.id ? L.accounts.find(x => x.id === state.modal.id) : null;
    if (!a) { a = { id: uid(), createdAt: nowISO() }; L.accounts.push(a); }
    Object.assign(a, { bank, number: C.normalizeDigits(f.number.value.trim()), owner: f.owner.value.trim(), colorIndex: +f.color.value, defaultPharmacyID: f.pharmacy.value || null });
    persistAndRender();
  },
  entry(f) {
    const kind = f.kind.value;
    const amount = C.parseMoney(f.amount.value, f.unit.value);
    if (amount == null || (kind === 'deposit' && amount <= 0)) { alert('Enter the amount in digits.'); return; }
    const day = readDate(f, 'at');
    const [hh, mm] = (f.time.value || '12:00').split(':').map(Number);
    const L = store.ledger;
    let e = state.modal.id ? L.entries.find(x => x.id === state.modal.id) : null;
    if (!e) { e = { id: uid(), accountID: state.modal.accountID, enteredBy: store.settings.userName }; L.entries.push(e); }
    Object.assign(e, { kind, amountRials: amount, enteredAt: day.at(hh, mm).toISOString(), note: f.note.value.trim() });
    persistAndRender();
  },
  holiday(f) {
    store.ledger.holidays.push({ id: uid(), date: readDate(f, 'date').numeric, name: f.holidayName.value.trim() });
    persistAndRender();
  },
};

const DELETE = {
  cheque() {
    if (!confirm('Delete this cheque? If it was cashed, mark it Cleared instead.')) return;
    store.ledger.cheques = store.ledger.cheques.filter(c => c.id !== state.modal.id);
    persistAndRender();
  },
  account() {
    const L = store.ledger;
    if (L.cheques.some(c => c.accountID === state.modal.id)) { alert('This account has cheques. Delete them or move them to another account first.'); return; }
    if (!confirm('Delete this account and its balance history?')) return;
    L.accounts = L.accounts.filter(a => a.id !== state.modal.id);
    L.entries = L.entries.filter(e => e.accountID !== state.modal.id);
    state.stacks[state.tab] = state.stacks[state.tab].filter(r => r.id !== state.modal.id);
    persistAndRender();
  },
  entry() {
    if (!confirm('Delete this entry?')) return;
    store.ledger.entries = store.ledger.entries.filter(e => e.id !== state.modal.id);
    persistAndRender();
  },
};

// ---------- events ----------

document.addEventListener('click', event => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const action = ACTIONS[el.dataset.act];
  if (action) { event.preventDefault(); action(el); }
});

document.addEventListener('input', event => {
  const t = event.target;
  if (t.id === 'onboard-name') {
    store.settings.userName = t.value;
    store.saveSettings();
    const btn = document.getElementById('start-btn');
    btn.disabled = !t.value.trim();
    btn.style.opacity = t.value.trim() ? '' : '.4';
  } else if (t.id === 'search') {
    state.search = t.value;
    document.getElementById('search-results').innerHTML = searchResults(calc());
  } else if (t.dataset.amount !== undefined || t.dataset.share !== undefined) {
    const f = t.form;
    document.getElementById('amount-preview').innerHTML = amountPreview(f.amount.value, f.unit.value);
    const sharePreview = document.getElementById('share-preview');
    if (sharePreview && f.shareAmount) {
      const share = C.parseMoney(f.shareAmount.value, f.unit.value);
      const total = C.parseMoney(f.amount.value, f.unit.value);
      sharePreview.innerHTML = !f.shareAmount.value ? '' : share == null ? '<span class="red">Digits only</span>'
        : `${esc(C.money(share, 'rial'))}${total && share < total ? ` · your part ${esc(C.money(total - share, 'rial'))}` : ''}`;
    }
  } else if (t.dataset.sayad !== undefined) {
    updateSayadNote();
  }
});

document.addEventListener('change', event => {
  const t = event.target;
  if (t.dataset.setting) {
    const key = t.dataset.setting;
    store.settings[key] = key === 'horizonDays' ? +t.value : t.value;
    store.saveSettings();
    if (key !== 'userName') render();
  } else if (t.dataset.offset) {
    const d = +t.dataset.offset;
    const set = new Set(store.settings.offsets);
    if (t.checked) set.add(d); else set.delete(d);
    store.settings.offsets = [...set].sort((a, b) => b - a);
    store.saveSettings();
  } else if (t.dataset.weekday) {
    const wd = +t.dataset.weekday;
    const set = new Set(store.settings.closedWeekdays);
    if (t.checked) set.add(wd); else set.delete(wd);
    store.settings.closedWeekdays = [...set];
    store.saveSettings();
  } else if (t.dataset.date === 'due') {
    const note = document.getElementById('due-note');
    if (note) note.textContent = dueNote(calc(), readDate(t.form, 'due'));
  } else if (t.dataset.amount !== undefined) {
    document.getElementById('amount-preview').innerHTML = amountPreview(t.form.amount.value, t.form.unit.value);
  } else if (t.dataset.accountSelect !== undefined) {
    const account = store.ledger.accounts.find(a => a.id === t.value);
    if (account?.defaultPharmacyID && !t.form.pharmacy.value) t.form.pharmacy.value = account.defaultPharmacyID;
  } else if (t.dataset.bank !== undefined || t.name === 'bank') {
    const color = t.form.color;
    if (color && !color.dataset.touched && !state.modal.id) {
      const index = C.suggestColor(t.value, store.ledger.accounts);
      color.value = index;
      document.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('on', i === index));
    }
  } else if (t.id === 'restore-file' && t.files[0]) {
    restoreFrom(t.files[0]);
    t.value = '';
  }
});

async function restoreFrom(file) {
  try {
    const data = C.validateBackup(JSON.parse(await file.text()));
    const when = data.exportedAt ? C.dateTime(new Date(data.exportedAt)) : 'an unknown date';
    const replacing = store.hasLedger && (store.ledger.cheques.length || store.ledger.accounts.length);
    const question = replacing
      ? `Replace everything on this phone with the backup from ${when}?\n${C.backupSummary(data)}.\nWhat is on this phone now is deleted.`
      : `Restore the backup from ${when}?\n${C.backupSummary(data)}.`;
    if (!confirm(question)) return;
    const { settings, ...ledger } = data;
    store.replaceLedger(ledger);
    if (!store.settings.userName) { store.settings.userName = 'Me'; store.saveSettings(); }
    state.stacks = { overview: [], month: [], accounts: [], settings: [] };
    render();
  } catch (error) {
    alert(error instanceof SyntaxError ? 'This file is not a cheque backup.' : error.message);
  }
}

navigator.storage?.persist?.();
render();
