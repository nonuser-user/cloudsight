/* CloudSight — API adapter.
   Fetches live data from /api/* and updates CloudSightData + re-renders.
   Falls back silently to sample data on 503 (no DB configured). */
(function () {
  "use strict";

  const API = "/api";

  async function get(path) {
    const r = await fetch(API + path, { credentials: "same-origin" });
    if (!r.ok) throw Object.assign(new Error("api_" + r.status), { status: r.status });
    return r.json();
  }

  async function post(path, body) {
    const r = await fetch(API + path, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Object.assign(new Error("api_" + r.status), { status: r.status });
    return r.json();
  }

  function _removeSampleFlags() {
    document.querySelectorAll(".sample-flag").forEach(function (el) { el.remove(); });
  }

  // ── Summary (storage bar + plan info) — runs on every page ──────────
  async function loadSummary() {
    try {
      const s = await get("/summary");
      window.CloudSightData.summary = s;
      // update every storage bar on the page
      CloudSightRender.renderStorageBar("[data-storage-bar]");
      // update sidebar footer text
      var footerText = document.querySelector(".sidebar__upgrade-text");
      if (footerText) {
        footerText.textContent = s.usedPercent.toFixed(1) + "% of your "
          + s.totalStorageGB + " GB plan is used.";
      }
    } catch (e) { /* silent — keep sample data */ }
  }

  // ── Dashboard ──────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const data = await get("/dashboard");
      Object.assign(window.CloudSightData, {
        summary: data.summary,
        usageByType: data.usageByType,
        history: data.history,
        recentFiles: data.recentFiles,
        largestFiles: data.largestFiles,
        IS_SAMPLE: false,
      });
      CloudSightRender.renderKPIs();
      CloudSightRender.renderTypeLegend("[data-type-legend]", true);
      CloudSightRender.renderStorageBar("[data-storage-bar]");
      CloudSightRender.renderRecentFiles("[data-recent-files]");
      CloudSightRender.renderLargestFiles("[data-largest-files]");
      if (window.CloudSightCharts) {
        CloudSightCharts.growthArea("growthChart", { height: 320 });
        CloudSightCharts.storageDonut("storageDonutChart");
        CloudSightCharts.forecastChart("forecastChart", { height: 380 });
        CloudSightCharts.usageByTypeBars("typeDistChart", { height: 260 });
      }
      _removeSampleFlags();
      // show live badge next to title
      var titleRow = document.querySelector(".page-head .d-flex");
      if (titleRow && !titleRow.querySelector(".live-flag")) {
        var b = document.createElement("span");
        b.className = "badge-soft badge-soft--success live-flag";
        b.innerHTML = '<span class="dot-status" style="background:var(--success)"></span> Live data';
        titleRow.appendChild(b);
      }
    } catch (e) {
      if (e.status && e.status !== 503) console.warn("API error:", e);
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────
  async function loadAnalytics() {
    try {
      const data = await get("/analytics");
      Object.assign(window.CloudSightData, {
        summary: data.summary, usageByType: data.usageByType,
        history: data.history, topDirectories: data.topDirectories,
        typeGrowth: data.typeGrowth, typeAnalysis: data.typeAnalysis,
        IS_SAMPLE: false,
      });

      const s = data.summary;

      // summary tiles
      function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
      setText("at-used", s.usedStorageGB + " GB");
      setText("at-used-sub", s.usedPercent.toFixed(1) + "% of " + s.totalStorageGB + " GB plan");
      setText("at-files", s.fileCount.toLocaleString());

      // avg monthly growth from history
      var hist = data.history || [];
      if (hist.length >= 2) {
        var diff   = hist[hist.length - 1].usedGB - hist[0].usedGB;
        var months = hist.length - 1;
        var avg    = (diff / months).toFixed(2);
        setText("at-growth", (avg >= 0 ? "+" : "") + avg + " GB/mo");
        setText("at-growth-sub", "Over last " + hist.length + " months");
      } else {
        setText("at-growth", "Not enough data");
      }

      // largest type
      var types = data.usageByType || [];
      if (types.length) {
        var top = types.reduce(function (a, b) { return a.gb > b.gb ? a : b; });
        setText("at-largest-type", top.type);
        setText("at-largest-sub", top.gb.toFixed(2) + " GB · " + top.sharePct + "%");
      } else {
        setText("at-largest-type", "—");
        setText("at-largest-sub", "No files yet");
      }

      CloudSightRender.renderTypeLegend("[data-type-legend]", true);
      CloudSightRender.renderTypeAnalysisTable("[data-type-analysis]");
      CloudSightRender.renderStorageBar("[data-storage-bar]");
      if (window.CloudSightCharts) {
        CloudSightCharts.usageByTypeBars("usageByTypeChart", { height: 300 });
        CloudSightCharts.directoryBars("directoryChart", { height: 300 });
        CloudSightCharts.storageDonut("typeDonutChart", {
          centerText: s.usedStorageGB + " GB", centerSub: "used"
        });
        CloudSightCharts.typeDistributionStacked("typeGrowthChart", { height: 360 });
        CloudSightCharts.typeAnalysisCombo("typeComboChart", { height: 320 });
      }
      _removeSampleFlags();
    } catch (e) {
      if (e.status && e.status !== 503) console.warn("API error:", e);
    }
  }

  // ── Forecast ───────────────────────────────────────────────────────
  async function loadForecast(horizon, ci) {
    var params = "?horizon=" + (horizon || 12) + "&ci=" + (ci || 0.95);
    try {
      const data = await get("/forecast" + params);
      window.CloudSightData.prediction = data;
      window.CloudSightData.IS_SAMPLE = false;
      CloudSightRender.renderPredictionMetrics("[data-prediction-metrics]");
      if (window.CloudSightCharts) {
        CloudSightCharts.forecastChart("forecastChart", { height: 400 });
        CloudSightCharts.predictionVsActual("vsActualChart", { height: 320 });
      }
      _removeSampleFlags();
      return data;
    } catch (e) {
      if (e.status && e.status !== 503) console.warn("API error:", e);
      return null;
    }
  }

  // ── File manager ───────────────────────────────────────────────────
  async function loadFiles() {
    try {
      const data = await get("/files");
      window.CloudSightData.fileManagerFiles = data;
      window.CloudSightData.IS_SAMPLE = false;
      CloudSightRender.renderFileManagerList("[data-fm-list]");
      CloudSightRender.renderFileManagerGrid("[data-fm-grid]");
      _removeSampleFlags();
    } catch (e) {
      if (e.status && e.status !== 503) console.warn("API error:", e);
    }
  }

  // ── File delete ────────────────────────────────────────────────────
  async function deleteFile(key) {
    try { await post("/files/delete", { key }); return true; }
    catch (e) { return false; }
  }

  // ── Profile ────────────────────────────────────────────────────────
  async function updateProfile(fields) {
    try { await post("/profile", fields); return true; }
    catch (e) { return false; }
  }

  // ── Network status ─────────────────────────────────────────────────
  async function loadNetworkStatus() {
    try {
      const data = await get("/network/status");
      var banner = document.querySelector("[data-network-status]");
      if (banner && data.storage) {
        var dot   = banner.querySelector(".dot-status");
        var label = banner.querySelector("[data-status-label]");
        var ok    = data.storage.reachable;
        if (dot)   dot.style.background = ok ? "var(--success)" : "var(--warning)";
        if (label) label.textContent    = ok ? "Operational" : "Unreachable";
      }
      return data;
    } catch (e) { return null; }
  }

  // ── Expose ─────────────────────────────────────────────────────────
  window.CloudSightAPI = {
    loadDashboard, loadAnalytics, loadForecast,
    loadFiles, deleteFile, updateProfile, loadNetworkStatus,
    loadSummary,
  };

  // ── Auto-load on page ready ────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main[data-page]");
    if (!main) return;
    var page = main.getAttribute("data-page");

    // Always load summary so storage bar is correct on every page
    loadSummary();

    if (page === "dashboard")  loadDashboard();
    else if (page === "analytics") loadAnalytics();
    else if (page === "prediction") loadForecast();
    else if (page === "files") loadFiles();
    else if (page === "network") loadNetworkStatus();
  });

})();
