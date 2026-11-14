// The ledger lives on the phone, in the same shape as the backup file, so saving a backup is just writing it out.
import { BACKUP_FORMAT, FRIDAY } from './core.js';

const LEDGER_KEY = 'cheques.ledger.v1';
const SETTINGS_KEY = 'cheques.settings.v1';

export const DEFAULT_SETTINGS = {
  userName: '', unit: 'rial', horizonDays: 30, closedWeekdays: [FRIDAY], offsets: [30, 7, 2, 1], lastBackupAt: null,
};

export function newLedger(name = 'Pharmacy cheques') {
  return { format: BACKUP_FORMAT, exportedAt: null, ledgerName: name, pharmacies: [], accounts: [], cheques: [], entries: [], holidays: [] };
}

export class Store {
  /// `demo`: a ledger kept in memory only, never written to the phone.
  constructor(demo = null) {
    this.inMemory = demo != null;
    this.ledger = demo ?? read(LEDGER_KEY);
    this.settings = { ...DEFAULT_SETTINGS, ...(this.inMemory ? demo.settings : read(SETTINGS_KEY)) };
  }

  get hasLedger() { return this.ledger != null; }

  saveLedger() { this.write(LEDGER_KEY, this.ledger); }
  saveSettings() { this.write(SETTINGS_KEY, this.settings); }

  write(key, value) {
    if (this.inMemory) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      alert(`Could not save on this phone: ${error.message}. Save a backup file now.`);
    }
  }

  replaceLedger(ledger) { this.ledger = ledger; this.saveLedger(); }

  backupJSON() {
    return JSON.stringify({ ...this.ledger, format: BACKUP_FORMAT, exportedAt: new Date().toISOString() }, null, 2);
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
