/**
 * Retention and Date Calculation Utilities for Asia/Kolkata Timezone (IST)
 */

/**
 * Returns today's date in 'YYYY-MM-DD' formatted according to Asia/Kolkata timezone.
 */
export function getTodayDateIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Calculates the 7-day retention cutoff date in Asia/Kolkata timezone.
 * Records with dates strictly older than (cutoff) are expired and permanently removed.
 *
 * Example: If today is 2026-11-26 in IST, the last 7 days of records are:
 * 2026-11-20 to 2026-11-26 (inclusive).
 * Cutoff date is: 2026-11-20. Anything before 2026-11-20 is deleted.
 */
export function getRetentionCutoffDateIST(daysToRetain = 7): string {
  // Get time in IST
  const istDateStr = getTodayDateIST();
  const [year, month, day] = istDateStr.split('-').map(Number);

  // UTC-based date object constructed with IST calendar day
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - (daysToRetain - 1)); // Includes today + past 6 days = 7 days

  return d.toISOString().split('T')[0];
}

/**
 * Checks if a date string 'YYYY-MM-DD' falls within the 7-day retention window.
 */
export function isWithinRetentionWindow(dateStr: string, daysToRetain = 7): boolean {
  const cutoff = getRetentionCutoffDateIST(daysToRetain);
  return dateStr >= cutoff;
}

/**
 * Returns the list of 7 consecutive dates (YYYY-MM-DD) currently within the retention window.
 */
export function getRetentionDateRange(daysToRetain = 7): string[] {
  const dates: string[] = [];
  const istToday = getTodayDateIST();
  const [year, month, day] = istToday.split('-').map(Number);

  for (let i = 0; i < daysToRetain; i++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Formats a date string nicely with Day and Month in Asia/Kolkata timezone.
 */
export function formatDateDisplayIST(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC', // Date string was split into UTC numbers
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
