// Generic sample data for trying the app (?demo=1). Kept in memory only; nothing is saved.
import { Day, Month, FRIDAY } from './core.js';
import { newLedger } from './store.js';

export function demoLedger(now = new Date()) {
  const today = Day.today(now);
  const month = Month.of(today);
  const ledger = newLedger();
  const p1 = { id: 'p1', name: 'Pharmacy 1', createdAt: null };
  const p2 = { id: 'p2', name: 'Pharmacy 2', createdAt: null };
  ledger.pharmacies.push(p1, p2);
  const parsian = { id: 'a1', bank: 'Parsian', number: '47000123456701', owner: 'Partner A', colorIndex: 0, defaultPharmacyID: 'p1', createdAt: null };
  const saderat = { id: 'a2', bank: 'Saderat', number: '0219876543', owner: 'Partner A', colorIndex: 7, defaultPharmacyID: 'p1', createdAt: null };
  const mellat = { id: 'a3', bank: 'Mellat', number: '5566778899', owner: 'Partner B', colorIndex: 4, defaultPharmacyID: 'p2', createdAt: null };
  ledger.accounts.push(parsian, saderat, mellat);
  const ago = days => new Date(now.getTime() - days * 86400000 - 3600000).toISOString();
  ledger.entries.push(
    { id: 'e1', accountID: 'a1', kind: 'bankBalance', amountRials: 1850000000, enteredAt: ago(1), enteredBy: 'Partner A', note: '' },
    { id: 'e2', accountID: 'a2', kind: 'bankBalance', amountRials: 6200000000, enteredAt: ago(4), enteredBy: 'Partner A', note: '' },
    { id: 'e3', accountID: 'a3', kind: 'bankBalance', amountRials: 900000000, enteredAt: ago(0), enteredBy: 'Partner B', note: '' });

  const recipients = ['داروپخش', 'پخش البرز', 'پخش هجرت', 'پخش رازی', 'پخش فردوس', 'اکسیر'];
  let serial = 0;
  const add = (mo, d, account, pharmacy, r, amount) => {
    const due = Day.of(mo.y, mo.m, Math.min(d, mo.days.length));
    serial++;
    const past = due.key < today.key;
    ledger.cheques.push({
      id: `c${serial}`, accountID: account.id, pharmacyID: pharmacy.id, sayadID: `1405${String(serial * 7919).padStart(12, '0')}`,
      recipient: recipients[r % recipients.length], amountRials: amount, due: due.numeric,
      status: past ? 'cleared' : 'open', statusChangedAt: past ? due.at(11).toISOString() : null,
      note: '', createdAt: new Date(now.getTime() + serial * 1000).toISOString(), createdBy: 'Partner A',
    });
  };
  [[1, saderat, p1, 0, 1240500000], [1, parsian, p1, 1, 412750000], [1, mellat, p2, 2, 368900000],
    [5, saderat, p1, 3, 2510340000], [5, parsian, p1, 4, 163200000], [5, mellat, p2, 0, 241600000], [5, saderat, p2, 1, 577480000],
    [10, parsian, p1, 2, 455100000], [10, saderat, p1, 5, 3310250000], [10, mellat, p2, 3, 498700000],
    [13, saderat, p2, 4, 271900000], [15, parsian, p1, 0, 330400000], [15, mellat, p2, 1, 128000000],
    [20, saderat, p1, 2, 1034600000], [20, parsian, p2, 5, 96500000], [20, mellat, p2, 4, 640250000],
    [24, parsian, p1, 3, 884300000], [25, saderat, p1, 0, 2598750000], [25, mellat, p2, 2, 415900000],
    [25, parsian, p2, 1, 176400000], [25, saderat, p2, 4, 365000000], [28, mellat, p2, 5, 309800000],
    [28, parsian, p1, 0, 1093500000], [30, saderat, p1, 3, 4455000000], [30, mellat, p2, 1, 1062300000],
  ].forEach(([d, a, p, r, amt]) => add(month, d, a, p, r, amt));
  const next = month.add(1);
  [[1, saderat, p1, 2, 2100000000], [5, parsian, p1, 3, 760000000], [10, mellat, p2, 0, 1250000000], [15, saderat, p2, 5, 845000000]]
    .forEach(([d, a, p, r, amt]) => add(next, d, a, p, r, amt));

  ledger.settings = { userName: 'Partner A', closedWeekdays: [FRIDAY], lastBackupAt: now.toISOString() };
  return ledger;
}
