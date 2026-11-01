import {
  adToBs,
  bsToAd,
  bsDaysInMonth,
  BS_MONTHS_NP,
  WEEKDAYS_NP,
  toDevanagari
} from "@namlo/nepali-calendar";

import rawCalendarData from "../src/nepal-calendar-data.json";

const DAY_MS = 86400000;
const MONTHS = [...BS_MONTHS_NP];
const WEEKDAYS = [...WEEKDAYS_NP];

const WEEKDAYS_SHORT = [
  "आइत",
  "सोम",
  "मङ्गल",
  "बुध",
  "बिही",
  "शुक्र",
  "शनि"
];

// Fixed national events/holidays (Solar BS dates present every year)
const FIXED_ANNUAL_EVENTS = {
  "1-1": { name: "नयाँ वर्ष (नववर्षारम्भ)", isHoliday: true },
  "1-11": { name: "लोकतन्त्र दिवस", isHoliday: false },
  "1-19": { name: "अन्तर्राष्ट्रिय श्रमिक दिवस", isHoliday: true },
  "2-15": { name: "गणतन्त्र दिवस", isHoliday: true },
  "6-3": { name: "संविधान दिवस (राष्ट्रिय दिवस)", isHoliday: true },
  "9-27": { name: "राष्ट्रिय एकता दिवस (पृथ्वी जयन्ती)", isHoliday: true },
  "10-1": { name: "माघे संक्रान्ति (माघी पर्व)", isHoliday: true },
  "10-16": { name: "शहीद दिवस", isHoliday: false },
  "11-7": { name: "राष्ट्रिय प्रजातन्त्र दिवस", isHoliday: true },
  "11-24": { name: "अन्तर्राष्ट्रिय महिला दिवस", isHoliday: true }
};

function nepaliDigits(value) {
  return toDevanagari(value);
}

function normalizeLocalDate(date) {
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ));
}

function toBS(date) {
  try {
    const result = adToBs(normalizeLocalDate(date));
    return {
      year: result.year,
      month: result.month - 1, // 0-indexed for JS consistency
      day: result.day,
      weekday: date.getDay()
    };
  } catch (error) {
    console.error("BS conversion error:", error);
    return null;
  }
}

function toGregorian(year, monthIndex, day) {
  const result = bsToAd({
    year,
    month: monthIndex + 1,
    day
  });

  return new Date(
    result.getUTCFullYear(),
    result.getUTCMonth(),
    result.getUTCDate()
  );
}

function monthLength(year, monthIndex) {
  return bsDaysInMonth(year, monthIndex + 1);
}

function monthStart(year, monthIndex) {
  const date = toGregorian(year, monthIndex, 1);
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function localDate(serial) {
  const date = new Date(serial);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function englishDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getDayInfo(year, monthIndex, day, weekday = null) {
  const month1 = monthIndex + 1; // 1-indexed month
  const dataForYear = rawCalendarData[year];
  const dataForMonth = dataForYear ? dataForYear[month1] : null;
  const dayData = dataForMonth ? dataForMonth[day] : null;

  let isSaturday = false;
  if (weekday === null) {
    const ad = toGregorian(year, monthIndex, day);
    isSaturday = ad.getDay() === 6;
  } else {
    isSaturday = weekday === 6;
  }

  const holidays = [];
  const events = [];
  let tithi = "";
  let isGovHoliday = false;

  if (dayData) {
    tithi = dayData.t || "";
    if (dayData.h && dayData.h.length > 0) {
      holidays.push(...dayData.h);
      isGovHoliday = true;
    }
    if (dayData.e && dayData.e.length > 0) {
      events.push(...dayData.e);
    }
  }

  // Check fallback solar events if not already present
  const solarKey = `${month1}-${day}`;
  const fixed = FIXED_ANNUAL_EVENTS[solarKey];
  if (fixed) {
    if (fixed.isHoliday) {
      isGovHoliday = true;
      if (!holidays.includes(fixed.name)) holidays.unshift(fixed.name);
    } else {
      if (!events.includes(fixed.name) && !holidays.includes(fixed.name)) {
        events.push(fixed.name);
      }
    }
  }

  const isHoliday = isSaturday || isGovHoliday;
  const primaryName = holidays[0] || events[0] || (isSaturday ? "शनिबार (साप्ताहिक बिदा)" : "");

  return {
    tithi,
    holidays,
    events,
    isHoliday,
    isGovernmentHoliday: isGovHoliday,
    holidayName: primaryName,
    isSaturday
  };
}

function getMonthHolidays(year, monthIndex) {
  const count = monthLength(year, monthIndex);
  const items = [];

  for (let day = 1; day <= count; day++) {
    const info = getDayInfo(year, monthIndex, day);
    if (info.isGovernmentHoliday || info.events.length > 0) {
      items.push({
        day,
        tithi: info.tithi,
        name: info.holidayName || info.events[0] || "",
        isGovernmentHoliday: info.isGovernmentHoliday
      });
    }
  }

  return items;
}

window.PatroDate = Object.freeze({
  MONTHS,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  DAY: DAY_MS,
  nepaliDigits,
  toBS,
  toGregorian,
  monthStart,
  monthLength,
  localDate,
  englishDate,
  getDayInfo,
  getMonthHolidays,
  MIN_YEAR: 2000,
  MAX_YEAR: 2090
});