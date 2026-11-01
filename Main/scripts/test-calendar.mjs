
import assert from "node:assert/strict";

import {
  adToBs,
  bsToAd,
  bsDaysInMonth
} from "@namlo/nepali-calendar";

const cases = [
  {
    ad: "2026-09-17",
    bs: { year: 2083, month: 6, day: 1 }
  },
  {
    ad: "2026-10-14",
    bs: { year: 2083, month: 6, day: 28 }
  },
  {
    ad: "2026-10-15",
    bs: { year: 2083, month: 6, day: 29 }
  },
  {
    ad: "2026-10-17",
    bs: { year: 2083, month: 6, day: 31 }
  },
  {
    ad: "2026-10-18",
    bs: { year: 2083, month: 7, day: 1 }
  }
];

for (const test of cases) {
  const actual = adToBs(new Date(`${test.ad}T00:00:00Z`));

  assert.deepEqual(
    actual,
    test.bs,
    `Wrong BS conversion for ${test.ad}`
  );

  const roundTrip = bsToAd(test.bs);

  assert.equal(
    roundTrip.toISOString().slice(0, 10),
    test.ad,
    `Wrong reverse conversion for ${test.ad}`
  );

  console.log(
    `PASS ${test.ad} -> ${test.bs.year}-${test.bs.month}-${test.bs.day}`
  );
}

assert.equal(
  bsDaysInMonth(2083, 6),
  31
);

console.log("PASS Asoj 2083 has 31 days");
console.log("All reference conversion tests passed.");
