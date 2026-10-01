/**
 * Robust date formatting utility to prevent off-by-one day bugs across timezones
 * when formatting ISO YYYY-MM-DD strings.
 */

export function parseDateSafe(dateInput: string | Date | undefined | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Pattern YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    // Use midday local time to eliminate any timezone boundary rollover
    return new Date(year, month, day, 12, 0, 0);
  }

  // Pattern DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDate(
  dateInput: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
  fallback = '—'
): string {
  const d = parseDateSafe(dateInput);
  if (!d) {
    return typeof dateInput === 'string' && dateInput.trim() ? dateInput : fallback;
  }
  return d.toLocaleDateString('en-GB', options);
}

export function formatShortDate(dateInput: string | Date | undefined | null, fallback = '—'): string {
  const d = parseDateSafe(dateInput);
  if (!d) {
    return typeof dateInput === 'string' && dateInput.trim() ? dateInput : fallback;
  }
  return d.toLocaleDateString('en-GB');
}

/**
 * Returns ordinal string for any integer (supports digits in the thousands, e.g. 1st, 22nd, 101st, 1000th, 1001st).
 */
export function getOrdinalText(num: number): string {
  const abs = Math.abs(Math.floor(num));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${num}th`;
  }
  const mod10 = abs % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
}

