"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const dates = require("../src/scripts/date-utils.js");

function range(start, end) {
  return {
    start: new Date(`${start}T00:00:00`),
    end: new Date(`${end}T00:00:00`)
  };
}

test("inclui o último dia de meses com 31 dias", () => {
  const month = range("2026-07-01", "2026-07-31");

  assert.equal(dates.isInRange("2026-07-30", month), true);
  assert.equal(dates.isInRange("2026-07-31", month), true);
  assert.equal(dates.isInRange("2026-08-01", month), false);
});

test("inclui o último dia de fevereiro", () => {
  const month = range("2026-02-01", "2026-02-28");

  assert.equal(dates.isInRange("2026-02-28", month), true);
  assert.equal(dates.isInRange("2026-03-01", month), false);
});

test("rejeita datas impossíveis no calendário", () => {
  assert.equal(dates.isValidISODate("2026-02-29"), false);
  assert.equal(dates.isValidISODate("2026-04-31"), false);
  assert.equal(dates.isValidISODate("2024-02-29"), true);
  assert.equal(dates.isValidISODate("2026-07-31"), true);
});
