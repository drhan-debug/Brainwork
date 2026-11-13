/** Calendar keys follow the account timezone, or the browser timezone in demo mode. */
export function dateKey(date = new Date(), timezone) {
  if (timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${Number(parts.month)}-${Number(parts.day)}`;
  }
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function calendarDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** Move calendar dates, never elapsed hours: DST days can be 23 or 25 hours. */
export function calendarDayOffset(key, offset) {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

export function recentCalendarDays(timezone, now = new Date()) {
  const today = dateKey(now, timezone);
  const weekday = new Intl.DateTimeFormat('ko-KR', {weekday: 'short', timeZone: 'UTC'});
  return Array.from({length: 7}, (_, index) => {
    const key = calendarDayOffset(today, index - 6);
    return {key, label: weekday.format(calendarDate(key))};
  });
}

export function streak(dates = [], timezone, now = new Date()) {
  const recorded = new Set(dates);
  let day = dateKey(now, timezone);
  if (!recorded.has(day)) day = calendarDayOffset(day, -1);
  let count = 0;
  while (recorded.has(day)) {
    count += 1;
    day = calendarDayOffset(day, -1);
  }
  return count;
}
