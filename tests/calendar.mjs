import assert from 'node:assert/strict';
import { dateKey, calendarDayOffset, recentCalendarDays, streak } from '../src/learning/calendar.js';

let passes = 0;
const originalTimezone = process.env.TZ;
try {
  // These instants reproduce skipped/duplicated days when subtracting 24 hours
  // or mutating dates in the browser's timezone instead of the account's.
  for (const hostTimezone of ['UTC', 'America/Los_Angeles', 'Asia/Seoul']) {
    process.env.TZ = hostTimezone;
    for (const { timezone, at, keys, labels } of [
      { timezone: 'America/New_York', at: '2026-03-09T04:30:00Z', keys: ['2026-3-3','2026-3-4','2026-3-5','2026-3-6','2026-3-7','2026-3-8','2026-3-9'], labels: ['화','수','목','금','토','일','월'] },
      { timezone: 'America/New_York', at: '2026-11-02T04:30:00Z', keys: ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-1'], labels: ['월','화','수','목','금','토','일'] },
      { timezone: 'Pacific/Kiritimati', at: '2026-12-31T11:00:00Z', keys: ['2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-1-1'], labels: ['토','일','월','화','수','목','금'] },
    ]) {
      const now = new Date(at), days = recentCalendarDays(timezone, now);
      assert.equal(dateKey(now, timezone), keys.at(-1));
      assert.deepEqual(days.map(day => day.key), keys);
      assert.deepEqual(days.map(day => day.label), labels);
      assert.equal(new Set(days.map(day => day.key)).size, 7);
      assert.equal(streak(keys, timezone, now), 7);
      assert.equal(streak(keys.slice(0, -1), timezone, now), 6, 'yesterday remains an active streak before today is completed');
      assert.equal(streak([keys[3], keys[5], keys[6], keys[6]], timezone, now), 2, 'a gap breaks the streak; duplicate activity does not extend it');
      assert.equal(streak([keys[4]], timezone, now), 0, 'activity older than yesterday is no current streak');
      assert.equal(now.toISOString(), at.replace('Z', '.000Z'), 'calendar queries preserve their input instant');
      passes++;
    }
    const localNow = new Date(2026, 0, 1, 0, 30);
    assert.equal(dateKey(localNow), '2026-1-1');
    assert.deepEqual(recentCalendarDays(undefined, localNow).map(day => day.key), ['2025-12-26','2025-12-27','2025-12-28','2025-12-29','2025-12-30','2025-12-31','2026-1-1']);
    passes++;
  }
  assert.equal(calendarDayOffset('2024-3-1', -1), '2024-2-29');
  assert.equal(calendarDayOffset('2026-3-1', -1), '2026-2-28');
  assert.equal(calendarDayOffset('2026-12-31', 1), '2027-1-1');
  passes++;
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}
console.log(`${passes} calendar cases passed across three host timezones`);
