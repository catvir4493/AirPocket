// Splits "YYYY-MM-DD" into the pieces the boarding pass and luggage tags print.
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const parseDay = (value) => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(`${value || ""}`);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : { year, month, day, date };
};

const pad = (value) => (value < 10 ? `0${value}` : `${value}`);

const dayParts = (value) => {
  const parsed = parseDay(value);
  if (!parsed) {
    return { short: "--.--", day: "--", month: "", year: "", weekday: "" };
  }
  return {
    short: `${pad(parsed.month)}.${pad(parsed.day)}`,
    day: pad(parsed.day),
    month: MONTHS[parsed.month - 1],
    year: `${parsed.year}`,
    weekday: WEEKDAYS[parsed.date.getDay()],
  };
};

module.exports = { dayParts };
