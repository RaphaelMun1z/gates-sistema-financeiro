(function attachDateUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GatesDateUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDateUtils() {
  "use strict";

  function fromISO(iso) {
    return new Date(`${iso}T12:00:00`);
  }

  function isValidISODate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return stripTime(next);
  }

  function isInRange(iso, range) {
    const date = fromISO(iso);
    if (!iso || Number.isNaN(date.getTime()) || !range?.start || !range?.end) return false;

    const start = stripTime(range.start);
    const endExclusive = addDays(stripTime(range.end), 1);
    return date >= start && date < endExclusive;
  }

  return { isInRange, isValidISODate };
});
