// Cheque logic, ported from ChequeCore (Swift). Same rules, same numbers, same text.
// Persian calendar comes from Intl (the same ICU data iOS uses), pinned to Tehran time.

export const TZ = 'Asia/Tehran';
const TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000; // Iran has had no daylight saving since 2022
const DAY_MS = 86400000;

export const MONTHS = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const FRIDAY = 5;
export const THURSDAY = 4;

const partsFormat = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

function persianParts(date) {
  const parts = {};
  for (const { type, value } of partsFormat.formatToParts(date)) parts[type] = value;
  return { y: parseInt(parts.year, 10), m: parseInt(parts.month, 10), d: parseInt(parts.day, 10) };
}

const pad = (n, width) => String(n).padStart(width, '0');

/// A calendar day in the Persian calendar.
export class Day {
  constructor(y, m, d) { this.y = y; this.m = m; this.d = d; Object.freeze(this); }

  static of(y, m, d) {
    if (!(m >= 1 && m <= 12) || d < 1 || d > daysInMonth(y, m)) return null;
    return new Day(y, m, d);
  }

  static fromDate(date) { const p = persianParts(date); return new Day(p.y, p.m, p.d); }
  static today(now = new Date()) { return Day.fromDate(now); }

  /// "1405/09/21", Persian digits accepted.
  static parse(text) {
    if (typeof text !== 'string') return null;
    const parts = normalizeDigits(text).split('/');
    if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) return null;
    return Day.of(+parts[0], +parts[1], +parts[2]);
  }

  /// The instant `hour:minute` Tehran time on this day.
  at(hour = 12, minute = 0) { return new Date(gregorianNoonUTC(this.y, this.m, this.d) - 12 * 3600000 + hour * 3600000 + minute * 60000); }
  get date() { return this.at(12); }
  get key() { return this.y * 10000 + this.m * 100 + this.d; }
  addDays(n) { return Day.fromDate(new Date(this.date.getTime() + n * DAY_MS)); }
  daysUntil(other) { return Math.round((other.date.getTime() - this.date.getTime()) / DAY_MS); }
  get weekday() { return this.date.getUTCDay(); } // noon Tehran is the same Gregorian day in UTC
  get monthName() { return MONTHS[this.m - 1]; }
  equals(other) { return other != null && this.key === other.key; }
  compare(other) { return this.key - other.key; }

  get formatted() { return `${this.d} ${this.monthName} ${this.y}`; }
  get formattedShort() { return `${this.d} ${this.monthName}`; }
  get formattedWithWeekday() { return `${WEEKDAYS[this.weekday]} ${this.formatted}`; }
  get monthTitle() { return `${this.monthName} ${this.y}`; }
  get numeric() { return `${pad(this.y, 4)}/${pad(this.m, 2)}/${pad(this.d, 2)}`; }
  get gregorianISO() { return this.date.toISOString().slice(0, 10); }
  toString() { return this.numeric; }

  relative(today) {
    const n = today.daysUntil(this);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 1 ? `in ${n} days` : `${-n} days ago`;
  }
}

/// UTC milliseconds of noon Tehran on a Persian date. Estimates from Nowruz, then corrects against Intl.
function gregorianNoonUTC(y, m, d) {
  const dayOfYear = (m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30) + d;
  let t = Date.UTC(y + 621, 2, 21, 12) - TEHRAN_OFFSET_MS + (dayOfYear - 1) * DAY_MS;
  for (let i = 0; i < 6; i++) {
    const p = persianParts(new Date(t));
    const diff = (y - p.y) * 400 + (m - p.m) * 32 + (d - p.d);
    if (diff === 0) return t;
    t += Math.sign(diff) * DAY_MS;
  }
  return t;
}

const monthLengthCache = new Map();
export function daysInMonth(y, m) {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  if (!monthLengthCache.has(y)) {
    const after29 = persianParts(new Date(gregorianNoonUTC(y, 12, 29) + DAY_MS));
    monthLengthCache.set(y, after29.m === 12 ? 30 : 29);
  }
  return monthLengthCache.get(y);
}

/// "23 Aban 1405, 14:05" in Tehran time.
export function dateTime(date) {
  return `${Day.fromDate(date).formatted}, ${timeFormat.format(date)}`;
}

// ---------- Months and quarters ----------

export class Month {
  constructor(y, m) { const i = y * 12 + (m - 1); this.y = Math.floor(i / 12); this.m = i % 12 + 1; Object.freeze(this); }
  static of(day) { return new Month(day.y, day.m); }
  get title() { return `${MONTHS[this.m - 1]} ${this.y}`; }
  get id() { return this.y * 100 + this.m; }
  get days() { const out = []; for (let d = 1; d <= daysInMonth(this.y, this.m); d++) out.push(new Day(this.y, this.m, d)); return out; }
  add(n) { return new Month(this.y, this.m + n); }
  contains(day) { return day.y === this.y && day.m === this.m; }
  equals(other) { return other != null && this.id === other.id; }
}

export class Period {
  constructor(kind, y, n) { this.kind = kind; this.y = y; this.n = n; Object.freeze(this); } // month: n = 1..12, quarter: n = 1..4
  static monthOf(day) { return new Period('month', day.y, day.m); }
  static quarterOf(day) { return new Period('quarter', day.y, Math.floor((day.m - 1) / 3) + 1); }
  get isQuarter() { return this.kind === 'quarter'; }
  get months() {
    if (this.kind === 'month') return [new Month(this.y, this.n)];
    const first = new Month(this.y, (this.n - 1) * 3 + 1);
    return [first, first.add(1), first.add(2)];
  }
  get start() { return this.months[0].days[0]; }
  get end() { const ms = this.months; const days = ms[ms.length - 1].days; return days[days.length - 1]; }
  get title() {
    if (this.kind === 'month') return this.months[0].title;
    const names = this.months.map(mo => MONTHS[mo.m - 1]);
    return `Q${this.n} ${this.y} (${names[0]}–${names[2]})`;
  }
  add(count) {
    if (this.kind === 'month') { const mo = new Month(this.y, this.n + count); return new Period('month', mo.y, mo.m); }
    const i = this.y * 4 + (this.n - 1) + count;
    return new Period('quarter', Math.floor(i / 4), i % 4 + 1);
  }
  contains(day) { return day.key >= this.start.key && day.key <= this.end.key; }
}

// ---------- Money ----------

export function normalizeDigits(text) {
  return String(text).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660));
}

export const UNITS = { rial: { label: 'IRR', per: 1 }, toman: { label: 'Toman', per: 10 } };

export function grouped(n) {
  const neg = n < 0;
  const digits = String(Math.abs(Math.trunc(n)));
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function moneyNumber(rials, unit) {
  if (unit === 'toman') {
    const whole = Math.trunc(rials / 10);
    const rem = Math.abs(rials % 10);
    const sign = rials < 0 && whole === 0 ? '-' : '';
    return sign + grouped(whole) + (rem === 0 ? '' : `.${rem}`);
  }
  return grouped(rials);
}

export function money(rials, unit) { return `${moneyNumber(rials, unit)} ${UNITS[unit].label}`; }

/// What someone typed, in `unit`, as rials. Persian digits and separators accepted; decimals and signs rejected.
export function parseMoney(text, unit) {
  const cleaned = normalizeDigits(text).replace(/[,_'٬،   ]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned) * UNITS[unit].per;
  return Number.isSafeInteger(value) ? value : null;
}

export function editableMoney(rials, preferred) {
  if (preferred === 'toman' && rials % 10 === 0) return { text: String(rials / 10), unit: 'toman' };
  return { text: String(rials), unit: 'rial' };
}

// ---------- Statuses ----------

export const STATUSES = ['open', 'cleared', 'bounced', 'cancelled'];
export const STATUS_LABEL = { open: 'Open', cleared: 'Cleared', bounced: 'Bounced', cancelled: 'Cancelled' };
export const isOutstanding = status => status === 'open' || status === 'bounced';

/// The part of a cheque someone else pays (a purchase shared with the other pharmacy, say). The account still has to
/// hold the full amount; this only says how much of it should come from them.
export const sharePart = c => (c.shareAmountRials > 0 ? c.shareAmountRials : 0);
export const shareOwed = c => (isOutstanding(c.status) && !c.shareReceived ? sharePart(c) : 0);

/// Unpaid shares added up per person, e.g. Map { 'Shadi' => 200000000 }.
export function owedByName(cheques) {
  const byName = new Map();
  for (const c of cheques) {
    const owed = shareOwed(c);
    if (!owed) continue;
    const name = (c.shareName || '').trim() || 'Someone';
    byName.set(name, (byName.get(name) || 0) + owed);
  }
  return byName;
}

/// The date on the cheque someone gives for their part, or null (no date entered: a transfer, or not known yet).
export const shareDueDay = c => (sharePart(c) && c.shareDue ? Day.parse(c.shareDue) : null);

/// Dates of the cheques people give for their unpaid parts, per person, e.g. Map { 'Shadi' => [15 Azar] }.
export function owedChequeDays(cheques) {
  const byName = new Map();
  for (const c of cheques) {
    const day = shareOwed(c) ? shareDueDay(c) : null;
    if (!day) continue;
    const name = (c.shareName || '').trim() || 'Someone';
    const days = byName.get(name) || [];
    if (!days.some(d => d.equals(day))) days.push(day);
    byName.set(name, days.sort((a, b) => a.key - b.key));
  }
  return byName;
}
export const ENTRY_KINDS = ['bankBalance', 'deposit'];
export const ENTRY_LABEL = { bankBalance: 'Balance from bank', deposit: 'Deposit' };

export function accountName(account) {
  const bank = account.bank || 'Account';
  return account.owner ? `${bank} · ${account.owner}` : bank;
}

// ---------- Bank days ----------

export class BankCalendar {
  constructor(closedWeekdays = [FRIDAY], holidayKeys = []) {
    this.closed = new Set(closedWeekdays);
    this.holidays = new Set(holidayKeys);
  }
  isOpen(day) { return !this.closed.has(day.weekday) && !this.holidays.has(day.key); }
  openOnOrBefore(day) {
    let c = day;
    for (let i = 0; i < 60; i++) { if (this.isOpen(c)) return c; c = c.addDays(-1); }
    return day;
  }
  lastOpenBefore(day) { return this.openOnOrBefore(day.addDays(-1)); }
}

// ---------- Coverage ----------

const time = iso => (iso ? Date.parse(iso) : -Infinity);

/// Available = last bank balance + deposits after it − cheques marked cleared after it.
export function balanceOf(entries, cheques) {
  const byTime = [...entries].sort((a, b) => time(a.enteredAt) - time(b.enteredAt));
  const bankEntries = byTime.filter(e => e.kind === 'bankBalance');
  const base = bankEntries.length ? bankEntries[bankEntries.length - 1] : null;
  const latest = byTime.length ? byTime[byTime.length - 1] : null;
  const since = base ? time(base.enteredAt) : (byTime.length ? time(byTime[0].enteredAt) : null);
  const deposits = entries
    .filter(e => e.kind === 'deposit' && (!base || time(e.enteredAt) > time(base.enteredAt)))
    .reduce((s, e) => s + e.amountRials, 0);
  const cleared = since == null ? 0 : cheques
    .filter(c => c.status === 'cleared' && time(c.statusChangedAt) > since)
    .reduce((s, c) => s + c.amountRials, 0);
  return {
    available: (base ? base.amountRials : 0) + deposits - cleared,
    base, depositsSinceBase: deposits, clearedSinceBase: cleared, latest,
    lastUpdated: latest ? new Date(latest.enteredAt) : null,
  };
}

const chequeOrder = (a, b) =>
  (Day.parse(a.due).key - Day.parse(b.due).key) || (time(a.createdAt) - time(b.createdAt)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function ordered(cheques) { return cheques.filter(c => isOutstanding(c.status)).sort(chequeOrder); }

/// Each cheque is covered only if the balance covers it and every outstanding cheque due before it.
export function coverOf(cheques, available) {
  let running = 0;
  const out = new Map();
  for (const c of ordered(cheques)) {
    running += c.amountRials;
    out.set(c.id, { runningTotal: running, shortfall: Math.max(0, running - available), covered: running <= available });
  }
  return out;
}

export function transferDeadline(due, today, bank) {
  const d = bank.lastOpenBefore(due);
  return d.key < today.key ? today : d;
}

export function summarize(account, entries, cheques, today, horizonDays, bank) {
  const balance = balanceOf(entries, cheques);
  const outstanding = ordered(cheques);
  const cover = coverOf(outstanding, balance.available);
  const horizonEnd = today.addDays(horizonDays);
  const inHorizon = outstanding.filter(c => Day.parse(c.due).key <= horizonEnd.key);
  const shortfallInHorizon = Math.max(0, ...inHorizon.map(c => cover.get(c.id).shortfall));
  const last = outstanding[outstanding.length - 1];
  const totalShortfall = last ? cover.get(last.id).shortfall : 0;
  const firstGap = outstanding.find(c => !cover.get(c.id).covered) || null;
  let status = 'covered';
  if (!outstanding.length) status = 'none';
  else if (shortfallInHorizon > 0) status = 'short';
  else if (totalShortfall > 0) status = 'coveredForHorizon';
  return {
    account, balance, outstanding, cover, horizonEnd, shortfallInHorizon, totalShortfall, firstGap,
    owedInHorizon: owedByName(inHorizon), owedDaysInHorizon: owedChequeDays(inHorizon),
    outstandingTotal: outstanding.reduce((s, c) => s + c.amountRials, 0),
    overdue: outstanding.filter(c => c.status === 'bounced' || Day.parse(c.due).key < today.key),
    transferBy: firstGap ? transferDeadline(Day.parse(firstGap.due), today, bank) : null,
    status,
  };
}

// ---------- Reminders (shown in the app, worked out with the same rules as the iPhone notifications) ----------

export const DEFAULT_REMINDERS = { offsets: [30, 7, 2, 1], hour: 9, minute: 0, lateOffsetDays: 2, freshnessHours: 48, overdueRepeatDays: 3 };

export function planReminders(accountsData, now, settings, bank, unit) {
  const s = { ...DEFAULT_REMINDERS, ...settings };
  const today = Day.today(now);
  const reminders = [];
  for (const { account, entries, cheques } of accountsData) {
    const balance = balanceOf(entries, cheques);
    const outstanding = ordered(cheques);
    const cover = coverOf(outstanding, balance.available);
    const buckets = new Map(); // day key -> Map(chequeId -> kind)
    const rank = { confirmBalance: 0, shortfall: 1, overdue: 2 };
    const add = (day, id, kind) => {
      if (!buckets.has(day.key)) buckets.set(day.key, { day, kinds: new Map() });
      const kinds = buckets.get(day.key).kinds;
      if (!kinds.has(id) || rank[kinds.get(id)] < rank[kind]) kinds.set(id, kind);
    };
    for (const c of outstanding) {
      const cv = cover.get(c.id);
      const due = Day.parse(c.due);
      if (c.status === 'bounced' || due.key < today.key) {
        if (c.status !== 'bounced' && cv.covered) continue;
        let candidate = today;
        let added = 0;
        while (added < s.overdueRepeatDays) {
          if (candidate.at(s.hour, s.minute) > now) { add(candidate, c.id, 'overdue'); added++; }
          candidate = candidate.addDays(1);
        }
        continue;
      }
      for (const offset of new Set(s.offsets)) {
        if (offset <= 0) continue;
        const day = bank.openOnOrBefore(due.addDays(-offset));
        const fire = day.at(s.hour, s.minute);
        if (fire <= now) continue;
        if (cv.covered) {
          if (offset > s.lateOffsetDays) continue;
          if (balance.lastUpdated && (fire - balance.lastUpdated) <= s.freshnessHours * 3600000) continue;
          add(day, c.id, 'confirmBalance');
        } else {
          add(day, c.id, 'shortfall');
        }
      }
    }
    const byId = new Map(outstanding.map(c => [c.id, c]));
    for (const { day, kinds } of buckets.values()) {
      reminders.push(makeReminder(account, day, kinds, byId, cover, balance, s, bank, unit));
    }
    // Someone's cheque for their part: from its date, every day until "paid in" is on. Also after the shared cheque
    // itself is cashed, since their money still has to reach the account.
    for (const c of cheques) {
      const due = shareDueDay(c);
      if (!due || c.shareReceived || c.status === 'cancelled') continue;
      let day = due.key > today.key ? due : today;
      for (let added = 0; added < s.overdueRepeatDays; day = day.addDays(1)) {
        const fire = day.at(s.hour, s.minute);
        if (fire <= now) continue;
        reminders.push(shareChequeReminder(account, day, fire, c, due, unit));
        added++;
      }
    }
  }
  return reminders.sort((a, b) => (a.fireDate - b.fireDate) || (a.id < b.id ? -1 : 1));
}

function makeReminder(account, day, kinds, byId, cover, balance, s, bank, unit) {
  const fire = day.at(s.hour, s.minute);
  const items = [...kinds].filter(([id]) => byId.has(id)).map(([id, kind]) => ({ cheque: byId.get(id), kind }))
    .sort((a, b) => chequeOrder(a.cheque, b.cheque));
  const rank = { confirmBalance: 0, shortfall: 1, overdue: 2 };
  const kind = items.reduce((k, i) => (rank[i.kind] > rank[k] ? i.kind : k), 'confirmBalance');
  const shortfall = Math.max(0, ...items.map(i => cover.get(i.cheque.id).shortfall));
  const lines = [];
  const overdue = items.filter(i => i.kind === 'overdue').map(i => i.cheque);
  const upcoming = items.filter(i => i.kind !== 'overdue').map(i => i.cheque);
  if (overdue.length) lines.push(`${overdue.every(c => c.status === 'bounced') ? 'Bounced' : 'Past due'}: ${describe(overdue, unit)}.`);
  if (upcoming.length) lines.push(`Due ${dueRange(upcoming)}: ${describe(upcoming, unit)}.`);
  const owed = owedByName(items.map(i => i.cheque));
  const owedDays = owedChequeDays(items.map(i => i.cheque));
  if (owed.size) lines.push(`Of this, ${[...owed].map(([name, amount]) => `⁨${name}⁩ still owes ${money(amount, unit)}${chequeOnText(owedDays.get(name))}`).join(' and ')}.`);
  let title;
  if (shortfall > 0) {
    const amount = money(shortfall, unit);
    const gap = items.map(i => i.cheque).find(c => !cover.get(c.id).covered);
    let deadline = day;
    if (gap && gap.status !== 'bounced' && Day.parse(gap.due).key > day.key) deadline = transferDeadline(Day.parse(gap.due), day, bank);
    lines.push(deadline.equals(day) ? `Short ${amount} — transfer today.` : `Short ${amount} — transfer by ${deadline.formattedWithWeekday}.`);
    title = `${accountName(account)} — short ${amount}`;
  } else if (kind === 'overdue') {
    lines.push('The balance covers it now. Mark it cleared once it is cashed.');
    title = `${accountName(account)} — bounced cheque`;
  } else {
    const age = balance.lastUpdated ? ageText(balance.lastUpdated, fire) : 'never';
    lines.push(`Covered by a balance updated ${age}. Confirm the money is still there.`);
    title = `${accountName(account)} — confirm balance`;
  }
  return { id: `${account.id}.${day.key}`, accountID: account.id, day, fireDate: fire, kind, chequeIDs: items.map(i => i.cheque.id), title, body: lines.join('\n') };
}

/// " (cheque on 15 Azar)", or nothing when no date was entered.
export const chequeOnText = days => (days && days.length ? ` (cheque on ${days.map(d => d.formattedShort).join(', ')})` : '');

function shareChequeReminder(account, day, fire, c, due, unit) {
  const name = (c.shareName || '').trim() || 'Someone';
  const what = c.recipient ? `the cheque to ⁨${c.recipient}⁩` : 'the shared cheque';
  return {
    id: `${account.id}.${day.key}.share.${c.id}`, accountID: account.id, day, fireDate: fire, kind: 'shareCheque', chequeIDs: [c.id],
    title: `${accountName(account)} — ⁨${name}⁩'s cheque`,
    body: `⁨${name}⁩'s cheque for ${money(sharePart(c), unit)} is dated ${due.formattedShort}: their part of ${what}.\n`
      + `Deposit it into this account. When the money is in, open ${what} and turn on “They have paid it in”.`,
  };
}

function describe(cheques, unit) {
  const total = cheques.reduce((s, c) => s + c.amountRials, 0);
  // The name is wrapped in Unicode isolates so a Persian name can't pull the amount after it into right-to-left order.
  if (cheques.length === 1 && cheques[0].recipient) return `cheque to ⁨${cheques[0].recipient}⁩, ${money(total, unit)}`;
  return `${cheques.length} cheque${cheques.length === 1 ? '' : 's'}, ${money(total, unit)}`;
}

function dueRange(cheques) {
  const days = cheques.map(c => Day.parse(c.due)).sort((a, b) => a.key - b.key);
  const first = days[0];
  const last = days[days.length - 1];
  if (first.equals(last)) return first.formattedShort;
  if (first.y === last.y && first.m === last.m) return `${first.d}–${last.d} ${first.monthName}`;
  return `${first.formattedShort} – ${last.formattedShort}`;
}

function ageText(start, end) {
  const days = Math.floor((end - start) / DAY_MS);
  if (days < 1) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// ---------- Month sheet and period plan ----------

export function monthRows(month, cheques, pharmacyIDs, bank) {
  const column = new Map(pharmacyIDs.map((id, i) => [id, i]));
  const byDay = new Map();
  for (const c of cheques) {
    if (c.status === 'cancelled') continue;
    const due = Day.parse(c.due);
    if (!due || !month.contains(due)) continue;
    if (!byDay.has(due.key)) byDay.set(due.key, []);
    byDay.get(due.key).push(c);
  }
  return month.days.map(day => {
    const sections = pharmacyIDs.map(() => []);
    const unassigned = [];
    const list = (byDay.get(day.key) || []).sort((a, b) => (time(a.createdAt) - time(b.createdAt)) || (a.id < b.id ? -1 : 1));
    for (const c of list) {
      if (c.pharmacyID && column.has(c.pharmacyID)) sections[column.get(c.pharmacyID)].push(c);
      else unassigned.push(c);
    }
    const total = list.reduce((s, c) => s + c.amountRials, 0);
    const open = list.filter(c => isOutstanding(c.status)).reduce((s, c) => s + c.amountRials, 0);
    return { day, bankOpen: bank.isOpen(day), sections, unassigned, total, open };
  });
}

/// `pharmacies` lets a share named after a pharmacy ("Pharmacy 2") count under that pharmacy.
export function periodPlan(period, accountsData, pharmacies = []) {
  const toPayByPharmacy = new Map();
  const addTo = (id, amount) => toPayByPharmacy.set(id || null, (toPayByPharmacy.get(id || null) || 0) + amount);
  const pharmacyByName = new Map(pharmacies.map(p => [(p.name || '').trim().toLowerCase(), p.id]));
  const owedByEnd = new Map();
  const allDueByEnd = [];
  const rows = accountsData.map(({ account, entries, cheques }) => {
    const balance = balanceOf(entries, cheques);
    const inPeriod = cheques.filter(c => c.status !== 'cancelled' && period.contains(Day.parse(c.due)));
    for (const c of inPeriod.filter(x => isOutstanding(x.status))) {
      const otherPharmacy = pharmacyByName.get((c.shareName || '').trim().toLowerCase());
      const moved = otherPharmacy && otherPharmacy !== c.pharmacyID ? sharePart(c) : 0;
      addTo(c.pharmacyID, c.amountRials - moved);
      if (moved) addTo(otherPharmacy, moved);
    }
    const dueByEnd = cheques.filter(c => isOutstanding(c.status) && Day.parse(c.due).key <= period.end.key);
    const required = dueByEnd.reduce((s, c) => s + c.amountRials, 0);
    for (const [name, amount] of owedByName(dueByEnd)) owedByEnd.set(name, (owedByEnd.get(name) || 0) + amount);
    allDueByEnd.push(...dueByEnd);
    const sumOf = list => list.reduce((s, c) => s + c.amountRials, 0);
    return {
      account, chequeCount: inPeriod.length,
      dueInPeriod: sumOf(inPeriod),
      stillOpenInPeriod: sumOf(inPeriod.filter(c => isOutstanding(c.status))),
      openCount: inPeriod.filter(c => isOutstanding(c.status)).length,
      cashedInPeriod: sumOf(inPeriod.filter(c => c.status === 'cleared')),
      owedByEnd: owedByName(dueByEnd), owedDaysByEnd: owedChequeDays(dueByEnd),
      requiredByEnd: required, available: balance.available,
      transferByEnd: Math.max(0, required - balance.available),
    };
  });
  const sum = key => rows.reduce((s, r) => s + r[key], 0);
  // Per-account shortfalls added up: spare money in one account does not pay another account's cheques.
  return {
    period, rows, toPayByPharmacy, owedByEnd, owedDaysByEnd: owedChequeDays(allDueByEnd),
    totalDue: sum('dueInPeriod'), totalStillToPay: sum('stillOpenInPeriod'), totalCashed: sum('cashedInPeriod'),
    totalRequired: sum('requiredByEnd'), totalTransfer: sum('transferByEnd'),
  };
}

export function pharmacyTotals(cheques, today, horizonDays) {
  const end = today.addDays(horizonDays);
  const totals = new Map();
  for (const c of cheques) {
    if (!isOutstanding(c.status)) continue;
    const key = c.pharmacyID || null;
    const t = totals.get(key) || { openCount: 0, openTotal: 0, dueInHorizon: 0 };
    t.openCount++; t.openTotal += c.amountRials;
    if (Day.parse(c.due).key <= end.key) t.dueInHorizon += c.amountRials;
    totals.set(key, t);
  }
  return totals;
}

// ---------- Sayad, holidays, colours ----------

export const sayadDigits = text => normalizeDigits(text || '').replace(/\D/g, '');

export function duplicateSayad(cheques) {
  const groups = new Map();
  for (const c of cheques) {
    const key = sayadDigits(c.sayadID);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()].filter(g => g.length > 1);
}

const FIXED_HOLIDAYS = [[1, 1, 'Nowruz'], [1, 2, 'Nowruz'], [1, 3, 'Nowruz'], [1, 4, 'Nowruz'],
  [1, 12, 'Islamic Republic Day'], [1, 13, 'Nature Day'], [3, 14, 'Death of Imam Khomeini'],
  [3, 15, '15 Khordad Uprising'], [11, 22, 'Revolution Day'], [12, 29, 'Oil Nationalization Day']];

export function fixedHolidays(year) {
  return FIXED_HOLIDAYS.map(([m, d, name]) => ({ day: Day.of(year, m, d), name })).filter(h => h.day);
}

export const COLORS = [
  { name: 'Pink', hex: '#ff2d55' }, { name: 'Red', hex: '#ff3b30' }, { name: 'Orange', hex: '#ff9500' },
  { name: 'Yellow', hex: '#ffcc00' }, { name: 'Green', hex: '#34c759' }, { name: 'Teal', hex: '#30b0c7' },
  { name: 'Cyan', hex: '#32ade6' }, { name: 'Blue', hex: '#007aff' }, { name: 'Indigo', hex: '#5856d6' },
  { name: 'Purple', hex: '#af52de' }, { name: 'Brown', hex: '#a2845e' }, { name: 'Gray', hex: '#8e8e93' },
];

const normBank = b => (b || '').trim().toLowerCase();

export function stableColor(bank) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(normBank(bank))) { hash ^= byte; hash = Math.imul(hash, 16777619) >>> 0; }
  return hash % COLORS.length;
}

/// Same colour as another account at the same bank, else the first colour no other bank uses.
export function suggestColor(bank, existing) {
  const same = existing.find(e => normBank(e.bank) === normBank(bank));
  if (same) return same.colorIndex;
  const used = new Set(existing.map(e => e.colorIndex));
  for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i;
  return stableColor(bank);
}

export const colorOf = account => COLORS[account && account.colorIndex >= 0 && account.colorIndex < COLORS.length ? account.colorIndex : stableColor(account ? account.bank : '')].hex;

// ---------- Backup (same format as the iPhone app) and CSV ----------

export const BACKUP_FORMAT = 1;

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.cheques) || !Array.isArray(data.accounts)) throw new Error('This file is not a cheque backup.');
  if (data.format > BACKUP_FORMAT) throw new Error(`This backup was made by a newer version (format ${data.format}).`);
  for (const key of ['pharmacies', 'entries', 'holidays']) if (!Array.isArray(data[key])) throw new Error('This file is not a cheque backup.');
  const pharmacyIDs = new Set(data.pharmacies.map(p => p.id));
  const accountIDs = new Set(data.accounts.map(a => a.id));
  const fail = reason => { throw new Error(`The backup is damaged: ${reason}`); };
  for (const a of data.accounts) if (a.defaultPharmacyID && !pharmacyIDs.has(a.defaultPharmacyID)) fail(`account ${a.bank} points at a missing pharmacy`);
  for (const c of data.cheques) {
    if (!accountIDs.has(c.accountID)) fail(`a cheque to ${c.recipient} points at a missing account`);
    if (c.pharmacyID && !pharmacyIDs.has(c.pharmacyID)) fail(`a cheque to ${c.recipient} points at a missing pharmacy`);
    if (!Day.parse(c.due)) fail(`a cheque has an impossible due date ${c.due}`);
    if (!STATUSES.includes(c.status)) fail(`a cheque has an unknown status ${c.status}`);
    if (!Number.isSafeInteger(c.amountRials)) fail('a cheque has an impossible amount');
    if (c.shareAmountRials != null && c.shareAmountRials !== 0
      && (!Number.isSafeInteger(c.shareAmountRials) || c.shareAmountRials < 0 || c.shareAmountRials >= c.amountRials)) {
      fail(`a cheque to ${c.recipient} has a shared part that is not less than the cheque`);
    }
    if (c.shareDue && !Day.parse(c.shareDue)) fail(`a cheque to ${c.recipient} has an impossible date for the shared part ${c.shareDue}`);
  }
  for (const e of data.entries) {
    if (!accountIDs.has(e.accountID)) fail('a balance entry points at a missing account');
    if (!ENTRY_KINDS.includes(e.kind)) fail(`a balance entry has an unknown kind ${e.kind}`);
  }
  for (const h of data.holidays) if (!Day.parse(h.date)) fail(`a holiday has an impossible date ${h.date}`);
  return data;
}

export function backupSummary(data) {
  const n = (count, word, plural) => `${count} ${count === 1 ? word : plural}`;
  return [n(data.cheques.length, 'cheque', 'cheques'), n(data.accounts.length, 'account', 'accounts'), n(data.pharmacies.length, 'pharmacy', 'pharmacies')].join(', ');
}

const csvField = v => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const digitsAsText = v => (v ? `="${v}"` : '');
const csvDocument = (header, rows) => '﻿' + [header, ...rows].map(r => r.map(x => csvField(String(x ?? ''))).join(',')).join('\r\n') + '\r\n';

export function chequesCSV(ledger) {
  const accounts = new Map(ledger.accounts.map(a => [a.id, a]));
  const pharmacies = new Map(ledger.pharmacies.map(p => [p.id, p.name]));
  const rows = [...ledger.cheques].sort(chequeOrder).map(c => {
    const a = accounts.get(c.accountID) || {};
    const due = Day.parse(c.due);
    const share = sharePart(c);
    return [digitsAsText(c.sayadID), due.numeric, due.gregorianISO, c.amountRials, c.status, a.bank, digitsAsText(a.number), a.owner,
      pharmacies.get(c.pharmacyID) || '', c.recipient, share ? c.shareName : '', share || '', share ? (c.shareReceived ? 'yes' : 'no') : '', c.note];
  });
  return csvDocument(['sayad_id', 'due_jalali', 'due_gregorian', 'amount_rials', 'status', 'bank', 'account_number', 'owner', 'pharmacy', 'payee',
    'shared_with', 'shared_part_rials', 'shared_part_paid', 'note'], rows);
}

export function balancesCSV(ledger) {
  const accounts = new Map(ledger.accounts.map(a => [a.id, a]));
  const rows = [...ledger.entries].sort((x, y) => time(x.enteredAt) - time(y.enteredAt)).map(e => {
    const a = accounts.get(e.accountID) || {};
    const at = new Date(e.enteredAt);
    return [dateTime(at), at.toISOString().replace(/\.\d{3}Z$/, 'Z'), a.bank, digitsAsText(a.number), a.owner, e.kind, e.amountRials, e.enteredBy, e.note];
  });
  return csvDocument(['entered_at_tehran', 'entered_at_utc', 'bank', 'account_number', 'owner', 'kind', 'amount_rials', 'entered_by', 'note'], rows);
}
