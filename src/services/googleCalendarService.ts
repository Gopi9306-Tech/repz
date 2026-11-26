import { ReminderItem } from '../types';

/**
 * Service to handle Google Calendar synchronization.
 *
 * Requirements handled:
 * 1. Allow representatives to add reminders to their Google Calendar.
 * 2. Prevent duplicate calendar events.
 * 3. Handle OAuth permissions & missing credentials gracefully.
 * 4. Works seamlessly with both API-level tokens and universal Google Calendar intent deep-links.
 */
export const googleCalendarService = {
  /**
   * Converts a ReminderItem with date & 12-hour time into an ISO 8601 string or compact Google Calendar date format.
   */
  formatDateTimeForGoogle(dateStr: string, timeStr = '09:00 AM'): { start: string; end: string } {
    let hour = 9;
    let minute = 0;

    const parts = timeStr.trim().split(/[:\s]+/);
    if (parts.length >= 2) {
      const parsedHour = parseInt(parts[0], 10);
      const parsedMin = parseInt(parts[1], 10);
      const meridiem = (parts[2] || '').toUpperCase();

      hour = isNaN(parsedHour) ? 9 : parsedHour;
      minute = isNaN(parsedMin) ? 0 : parsedMin;

      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    const startDate = new Date(y, m - 1, d, hour, minute);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1-hour duration

    const toGCalCompact = (dt: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(
        dt.getHours()
      )}${pad(dt.getMinutes())}00`;
    };

    return {
      start: toGCalCompact(startDate),
      end: toGCalCompact(endDate),
    };
  },

  /**
   * Generates a direct Google Calendar Web / Mobile Intent URL.
   * This operates without requiring a server client-secret and works instantly in both browser and mobile.
   */
  getGoogleCalendarIntentUrl(reminder: ReminderItem, classCode = 'CSE-3A'): string {
    const { start, end } = this.formatDateTimeForGoogle(reminder.dueDate, reminder.dueTime);

    const title = encodeURIComponent(`[${classCode}] ${reminder.category}: ${reminder.title}`);
    const details = encodeURIComponent(
      `${reminder.description}\n\nCategory: ${reminder.category}\nPriority: ${reminder.priority.toUpperCase()}\nClass: ${classCode}\nManaged via Repz Class Representative Portal`
    );
    const dates = `${start}/${end}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&sf=true&output=xml`;
  },

  /**
   * Synchronizes a reminder with Google Calendar API if an OAuth access token is available.
   * If credentials are not present or permission is denied, it falls back gracefully to opening
   * the authenticated Google Calendar intent link and returns the generated event identifier.
   */
  async syncReminderToGoogleCalendar(
    reminder: ReminderItem,
    classCode = 'CSE-3A',
    providerAccessToken?: string | null
  ): Promise<{ success: boolean; eventId: string; method: 'api' | 'intent'; error?: string }> {
    // PREVENT DUPLICATES: Check if event is already synced
    if (reminder.googleCalendarEventId) {
      return {
        success: true,
        eventId: reminder.googleCalendarEventId,
        method: 'api',
      };
    }

    // Try Google Calendar REST API if an OAuth access token is provided
    if (providerAccessToken) {
      try {
        const { start, end } = this.formatDateTimeForGoogle(reminder.dueDate, reminder.dueTime);

        // Convert to ISO 8601
        const startISO = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T${start.slice(
          9,
          11
        )}:${start.slice(11, 13)}:00+05:30`;
        const endISO = `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T${end.slice(
          9,
          11
        )}:${end.slice(11, 13)}:00+05:30`;

        const response = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${providerAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: `[${classCode}] ${reminder.title}`,
              description: `${reminder.description}\n\nCategory: ${reminder.category}\nManaged via Repz Portal`,
              start: { dateTime: startISO, timeZone: 'Asia/Kolkata' },
              end: { dateTime: endISO, timeZone: 'Asia/Kolkata' },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 30 },
                  { method: 'email', minutes: 1440 }, // 1 day before
                ],
              },
            }),
          }
        );

        if (response.ok) {
          const eventData = await response.json();
          return {
            success: true,
            eventId: eventData.id || `gcal-api-${Date.now()}`,
            method: 'api',
          };
        }
      } catch (err: unknown) {
        console.warn('Google Calendar API direct call failed, falling back to intent link:', err);
      }
    }

    // Fallback: Open Google Calendar Intent securely in a new tab
    const intentUrl = this.getGoogleCalendarIntentUrl(reminder, classCode);
    const win = window.open(intentUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = intentUrl;
    }

    const syntheticEventId = `gcal-intent-${Date.now()}`;
    return {
      success: true,
      eventId: syntheticEventId,
      method: 'intent',
    };
  },
};
