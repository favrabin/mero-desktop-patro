import assert from "node:assert/strict";
import {
  adToBs,
  bsToAd,
  bsDaysInMonth,
  BS_MONTHS_NP,
  WEEKDAYS_NP,
  toDevanagari
} from "@namlo/nepali-calendar";

console.log("Running comprehensive calendar test for BS 2000 - 2090...");

let totalDaysTested = 0;
let totalMonthsTested = 0;

for (let year = 2000; year <= 2090; year++) {
  for (let month = 1; month <= 12; month++) {
    const days = bsDaysInMonth(year, month);
    assert(days >= 29 && days <= 32, `Invalid days in month: ${year}/${month} has ${days} days`);
    totalMonthsTested++;

    // Test first, middle, and last day roundtrips
    const sampleDays = [1, 15, days];
    for (const day of sampleDays) {
      const adDate = bsToAd({ year, month, day });
      assert(adDate instanceof Date && !isNaN(adDate.getTime()), `Invalid AD date returned for ${year}/${month}/${day}`);

      const roundTripBs = adToBs(adDate);
      assert.equal(roundTripBs.year, year, `Year mismatch: expected ${year}, got ${roundTripBs.year} for ${year}/${month}/${day}`);
      assert.equal(roundTripBs.month, month, `Month mismatch: expected ${month}, got ${roundTripBs.month} for ${year}/${month}/${day}`);
      assert.equal(roundTripBs.day, day, `Day mismatch: expected ${day}, got ${roundTripBs.day} for ${year}/${month}/${day}`);

      totalDaysTested++;
    }
  }
}

// Test Devanagari numerals
assert.equal(toDevanagari(2083), "२०८३");
assert.equal(toDevanagari(15), "१५");

// Test Months and Weekdays length
assert.equal(BS_MONTHS_NP.length, 12);
assert.equal(WEEKDAYS_NP.length, 7);

console.log(`PASS: Verified ${totalMonthsTested} months across BS 2000-2090`);
console.log(`PASS: Verified ${totalDaysTested} round-trip date conversions`);
console.log("PASS: Devanagari numerals, weekdays, and months arrays verified");
console.log("All calendar verification tests passed successfully!");