"use strict";

const tauri = window.__TAURI__;
const patro = window.PatroDate;

const invoke = tauri?.core?.invoke;
const appWindow = tauri?.window?.getCurrentWindow ? tauri.window.getCurrentWindow() : null;

const $ = id => document.getElementById(id);

const DRAG_THRESHOLD = 6;
const DATE_REFRESH_INTERVAL = 15000;

let pointerStart = null;
let dragging = false;
let lastDateKey = "";
let suppressClickUntil = 0;
let currentSettings = null;

function applySettings(settings) {
  if (!settings) return;
  currentSettings = settings;

  const widgetEl = $("widget");
  const tithiPill = $("widget-tithi");
  const englishDate = $("english-date");
  const resizeGrip = $("widget-resize-grip");

  // Apply Theme
  if (widgetEl) {
    widgetEl.classList.remove("theme-glass", "theme-dark", "theme-flat");
    widgetEl.classList.add(`theme-${settings.widgetTheme || "glass"}`);
  }

  // Tithi visibility
  if (tithiPill) {
    tithiPill.style.display = settings.showTithiPill ? "" : "none";
  }

  // English date visibility
  if (englishDate) {
    englishDate.style.display = settings.showEnglishDate ? "" : "none";
  }

  // Resize grip visibility
  if (resizeGrip) {
    resizeGrip.style.display = settings.showResizeGrip ? "flex" : "none";
  }

  updateWidgetDate(true);
}

function updateWidgetDate(force = false) {
  const today = new Date();

  const key = [
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ].join("-");

  if (!force && key === lastDateKey) {
    return;
  }

  const nepali = $("nepali-date");
  const english = $("english-date");
  const tithiPill = $("widget-tithi");

  if (!nepali || !english) {
    return;
  }

  lastDateKey = key;

  english.textContent =
    today.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

  if (!patro || typeof patro.toBS !== "function") {
    nepali.textContent = "लोड हुँदैछ...";
    return;
  }

  const bs = patro.toBS(today);

  if (!bs) {
    nepali.textContent = "नेपाली मिति उपलब्ध छैन";
    if (tithiPill) tithiPill.hidden = true;
    return;
  }

  const weekday = patro.WEEKDAYS ? patro.WEEKDAYS[today.getDay()] : "";
  const day = patro.nepaliDigits ? patro.nepaliDigits(bs.day) : bs.day;
  const month = patro.MONTHS ? patro.MONTHS[bs.month] : "";
  const year = patro.nepaliDigits ? patro.nepaliDigits(bs.year) : bs.year;

  if (currentSettings && currentSettings.showWeekday === false) {
    nepali.textContent = `${day} ${month} ${year}`;
  } else {
    nepali.textContent = `${weekday}, ${day} ${month} ${year}`;
  }

  if (tithiPill && typeof patro.getDayInfo === "function") {
    const dayInfo = patro.getDayInfo(bs.year, bs.month, bs.day, today.getDay());
    if (dayInfo) {
      if (dayInfo.isGovernmentHoliday && dayInfo.holidayName) {
        tithiPill.textContent = dayInfo.holidayName;
        tithiPill.className = "widget-tithi-pill is-holiday";
        tithiPill.hidden = false;
        tithiPill.title = `सार्वजनिक बिदा: ${dayInfo.holidayName}`;
      } else if (dayInfo.events && dayInfo.events.length > 0) {
        tithiPill.textContent = dayInfo.events[0];
        tithiPill.className = "widget-tithi-pill is-festival";
        tithiPill.hidden = false;
        tithiPill.title = `चाडपर्व: ${dayInfo.events[0]}`;
      } else if (dayInfo.tithi) {
        tithiPill.textContent = dayInfo.tithi;
        tithiPill.className = "widget-tithi-pill";
        tithiPill.hidden = false;
        tithiPill.title = `तिथि: ${dayInfo.tithi}`;
      } else {
        tithiPill.hidden = true;
      }
    }
  }
}

function openCalendar() {
  if (invoke) {
    invoke("show_calendar_window").catch(err => {
      console.error("Failed to open calendar window:", err);
    });
  }
}

function openSettings(page = "system") {
  if (invoke) {
    invoke("show_settings_window", { page }).catch(err => {
      console.error("Failed to open settings window:", err);
    });
  }
}

function handleMouseDown(event) {
  if (event.button !== 0 || dragging) return;

  if (
    event.target.closest("#open-settings") ||
    event.target.closest("#widget-resize-grip")
  ) {
    return;
  }

  pointerStart = {
    x: event.screenX,
    y: event.screenY
  };
}

async function handleMouseMove(event) {
  if (!pointerStart || dragging) return;

  if ((event.buttons & 1) !== 1) {
    pointerStart = null;
    return;
  }

  const dx = event.screenX - pointerStart.x;
  const dy = event.screenY - pointerStart.y;

  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
    return;
  }

  pointerStart = null;
  dragging = true;
  suppressClickUntil = Date.now() + 450;

  try {
    if (appWindow) {
      await appWindow.startDragging();
    }

    if (!currentSettings || currentSettings.autoSnap !== false) {
      if (invoke) {
        await invoke("snap_widget");
      }
    }
  } catch (error) {
    console.error("Widget drag or corner snap failed:", error);
  } finally {
    dragging = false;
  }
}

function handleMouseUp() {
  pointerStart = null;
}

function handleCalendarClick(event) {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    return;
  }

  openCalendar();
}

function initResizeGrip() {
  const grip = $("widget-resize-grip");
  if (!grip || !appWindow || !invoke) return;

  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 254;
  let startHeight = 70;

  grip.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    startX = e.screenX;
    startY = e.screenY;

    try {
      const size = await appWindow.outerSize();
      const factor = await appWindow.scaleFactor();
      startWidth = Math.round(size.width / factor);
      startHeight = Math.round(size.height / factor);
    } catch (err) {
      console.warn("Could not read current window size:", err);
    }

    grip.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvt) => {
      if (!isResizing) return;
      const deltaX = moveEvt.screenX - startX;
      const deltaY = moveEvt.screenY - startY;

      const newW = Math.max(200, Math.min(450, Math.round(startWidth + deltaX)));
      const newH = Math.max(54, Math.min(140, Math.round(startHeight + deltaY)));

      invoke("set_widget_size", { width: newW, height: newH }).catch(() => {});
    };

    const onPointerUp = (upEvt) => {
      isResizing = false;
      try {
        grip.releasePointerCapture(upEvt.pointerId);
      } catch (_) {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

async function initializeWidget() {
  const surface = $("widget-surface");
  const calendarButton = $("open-calendar");
  const settingsButton = $("open-settings");

  if (!surface || !calendarButton) {
    console.error("Required widget elements missing.");
    return;
  }

  updateWidgetDate(true);

  if (invoke) {
    // Restore widget position (defaults to bottom-right above Windows 11 taskbar clock)
    try {
      await invoke("restore_widget_position");
    } catch (error) {
      console.error("Could not restore widget position:", error);
    }

    // Load and apply persistent settings
    try {
      const loadedSettings = await invoke("get_app_settings");
      applySettings(loadedSettings);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  // Listen for broadcast settings updates
  if (tauri?.event?.listen) {
    try {
      await tauri.event.listen("settings-changed", (event) => {
        applySettings(event.payload);
      });
    } catch (e) {
      console.warn("Could not register settings listener:", e);
    }
  }

  setInterval(() => updateWidgetDate(), DATE_REFRESH_INTERVAL);

  surface.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  calendarButton.addEventListener("click", handleCalendarClick);

  if (settingsButton) {
    settingsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      openSettings("system");
    });
  }

  initResizeGrip();

  window.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    if (invoke) {
      try {
        await invoke("show_widget_context_menu");
      } catch (error) {
        console.error("Context menu invocation failed:", error);
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateWidgetDate(true);
    }
  });

  window.addEventListener("focus", () => {
    updateWidgetDate(true);
  });

  console.log("Mero Desktop Patro widget initialized successfully.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWidget, { once: true });
} else {
  initializeWidget();
}
