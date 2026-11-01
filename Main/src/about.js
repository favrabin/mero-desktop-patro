
"use strict";

const tauri = window.__TAURI__;

const PORTFOLIO_URL =
  "https://portfolio.rabinthapa9.com.np/";

const PAGES = new Set([
  "about",
  "developer",
  "privacy",
  "terms",
  "disclaimer"
]);

const $ = id => document.getElementById(id);

function closePortfolio() {
  $("portfolio-frame").src = "about:blank";
  $("portfolio-view").hidden = true;
  $("developer-profile").hidden = false;
}

function loadPortfolio() {
  $("developer-profile").hidden = true;
  $("portfolio-view").hidden = false;
  $("portfolio-frame").src = PORTFOLIO_URL;
}

function showPage(name) {
  if (!PAGES.has(name)) return;

  if (name !== "developer") {
    closePortfolio();
  }

  document.querySelectorAll(".page").forEach(page => {
    page.hidden = page.id !== `page-${name}`;
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    const active = button.dataset.page === name;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  $("main-content").scrollTop = 0;

  const heading = document.querySelector(`#page-${name} h1`);

  document.title =
    `${heading?.textContent || "About"} - Mero Desktop Patro`;
}

async function openPortfolioExternally() {
  try {
    await tauri.opener.openUrl(PORTFOLIO_URL);
  } catch (error) {
    console.error("Portfolio opening failed:", error);
  }
}

function initializeAbout() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.page === "developer") {
        closePortfolio();
      }

      showPage(button.dataset.page);
    });
  });

  $("view-portfolio").addEventListener("click", loadPortfolio);

  $("back-to-profile").addEventListener(
    "click",
    closePortfolio
  );

  $("refresh-portfolio").addEventListener("click", () => {
    $("portfolio-frame").src = PORTFOLIO_URL;
  });

  document.querySelectorAll("[data-open-portfolio]")
    .forEach(button => {
      button.addEventListener(
        "click",
        openPortfolioExternally
      );
    });

  $("copyright-year").textContent =
    String(new Date().getFullYear());

  const settingsNavBtn = $("open-settings-nav");
  if (settingsNavBtn && tauri?.core?.invoke) {
    settingsNavBtn.addEventListener("click", () => {
      tauri.core.invoke("show_settings_window").catch(err => {
        console.error("Failed to open settings:", err);
      });
    });
  }

  showPage("about");
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAbout,
    { once: true }
  );
} else {
  initializeAbout();
}
