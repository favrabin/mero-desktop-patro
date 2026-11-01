"use strict";

const tauri = window.__TAURI__;
const $ = id => document.getElementById(id);

function getPatro() {
  return window.PatroDate;
}

let currentYear = 2083;
let currentMonth = 6; // 0-indexed (6 = Kartik)
let selectedDay = 1;

let calendarSettings = {
  highlightHolidays: true,
  showGridTithi: true,
  showHighlightsRibbon: true
};

async function loadCalendarSettings() {
  if (!tauri?.core?.invoke) return;
  try {
    const s = await tauri.core.invoke("get_app_settings");
    if (s) {
      calendarSettings = s;
      renderCalendar();
    }
  } catch (_) {}
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function initQuickJump() {
  const p = getPatro();
  if (!p) return;

  const yearSelect = $("select-year");
  const monthSelect = $("select-month");

  if (!yearSelect || !monthSelect) return;

  yearSelect.replaceChildren();
  monthSelect.replaceChildren();

  // Populate years: 2000 to 2090
  const minYear = p.MIN_YEAR ?? 2000;
  const maxYear = p.MAX_YEAR ?? 2090;

  for (let y = minYear; y <= maxYear; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = `${p.nepaliDigits(y)} वि.सं.`;
    if (y === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  // Populate months: 0 to 11
  (p.MONTHS || []).forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = name;
    if (idx === currentMonth) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  yearSelect.addEventListener("change", () => {
    currentYear = parseInt(yearSelect.value, 10);
    selectedDay = 1;
    renderCalendar();
  });

  monthSelect.addEventListener("change", () => {
    currentMonth = parseInt(monthSelect.value, 10);
    selectedDay = 1;
    renderCalendar();
  });
}

function syncQuickJump() {
  const yearSelect = $("select-year");
  const monthSelect = $("select-month");
  if (yearSelect) yearSelect.value = String(currentYear);
  if (monthSelect) monthSelect.value = String(currentMonth);
}

function changeMonth(offset) {
  const p = getPatro();
  if (!p) return;

  const absolute = currentYear * 12 + currentMonth + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = absolute - nextYear * 12;

  const minYear = p.MIN_YEAR ?? 2000;
  const maxYear = p.MAX_YEAR ?? 2090;

  if (nextYear < minYear || nextYear > maxYear) {
    return;
  }

  currentYear = nextYear;
  currentMonth = nextMonth;
  selectedDay = 1;

  renderCalendar();
}

function renderInspector(day) {
  const p = getPatro();
  if (!p) return;

  const bsDateEl = $("inspector-bs-date");
  const adDateEl = $("inspector-ad-date");
  const tithiEl = $("inspector-tithi");
  const cardEl = $("inspector-event-card");
  const textEl = $("inspector-event-text");

  if (!bsDateEl || !adDateEl || !tithiEl || !cardEl || !textEl) return;

  try {
    const gregorian = p.toGregorian(currentYear, currentMonth, day);
    const weekday = (p.WEEKDAYS && gregorian) ? p.WEEKDAYS[gregorian.getDay()] : "";
    const dayInfo = p.getDayInfo(currentYear, currentMonth, day, gregorian ? gregorian.getDay() : null);

    bsDateEl.textContent = `${weekday}, ${p.nepaliDigits(day)} ${p.MONTHS[currentMonth]} ${p.nepaliDigits(currentYear)}`;
    adDateEl.textContent = gregorian ? p.englishDate(gregorian) : "";

    // Tithi display
    if (dayInfo && dayInfo.tithi) {
      tithiEl.textContent = `तिथि: ${dayInfo.tithi}`;
      tithiEl.hidden = false;
    } else {
      tithiEl.hidden = true;
    }

    // Safe holiday & festival arrays
    const holidays = Array.isArray(dayInfo?.holidays) ? dayInfo.holidays : [];
    const events = Array.isArray(dayInfo?.events) ? dayInfo.events : [];

    if (dayInfo?.isGovernmentHoliday && holidays.length > 0) {
      cardEl.className = "inspector-event-card is-holiday";
      textEl.textContent = `🏛️ सार्वजनिक बिदा: ${holidays.join(" • ")}`;
    } else if (events.length > 0) {
      cardEl.className = "inspector-event-card is-festival";
      textEl.textContent = `✨ पर्व / दिवस: ${events.join(" • ")}`;
    } else if (dayInfo?.holidayName && dayInfo?.isGovernmentHoliday) {
      cardEl.className = "inspector-event-card is-holiday";
      textEl.textContent = `🏛️ सार्वजनिक बिदा: ${dayInfo.holidayName}`;
    } else if (dayInfo?.isSaturday) {
      cardEl.className = "inspector-event-card is-saturday";
      textEl.textContent = "🌴 शनिबार (साप्ताहिक बिदा)";
    } else {
      cardEl.className = "inspector-event-card is-normal";
      textEl.textContent = "साधारण दिन (कुनै सार्वजनिक बिदा छैन)";
    }
  } catch (error) {
    console.error("renderInspector error:", error);
  }
}

function renderHighlights() {
  const p = getPatro();
  if (!p) return;

  const ribbon = document.querySelector(".monthly-highlights-section");
  if (ribbon) {
    ribbon.style.display = (calendarSettings.showHighlightsRibbon !== false) ? "" : "none";
  }

  const container = $("monthly-holiday-chips");
  const countBadge = $("highlights-count");
  if (!container || !countBadge) return;

  container.replaceChildren();

  let holidays = [];
  try {
    holidays = (typeof p.getMonthHolidays === "function") ? p.getMonthHolidays(currentYear, currentMonth) : [];
  } catch (e) {
    console.error("getMonthHolidays error:", e);
  }

  countBadge.textContent = p.nepaliDigits(holidays.length);

  if (holidays.length === 0) {
    const emptyMsg = createElement("span", "highlights-empty", "यस महिनामा कुनै विशेष बिदा वा पर्व सूचीकृत छैन।");
    container.appendChild(emptyMsg);
    return;
  }

  holidays.forEach(item => {
    const chip = createElement(
      "button",
      item.isGovernmentHoliday ? "holiday-chip is-gov" : "holiday-chip is-event"
    );
    chip.type = "button";
    chip.title = "क्लिक गरी यो दिन हेर्नुहोस्";

    const dateSpan = createElement("strong", "chip-date", `${p.nepaliDigits(item.day)} गते`);
    const nameSpan = createElement("span", "chip-name", item.name || "");

    chip.append(dateSpan, nameSpan);

    chip.addEventListener("click", () => {
      selectedDay = item.day;
      renderInspector(selectedDay);

      // Highlight corresponding cell in grid
      document.querySelectorAll(".calendar-day").forEach(el => {
        el.classList.toggle("selected", el.dataset.day === String(item.day));
      });
    });

    container.appendChild(chip);
  });
}

function renderCalendar() {
  const p = getPatro();
  if (!p) return;

  const today = new Date();
  let todayBS = null;
  try {
    todayBS = p.toBS(today);
  } catch (_) {}

  const year = currentYear;
  const month = currentMonth;

  let firstDate;
  let totalDays;

  try {
    firstDate = p.toGregorian(year, month, 1);
    totalDays = p.monthLength(year, month);
  } catch (error) {
    console.error("Calendar month calculation error:", error);
    return;
  }

  let lastDate;
  try {
    lastDate = p.toGregorian(year, month, totalDays);
  } catch (_) {
    lastDate = firstDate;
  }

  // Sync title and range
  const monthTitle = $("month-title");
  if (monthTitle) {
    monthTitle.textContent = `${p.MONTHS[month]} ${p.nepaliDigits(year)}`;
  }

  const englishFormat = date =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

  const monthRange = $("month-range");
  if (monthRange && firstDate && lastDate) {
    monthRange.textContent = `${englishFormat(firstDate)} – ${englishFormat(lastDate)}`;
  }

  // Update Nepal Sambat Pill
  const nsPill = $("calendar-ns-pill");
  if (nsPill) {
    const nsYear = (year > 2000) ? (year - 937) : 1146;
    nsPill.textContent = `ने.सं. ${p.nepaliDigits(nsYear)}`;
  }

  syncQuickJump();

  const prevBtn = $("prev-month");
  const nextBtn = $("next-month");
  const todayBtn = $("go-today");

  const minYear = p.MIN_YEAR ?? 2000;
  const maxYear = p.MAX_YEAR ?? 2090;

  if (prevBtn) prevBtn.disabled = year === minYear && month === 0;
  if (nextBtn) nextBtn.disabled = year === maxYear && month === 11;
  if (todayBtn) todayBtn.disabled = !todayBS;

  const grid = $("calendar-grid");
  if (!grid) return;
  grid.replaceChildren();

  // Column Headers: आइत to शनि
  (p.WEEKDAYS_SHORT || []).forEach((label, index) => {
    const weekday = createElement("div", "weekday", label);
    if (index === 6) {
      weekday.classList.add("saturday");
    }
    weekday.setAttribute("role", "columnheader");
    grid.append(weekday);
  });

  const firstWeekday = firstDate ? firstDate.getDay() : 0;

  // Empty leading cells
  for (let i = 0; i < firstWeekday; i++) {
    const empty = createElement("div", "calendar-empty");
    empty.setAttribute("aria-hidden", "true");
    grid.append(empty);
  }

  // If viewing current month and today is in it, default selection to today
  if (todayBS && todayBS.year === year && todayBS.month === month) {
    if (selectedDay === 1 || selectedDay > totalDays) {
      selectedDay = todayBS.day;
    }
  } else if (selectedDay > totalDays) {
    selectedDay = 1;
  }

  // Days
  for (let day = 1; day <= totalDays; day++) {
    const gregorian = p.toGregorian(year, month, day);
    const dayOfWeek = gregorian ? gregorian.getDay() : 0;
    const dayInfo = p.getDayInfo(year, month, day, dayOfWeek);

    const isToday =
      todayBS?.year === year &&
      todayBS?.month === month &&
      todayBS?.day === day;

    const isSelected = day === selectedDay;

    const cell = createElement("div", "calendar-day");
    cell.dataset.day = String(day);

    if (dayInfo.isHoliday) {
      cell.classList.add("holiday");
    }
    if (dayInfo.isSaturday) {
      cell.classList.add("saturday");
    }
    if (dayInfo.isGovernmentHoliday && calendarSettings.highlightHolidays !== false) {
      cell.classList.add("gov-holiday");
    }
    if (isToday) {
      cell.classList.add("today");
      cell.setAttribute("aria-current", "date");
    }
    if (isSelected) {
      cell.classList.add("selected");
    }

    cell.setAttribute("role", "gridcell");
    cell.setAttribute("tabindex", "0");

    const accessibilityLabel =
      `${day} ${p.MONTHS[month]} ${year}, ${p.WEEKDAYS[dayOfWeek]}, ` +
      (gregorian ? p.englishDate(gregorian) : "") +
      (dayInfo.holidayName ? ` - ${dayInfo.holidayName}` : "") +
      (dayInfo.tithi ? ` - ${dayInfo.tithi}` : "");

    cell.setAttribute("aria-label", accessibilityLabel);

    // Top Row: BS Number + AD Number
    const topRow = createElement("div", "cell-top-row");
    const nepaliDay = createElement("span", "bs-number", p.nepaliDigits(day));
    const englishDay = createElement("span", "ad-number", gregorian ? String(gregorian.getDate()) : "");
    topRow.append(nepaliDay, englishDay);

    // Bottom Row: Tithi + Event Indicator Dot
    const bottomRow = createElement("div", "cell-bottom-row");
    const showTithi = calendarSettings.showGridTithi !== false;
    const tithiSpan = createElement("span", "tithi-text", showTithi ? (dayInfo.tithi || "") : "");

    bottomRow.appendChild(tithiSpan);

    if (dayInfo.isGovernmentHoliday) {
      const dot = createElement("span", "event-dot holiday-dot");
      dot.title = dayInfo.holidayName || "सार्वजनिक बिदा";
      bottomRow.appendChild(dot);
    } else if (dayInfo.events && dayInfo.events.length > 0) {
      const dot = createElement("span", "event-dot festival-dot");
      dot.title = dayInfo.events[0];
      bottomRow.appendChild(dot);
    }

    cell.append(topRow, bottomRow);

    // Cell Click selection
    cell.addEventListener("click", () => {
      selectedDay = day;
      document.querySelectorAll(".calendar-day").forEach(el => {
        el.classList.toggle("selected", el === cell);
      });
      renderInspector(selectedDay);
    });

    grid.append(cell);
  }

  // Trailing empty cells
  const occupied = firstWeekday + totalDays;
  for (let i = occupied; i < 42; i++) {
    const empty = createElement("div", "calendar-empty");
    empty.setAttribute("aria-hidden", "true");
    grid.append(empty);
  }

  // Render Inspector & Monthly Highlights
  renderInspector(selectedDay);
  renderHighlights();

  const todayTextEl = $("today-text");
  if (todayTextEl) {
    if (todayBS) {
      const todayInfo = p.getDayInfo(todayBS.year, todayBS.month, todayBS.day);
      const holidaySuffix = todayInfo.holidayName ? ` • ${todayInfo.holidayName}` : "";
      todayTextEl.textContent =
        `आज: ${p.nepaliDigits(todayBS.day)} ` +
        `${p.MONTHS[todayBS.month]} ` +
        `${p.nepaliDigits(todayBS.year)} (${todayInfo.tithi || ""})${holidaySuffix}`;
    } else {
      todayTextEl.textContent = "आजको मिति पात्रो दायराभन्दा बाहिर छ।";
    }
  }
}

async function openAboutWindow() {
  if (tauri?.core?.invoke) {
    try {
      await tauri.core.invoke("show_settings_window", { page: "about" });
    } catch (error) {
      console.error("About window error:", error);
    }
  }
}

async function openSettingsWindow() {
  if (tauri?.core?.invoke) {
    try {
      await tauri.core.invoke("show_settings_window", { page: "system" });
    } catch (err) {
      console.error("Failed to open settings:", err);
    }
  }
}

function setupEventListeners() {
  $("prev-month")?.addEventListener("click", () => changeMonth(-1));
  $("next-month")?.addEventListener("click", () => changeMonth(1));

  $("go-today")?.addEventListener("click", () => {
    const p = getPatro();
    if (!p) return;
    const today = p.toBS(new Date());
    if (!today) return;

    currentYear = today.year;
    currentMonth = today.month;
    selectedDay = today.day;

    renderCalendar();
  });

  $("open-settings-btn")?.addEventListener("click", openSettingsWindow);
  $("open-settings-footer")?.addEventListener("click", openSettingsWindow);
  $("open-about")?.addEventListener("click", openAboutWindow);

  if (tauri?.event?.listen) {
    tauri.event.listen("settings-changed", (event) => {
      calendarSettings = event.payload;
      renderCalendar();
    });
  }

  // Keyboard Navigation
  window.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      changeMonth(-1);
    } else if (event.key === "ArrowRight") {
      changeMonth(1);
    } else if (event.key === "t" || event.key === "T") {
      const p = getPatro();
      if (!p) return;
      const today = p.toBS(new Date());
      if (today) {
        currentYear = today.year;
        currentMonth = today.month;
        selectedDay = today.day;
        renderCalendar();
      }
    } else if (event.key === "Escape") {
      if (tauri?.window) {
        tauri.window.getCurrentWindow().hide();
      }
    }
  });

  // Re-render when window gains focus
  window.addEventListener("focus", () => {
    renderCalendar();
  });
}

function initCalendar() {
  const p = getPatro();
  if (!p) {
    setTimeout(initCalendar, 40);
    return;
  }

  try {
    const initialDate = p.toBS(new Date());
    if (initialDate) {
      currentYear = initialDate.year;
      currentMonth = initialDate.month;
      selectedDay = initialDate.day;
    }
  } catch (e) {
    console.error("Initial BS conversion error:", e);
  }

  initQuickJump();
  loadCalendarSettings();
  renderCalendar();
  setupEventListeners();
  console.log("Mero Desktop Patro calendar initialized successfully.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalendar, { once: true });
} else {
  initCalendar();
}
