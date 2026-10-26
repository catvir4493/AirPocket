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

// List section for a departure date, relative to today: 本周 / 下周 / 11月 / 2027年1月.
// Weeks start on Monday.
const departureGroup = (value, now = new Date()) => {
  const parsed = parseDay(value);
  if (!parsed) {
    return { key: "none", label: "日期待定" };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const days = Math.round((parsed.date.getTime() - weekStart.getTime()) / 86400000);
  if (days < 7) {
    return { key: "this-week", label: "本周" };
  }
  if (days < 14) {
    return { key: "next-week", label: "下周" };
  }
  return {
    key: `${parsed.year}-${parsed.month}`,
    label: parsed.year === today.getFullYear() ? `${parsed.month}月` : `${parsed.year}年${parsed.month}月`,
  };
};

module.exports = { dayParts, departureGroup };
