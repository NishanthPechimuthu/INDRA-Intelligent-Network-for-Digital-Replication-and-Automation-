/**
 * Pure shift / roster arithmetic shared by the schedule, attendance and admin
 * shift pages. Times are local wall-clock values plus an IANA timezone label;
 * Supabase stores timestamptz windows for records, calculated by these helpers.
 */

const MINUTES_PER_DAY = 24 * 60;

/** @param {string} value `HH:MM` or `HH:MM:SS` */
export function timeToMinutes(value) {
  if (typeof value !== 'string') return NaN;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

/** @param {number} minutes */
export function minutesToTime(minutes) {
  const normal = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(normal / 60)).padStart(2, '0')}:${String(normal % 60).padStart(2, '0')}`;
}

/** @param {number} minutes */
export function formatMinutes(minutes) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** @param {number} minutes */
export function formatHours(minutes) {
  return (Math.max(0, Number(minutes) || 0) / 60).toFixed(1);
}

/** @param {string} startTime @param {string} endTime */
export function isCrossMidnight(startTime, endTime) {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/**
 * Duration between two wall-clock times, adding a day when the interval crosses
 * midnight. 22:00 → 06:00 returns 480.
 * @param {string} startTime
 * @param {string} endTime
 */
export function intervalMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return end > start ? end - start : MINUTES_PER_DAY - start + end;
}

/**
 * @typedef {{ startTime: string, endTime: string, isPaid?: boolean }} Break
 * @typedef {{
 *   startTime: string, endTime: string, timezone?: string,
 *   graceMinutes?: number, lunchStart?: string|null, lunchEnd?: string|null,
 *   breaks?: Break[], weeklyWorkingDays?: number[], overtimePolicy?: string
 * }} Shift
 */

/** @param {Shift} shift */
export function shiftBreaks(shift) {
  const breaks = [...(shift?.breaks || [])];
  if (shift?.lunchStart && shift?.lunchEnd) {
    breaks.unshift({ startTime: shift.lunchStart, endTime: shift.lunchEnd, isPaid: false, name: 'Lunch' });
  }
  return breaks;
}

/** @param {Shift} shift */
export function unpaidBreakMinutes(shift) {
  return shiftBreaks(shift)
    .filter((item) => !item.isPaid)
    .reduce((total, item) => total + intervalMinutes(item.startTime, item.endTime), 0);
}

/** @param {Shift} shift */
export function paidBreakMinutes(shift) {
  return shiftBreaks(shift)
    .filter((item) => item.isPaid)
    .reduce((total, item) => total + intervalMinutes(item.startTime, item.endTime), 0);
}

/** @param {Shift} shift */
export function shiftMetrics(shift) {
  const spanMinutes = intervalMinutes(shift?.startTime, shift?.endTime);
  const paid = paidBreakMinutes(shift);
  const unpaid = unpaidBreakMinutes(shift);
  return {
    spanMinutes,
    paidBreakMinutes: paid,
    unpaidBreakMinutes: unpaid,
    breakMinutes: paid + unpaid,
    netWorkingMinutes: Math.max(0, spanMinutes - unpaid),
    breakCount: shiftBreaks(shift).length,
    crossMidnight: isCrossMidnight(shift?.startTime, shift?.endTime),
  };
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date) {
  const day = new Date(date).getDay();
  return day === 0 ? 7 : day;
}

/** @param {string|Date} date @param {number[]} weeklyWorkingDays */
export function isWorkingDay(date, weeklyWorkingDays = [1, 2, 3, 4, 5]) {
  return weeklyWorkingDays.includes(isoWeekday(date));
}

/**
 * @param {string|Date} date
 * @returns {string} YYYY-MM-DD in local time
 */
export function dateKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** @param {string|Date} date @param {number} days */
export function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

/**
 * Resolve the concrete start/end instants for a shift on a calendar day. The end
 * rolls into the following day for cross-midnight shifts.
 * @param {Shift} shift
 * @param {string|Date} date calendar day the shift starts
 */
export function shiftWindow(shift, date) {
  const day = new Date(date);
  const [startHour, startMinute] = String(shift.startTime).split(':').map(Number);
  const [endHour, endMinute] = String(shift.endTime).split(':').map(Number);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end, minutes: Math.round((end - start) / 60000) };
}

/**
 * Evaluate a clock-in/out pair against a shift. Grace only makes a late arrival
 * non-late within the configured window; it never changes scheduled minutes.
 * @param {{
 *   shift: Shift, date: string|Date, clockIn?: string|Date|null, clockOut?: string|Date|null,
 *   holiday?: boolean, approvedLeave?: boolean
 * }} input
 */
export function evaluateAttendance({ shift, date, clockIn, clockOut, holiday, approvedLeave }) {
  const metrics = shiftMetrics(shift);
  const window = shiftWindow(shift, date);
  if (holiday) {
    return { status: 'holiday', lateMinutes: 0, earlyOutMinutes: 0, overtimeMinutes: 0, workedMinutes: 0, scheduledMinutes: metrics.netWorkingMinutes, window };
  }
  if (approvedLeave && !clockIn) {
    return { status: 'on_leave', lateMinutes: 0, earlyOutMinutes: 0, overtimeMinutes: 0, workedMinutes: 0, scheduledMinutes: metrics.netWorkingMinutes, window };
  }
  if (!clockIn) {
    return { status: 'absent', lateMinutes: 0, earlyOutMinutes: 0, overtimeMinutes: 0, workedMinutes: 0, scheduledMinutes: metrics.netWorkingMinutes, window };
  }
  const inAt = new Date(clockIn);
  const outAt = clockOut ? new Date(clockOut) : null;
  const grace = Number(shift.graceMinutes) || 0;
  const lateMinutes = Math.max(0, Math.round((inAt - window.start) / 60000) - grace);
  const earlyOutMinutes = outAt ? Math.max(0, Math.round((window.end - outAt) / 60000)) : 0;
  const workedMinutes = outAt
    ? Math.max(0, Math.round((outAt - inAt) / 60000) - (outAt - inAt >= window.end - window.start ? metrics.unpaidBreakMinutes : 0))
    : 0;
  const overtimeMinutes = outAt && shift.overtimePolicy !== 'none'
    ? Math.max(0, Math.round((outAt - window.end) / 60000))
    : 0;
  let status = 'present';
  if (lateMinutes > 0) status = 'late';
  if (outAt && earlyOutMinutes > 0) status = lateMinutes > 0 ? 'late' : 'early_out';
  return { status, lateMinutes, earlyOutMinutes, overtimeMinutes, workedMinutes, scheduledMinutes: metrics.netWorkingMinutes, window };
}

/**
 * Expand an employee shift assignment into concrete roster entries for a date range.
 * @param {{
 *   assignment: { shiftId: string, effectiveFrom: string, effectiveTo?: string|null },
 *   shift: Shift, employeeId: string, from: string|Date, to: string|Date,
 *   holidays?: { date: string, plantId?: string|null, name?: string }[],
 *   leave?: { startDate: string, endDate: string }[]
 * }} input
 */
export function buildRoster({ assignment, shift, employeeId, from, to, holidays = [], leave = [] }) {
  const entries = [];
  const start = new Date(from);
  const end = new Date(to);
  const assignmentStart = new Date(`${assignment.effectiveFrom}T00:00:00`);
  const assignmentEnd = assignment.effectiveTo ? new Date(`${assignment.effectiveTo}T23:59:59`) : null;
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    const working = isWorkingDay(cursor, shift.weeklyWorkingDays);
    const inAssignment = cursor >= assignmentStart && (!assignmentEnd || cursor <= assignmentEnd);
    const holiday = holidays.find((item) => item.date === key);
    const onLeave = leave.find((item) => key >= item.startDate && key <= item.endDate);
    const window = shiftWindow(shift, cursor);
    entries.push({
      date: key,
      employeeId,
      shiftId: assignment.shiftId,
      working: working && inAssignment && !holiday && !onLeave,
      status: holiday ? 'holiday' : onLeave ? 'on_leave' : !inAssignment || !working ? 'off' : 'scheduled',
      holidayName: holiday?.name || null,
      start: window.start,
      end: window.end,
      netWorkingMinutes: shiftMetrics(shift).netWorkingMinutes,
    });
  }
  return entries;
}

/** @param {string} timezone */
export function timezoneLabel(timezone) {
  if (!timezone) return 'Local time';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}
