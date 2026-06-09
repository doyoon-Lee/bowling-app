export function getKoreaDateKey(dateValue) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateValue));
}

export function getKoreaDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-");
  return `${year}.${month}.${day}`;
}

export function groupRecordsByDate(records) {
  return records.reduce((groups, record) => {
    const dateKey = getKoreaDateKey(record.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(record);
    return groups;
  }, {});
}

export function getDayAverage(records) {
  if (!records.length) return 0;
  const total = records.reduce((sum, record) => sum + Number(record.total || 0), 0);
  return Math.round(total / records.length);
}

export function getDayHigh(records) {
  if (!records.length) return 0;
  return Math.max(...records.map((record) => Number(record.total || 0)));
}
