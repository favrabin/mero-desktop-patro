"use strict";

const tauri = window.__TAURI__;
const invoke = tauri?.core?.invoke;

const PORTFOLIO_URL = "https://portfolio.rabinthapa9.com.np/";

const $ = id => document.getElementById(id);

let currentSettings = {
  autostart: false,
  alwaysOnTop: true,
  autoSnap: true,
  closeToTray: true,
  widgetSizePreset: "standard",
  widgetWidth: 254,
  widgetHeight: 70,
  widgetTheme: "glass",
  showResizeGrip: true,
  showTithiPill: true,
  showEnglishDate: true,
  showWeekday: true,
  highlightHolidays: true,
  showGridTithi: true,
  showHighlightsRibbon: true,
};

let toastTimer = null;

function showToast(message) {
  const toast = $("save-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("visible");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2000);
}

function switchPage(pageName) {
  const targetId = `pane-${pageName}`;
  const targetPane = $(targetId);
  if (!targetPane) return;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === pageName);
  });

  document.querySelectorAll(".content-pane").forEach(pane => {
    const isTarget = pane.id === targetId;
    pane.hidden = !isTarget;
    pane.classList.toggle("active", isTarget);
  });

  const mainArea = $("settings-main");
  if (mainArea) mainArea.scrollTop = 0;
}

function initNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      switchPage(button.dataset.page);
    });
  });

  // Check URL query parameters or hash for initial tab (e.g. ?tab=about or ?page=developer)
  const urlParams = new URLSearchParams(window.location.search);
  const initial = urlParams.get("tab") || urlParams.get("page") || window.location.hash.replace("#", "");
  if (initial && $(`pane-${initial}`)) {
    switchPage(initial);
  }

  // Listen for native Tauri event if window is already open and user requests another tab
  if (tauri?.event?.listen) {
    tauri.event.listen("navigate-to-page", event => {
      if (event.payload && typeof event.payload === "string") {
        switchPage(event.payload);
      }
    });
  }
}

async function loadSettings() {
  if (!invoke) return;

  try {
    const loaded = await invoke("get_app_settings");
    if (loaded) {
      currentSettings = { ...currentSettings, ...loaded };
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }

  applySettingsToUI();
}

function applySettingsToUI() {
  // System tab
  const autostartEl = $("setting-autostart");
  const alwaysOnTopEl = $("setting-always-on-top");
  const autoSnapEl = $("setting-auto-snap");

  if (autostartEl) autostartEl.checked = Boolean(currentSettings.autostart);
  if (alwaysOnTopEl) alwaysOnTopEl.checked = Boolean(currentSettings.alwaysOnTop);
  if (autoSnapEl) autoSnapEl.checked = Boolean(currentSettings.autoSnap);

  // Widget tab
  const resizeGripEl = $("setting-resize-grip");
  const showTithiEl = $("setting-show-tithi");
  const showEnglishEl = $("setting-show-english");
  const showWeekdayEl = $("setting-show-weekday");

  if (resizeGripEl) resizeGripEl.checked = Boolean(currentSettings.showResizeGrip);
  if (showTithiEl) showTithiEl.checked = Boolean(currentSettings.showTithiPill);
  if (showEnglishEl) showEnglishEl.checked = Boolean(currentSettings.showEnglishDate);
  if (showWeekdayEl) showWeekdayEl.checked = Boolean(currentSettings.showWeekday);

  // Sizing Presets
  document.querySelectorAll(".preset-box").forEach(card => {
    card.classList.toggle("active", card.dataset.preset === currentSettings.widgetSizePreset);
  });

  // Themes
  document.querySelectorAll(".theme-box").forEach(card => {
    card.classList.toggle("active", card.dataset.theme === currentSettings.widgetTheme);
  });

  // Calendar tab
  const highlightHolidaysEl = $("setting-highlight-holidays");
  const gridTithiEl = $("setting-grid-tithi");
  const highlightsRibbonEl = $("setting-highlights-ribbon");

  if (highlightHolidaysEl) highlightHolidaysEl.checked = Boolean(currentSettings.highlightHolidays);
  if (gridTithiEl) gridTithiEl.checked = Boolean(currentSettings.showGridTithi);
  if (highlightsRibbonEl) highlightsRibbonEl.checked = Boolean(currentSettings.showHighlightsRibbon);
}

async function saveSettings(toastMessage = "Preferences saved") {
  if (!invoke) return;

  try {
    await invoke("save_app_settings", { settings: currentSettings });
    showToast(toastMessage);
  } catch (err) {
    console.error("Failed to save settings:", err);
    showToast("Error saving preferences");
  }
}

function bindEvents() {
  const bindToggle = (id, key, label) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      currentSettings[key] = el.checked;
      saveSettings(`${label} updated`);
    });
  };

  bindToggle("setting-autostart", "autostart", "Startup preference");
  bindToggle("setting-always-on-top", "alwaysOnTop", "Window pinning");
  bindToggle("setting-auto-snap", "autoSnap", "Auto-snap");
  bindToggle("setting-resize-grip", "showResizeGrip", "Resize handle");
  bindToggle("setting-show-tithi", "showTithiPill", "Tithi pill display");
  bindToggle("setting-show-english", "showEnglishDate", "English date display");
  bindToggle("setting-show-weekday", "showWeekday", "Weekday display");
  bindToggle("setting-highlight-holidays", "highlightHolidays", "Holiday highlighting");
  bindToggle("setting-grid-tithi", "showGridTithi", "Grid Tithi display");
  bindToggle("setting-highlights-ribbon", "showHighlightsRibbon", "Highlights ribbon");

  // Presets
  const presets = {
    compact: { width: 216, height: 56 },
    standard: { width: 254, height: 70 },
    expanded: { width: 300, height: 86 }
  };

  document.querySelectorAll(".preset-box").forEach(card => {
    card.addEventListener("click", async () => {
      const presetKey = card.dataset.preset;
      const config = presets[presetKey];
      if (!config) return;

      currentSettings.widgetSizePreset = presetKey;
      currentSettings.widgetWidth = config.width;
      currentSettings.widgetHeight = config.height;

      document.querySelectorAll(".preset-box").forEach(c => c.classList.toggle("active", c === card));

      try {
        await invoke("set_widget_size", { width: config.width, height: config.height });
        showToast(`Widget set to ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)}`);
      } catch (err) {
        console.error("Failed to resize widget:", err);
      }
    });
  });

  // Themes
  document.querySelectorAll(".theme-box").forEach(card => {
    card.addEventListener("click", () => {
      currentSettings.widgetTheme = card.dataset.theme;
      document.querySelectorAll(".theme-box").forEach(c => c.classList.toggle("active", c === card));
      saveSettings(`Theme changed to ${card.querySelector(".theme-title").textContent}`);
    });
  });

  // Reset Position
  const resetBtn = $("btn-reset-pos");
  if (resetBtn && invoke) {
    resetBtn.addEventListener("click", async () => {
      try {
        await invoke("reset_widget_position");
        showToast("Widget positioned at bottom-right (above clock)");
      } catch (err) {
        console.error("Failed to reset position:", err);
      }
    });
  }

  // Developer portfolio button
  const portfolioBtn = $("btn-open-portfolio");
  if (portfolioBtn && tauri?.opener) {
    portfolioBtn.addEventListener("click", () => {
      tauri.opener.openUrl(PORTFOLIO_URL).catch(console.error);
    });
  }

  // Listen for broadcast settings updates
  if (tauri?.event?.listen) {
    tauri.event.listen("settings-changed", event => {
      if (event.payload) {
        currentSettings = { ...currentSettings, ...event.payload };
        applySettingsToUI();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  bindEvents();
  loadSettings();
});
