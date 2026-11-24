export function isChristmasSeason(date = new Date(Date.now())) {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return (month === 10 && day >= 24) || month === 11 || (month === 0 && day <= 6);
}
