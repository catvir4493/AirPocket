const pad = (value) => (value < 10 ? `0${value}` : `${value}`);

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value.$date) {
    return new Date(value.$date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatWeight = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return `${number} kg`;
};

module.exports = {
  formatDateTime,
  formatWeight,
  toDate,
};
