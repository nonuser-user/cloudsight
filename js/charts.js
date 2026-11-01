/* CloudSight — Plotly charts with shared theme. */
(function () {
  "use strict";
  const P = (window.CloudSightData && window.CloudSightData.palette) || {
    brand: "#6366f1", brandDark: "#4f46e5", brandLight: "#c7d2fe",
    sky: "#0ea5e9", emerald: "#10b981", amber: "#f59e0b",
    violet: "#a855f7", teal: "#14b8a6", slate: "#94a3b8",
    grid: "#eef0f4", text: "#334155", textMuted: "#64748b",
  };

  const font = { family: "Inter, system-ui, sans-serif", size: 12, color: P.text };

  const layoutBase = {
    font,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 8, r: 8, t: 10, b: 8 },
    hoverlabel: {
      bgcolor: "#ffffff", bordercolor: "#e2e8f0", font: { ...font, size: 12, color: P.text },
    },
    colorway: [P.brand, P.sky, P.emerald, P.amber, P.violet, P.teal, P.slate],
  };

  // Apply responsive sizing + theme to a chart.
  function draw(id, data, layout, config) {
    const el = document.getElementById(id);
    if (!el || !window.Plotly) return;
    const merged = Object.assign({}, layoutBase, layout);
    const cfg = Object.assign(
      { displayModeBar: false, responsive: true },
      config || {}
    );
    Plotly.react(id, data, merged, cfg);
  }

  // Axis helper (clean, minimal, brand-aligned)
  function cleanAxis(prefix) {
    return {
      showgrid: true,
      gridcolor: P.grid,
      zeroline: false,
      linecolor: "transparent",
      tickfont: { ...font, size: 11, color: P.textMuted },
      ticks: "outside",
      ticklen: 0,
      automargin: true,
      ...(prefix ? { title: { text: prefix, font: { ...font, size: 11, color: P.textMuted } } } : {}),
    };
  }

  function compactTicks(v) {
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k";
    return String(v);
  }

  /* -------------------------------------------------------------------- */
  /* Storage usage donut                                                    */
  /* -------------------------------------------------------------------- */
  function storageDonut(id, opts) {
    const data = window.CloudSightData.usageByType;
    const center = opts && opts.centerText != null ? opts.centerText
      : `${window.CloudSightData.summary.usedPercent}%`;
    const centerSub = (opts && opts.centerSub) || "used";

    const trace = {
      type: "pie",
      hole: 0.72,
      values: data.map(d => d.gb),
      labels: data.map(d => d.type),
      marker: { colors: data.map(d => d.color), line: { color: "#ffffff", width: 3 } },
      textfont: { family: "Inter", size: 12, color: "#ffffff" },
      textinfo: "none",
      hovertemplate: "<b>%{label}</b><br>%{value:.1f} GB<br>(%{percent:.0%})<extra></extra>",
      sort: false,
      showlegend: false,
    };

    // center label via annotation
    const layout = {
      margin: { l: 4, r: 4, t: 4, b: 4 },
      annotations: [
        { text: `<b style="font-size:26px;color:#0f172a">${center}</b>`, showarrow: false, x: 0.5, y: 0.58, font: { family: "Inter" } },
        { text: centerSub, showarrow: false, x: 0.5, y: 0.44, font: { family: "Inter", size: 12, color: P.textMuted } },
      ],
      xaxis: { visible: false }, yaxis: { visible: false },
      height: 260,
    };
    draw(id, [trace], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Historical growth area chart                                           */
  /* -------------------------------------------------------------------- */
  function growthArea(id, opts) {
    const h = window.CloudSightData.history;
    const o = opts || {};
    const trace = {
      type: "scatter", mode: "lines", fill: "tozeroy",
      x: h.map(d => d.label), y: h.map(d => d.usedGB),
      line: { color: P.brand, width: 2.5, shape: "spline", smoothing: 1.1 },
      fillcolor: "rgba(99,102,241,0.12)",
      hovertemplate: "<b>%{x}</b><br>%{y:.1f} GB used<extra></extra>",
      name: "Used storage",
    };
    const layout = {
      margin: { l: 36, r: 8, t: 8, b: 28 },
      xaxis: { ...cleanAxis(), tickangle: -40, nticks: 8 },
      yaxis: { ...cleanAxis("GB"), rangemode: "tozero", tickformat: ".0f" },
      height: o.height || 320,
      showlegend: false,
    };
    draw(id, [trace], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Forecast chart (history + predicted + confidence band)                 */
  /* -------------------------------------------------------------------- */
  function forecastChart(id, opts) {
    const pred = window.CloudSightData.prediction;
    const hist = pred.history;
    const fc = pred.forecast;

    // splice x for continuity
    const histX = hist.map(d => d.label);
    const fcX = [histX[histX.length - 1]].concat(fc.map(d => d.label));

    const histTrace = {
      type: "scatter", mode: "lines+markers", name: "Historical",
      x: histX, y: hist.map(d => d.usedGB),
      line: { color: P.slate, width: 2 },
      marker: { size: 4, color: P.slate },
      hovertemplate: "<b>%{x}</b><br>%{y:.1f} GB (actual)<extra></extra>",
    };
    const bandX = fcX;
    const upperTrace = {
      type: "scatter", mode: "lines", name: "Upper bound",
      x: bandX, y: [hist[hist.length - 1].usedGB].concat(fc.map(d => d.upper)),
      line: { width: 0, color: "rgba(99,102,241,0.0)" },
      hoverinfo: "skip", showlegend: false,
    };
    const lowerTrace = {
      type: "scatter", mode: "lines", name: "Lower bound",
      x: bandX, y: [hist[hist.length - 1].usedGB].concat(fc.map(d => d.lower)),
      line: { width: 0, color: "rgba(99,102,241,0.0)" },
      fill: "tonexty", fillcolor: "rgba(99,102,241,0.14)",
      hoverinfo: "skip", showlegend: false,
    };
    const predTrace = {
      type: "scatter", mode: "lines+markers", name: "Forecast (Linear Regression)",
      x: bandX, y: [hist[hist.length - 1].usedGB].concat(fc.map(d => d.predicted)),
      line: { color: P.brand, width: 2.8, dash: "dot" },
      marker: { size: 5, color: P.brand },
      hovertemplate: "<b>%{x}</b><br>%{y:.1f} GB (predicted)<extra></extra>",
    };
    // capacity reference line
    const capTrace = {
      type: "scatter", mode: "lines", name: "Capacity",
      x: bandX, y: bandX.map(() => pred.capacityGB),
      line: { color: "#ef4444", width: 1.5, dash: "dashdot" },
      hovertemplate: "Capacity · %{y:.0f} GB<extra></extra>",
    };

    const layout = {
      margin: { l: 40, r: 12, t: 28, b: 30 },
      xaxis: { ...cleanAxis(), tickangle: -40, nticks: 10 },
      yaxis: { ...cleanAxis("GB"), rangemode: "tozero", tickformat: ".0f" },
      legend: {
        orientation: "h", y: 1.12, x: 0, font: { ...font, size: 11.5 },
        bgcolor: "rgba(0,0,0,0)", itemclick: false, itemdoubleclick: false,
      },
      height: (opts && opts.height) || 380,
    };
    draw(id, [histTrace, upperTrace, lowerTrace, predTrace, capTrace], layout);
  }

  /* -------------------------------------------------------------------- */
  /* File-type distribution stacked area (analytics)                        */
  /* -------------------------------------------------------------------- */
  function typeDistributionStacked(id, opts) {
    const tg = window.CloudSightData.typeGrowth;
    const types = ["Videos", "Images", "Documents", "Archives", "Audio", "Code"];
    const colors = { Videos: P.brand, Images: P.sky, Documents: P.emerald, Archives: P.amber, Audio: P.violet, Code: P.teal };
    const traces = types.map(t => ({
      type: "scatter", mode: "lines", name: t,
      x: tg.map(d => d.label), y: tg.map(d => d[t]),
      stackgroup: "one",
      line: { width: 0.5, color: colors[t] },
      fillcolor: colors[t] + "cc",
      hovertemplate: `<b>%{x}</b><br>${t}: %{y:.1f} GB<extra></extra>`,
    }));
    const layout = {
      margin: { l: 40, r: 12, t: 8, b: 28 },
      xaxis: { ...cleanAxis(), tickangle: -40, nticks: 8 },
      yaxis: { ...cleanAxis("GB"), rangemode: "tozero", tickformat: ".0f" },
      legend: { orientation: "h", y: -0.32, font: { ...font, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      height: (opts && opts.height) || 340,
    };
    draw(id, traces, layout);
  }

  /* -------------------------------------------------------------------- */
  /* Top directories horizontal bars                                        */
  /* -------------------------------------------------------------------- */
  function directoryBars(id, opts) {
    const dirs = window.CloudSightData.topDirectories.slice().reverse();
    const trace = {
      type: "bar", orientation: "h",
      x: dirs.map(d => d.gb), y: dirs.map(d => d.name),
      marker: { color: dirs.map(d => d.color), line: { color: "#fff", width: 1 } },
      hovertemplate: "<b>%{y}</b><br>%{x:.1f} GB<extra></extra>",
      width: 0.62,
    };
    const layout = {
      margin: { l: 130, r: 16, t: 8, b: 24 },
      xaxis: { ...cleanAxis("GB"), tickformat: ".0f" },
      yaxis: { ...cleanAxis(), automargin: true, tickfont: { ...font, size: 11.5, color: P.text } },
      height: (opts && opts.height) || 280,
      showlegend: false,
    };
    draw(id, [trace], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Type analysis combo: bar (count) + line (avg size)                     */
  /* -------------------------------------------------------------------- */
  function typeAnalysisCombo(id, opts) {
    const ta = window.CloudSightData.typeAnalysis;
    const bar = {
      type: "bar", name: "File count",
      x: ta.map(d => d.type), y: ta.map(d => d.count),
      marker: { color: P.brand, line: { color: "#fff", width: 1 } },
      hovertemplate: "<b>%{x}</b><br>%{y:,} files<extra></extra>",
      yaxis: "y",
    };
    const line = {
      type: "scatter", mode: "lines+markers", name: "Avg size (MB)",
      x: ta.map(d => d.type), y: ta.map(d => d.avgSizeMB),
      line: { color: P.amber, width: 2.5 }, marker: { size: 6, color: P.amber },
      hovertemplate: "<b>%{x}</b><br>Avg %{y:.1f} MB<extra></extra>",
      yaxis: "y2",
    };
    const layout = {
      margin: { l: 44, r: 44, t: 8, b: 28 },
      xaxis: { ...cleanAxis() },
      yaxis: { ...cleanAxis("Files"), tickformat: ",d" },
      yaxis2: { ...cleanAxis("MB"), overlaying: "y", side: "right", showgrid: false, tickformat: ".0f" },
      legend: { orientation: "h", y: 1.08, x: 0, font: { ...font, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      height: (opts && opts.height) || 320,
    };
    draw(id, [bar, line], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Network throughput line (download + upload)                            */
  /* -------------------------------------------------------------------- */
  function throughput(id, opts) {
    const t = window.CloudSightData.throughput60s;
    const x = t.dl.map((_, i) => i + "s");
    const dl = {
      type: "scatter", mode: "lines", name: "Download",
      x, y: t.dl, line: { color: P.brand, width: 2.2, shape: "spline", smoothing: 1.1 },
      fill: "tozeroy", fillcolor: "rgba(99,102,241,0.10)",
      hovertemplate: "<b>%{x}</b><br>%{y:.0f} Mbps<extra></extra>",
    };
    const up = {
      type: "scatter", mode: "lines", name: "Upload",
      x, y: t.up, line: { color: P.emerald, width: 2.2, shape: "spline", smoothing: 1.1 },
      fill: "tozeroy", fillcolor: "rgba(16,185,129,0.10)",
      hovertemplate: "<b>%{x}</b><br>%{y:.0f} Mbps<extra></extra>",
    };
    const layout = {
      margin: { l: 44, r: 12, t: 24, b: 28 },
      xaxis: { ...cleanAxis("Seconds"), nticks: 8 },
      yaxis: { ...cleanAxis("Mbps"), tickformat: ".0f", rangemode: "tozero" },
      legend: { orientation: "h", y: 1.12, x: 0, font: { ...font, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      height: (opts && opts.height) || 300,
    };
    draw(id, [dl, up], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Storage by type — horizontal bar (used in analytics side panel)        */
  /* -------------------------------------------------------------------- */
  function usageByTypeBars(id, opts) {
    const data = window.CloudSightData.usageByType.slice().reverse();
    const trace = {
      type: "bar", orientation: "h",
      x: data.map(d => d.gb), y: data.map(d => d.type),
      marker: { color: data.map(d => d.color), line: { color: "#fff", width: 1 } },
      hovertemplate: "<b>%{y}</b><br>%{x:.1f} GB<extra></extra>", width: 0.62,
    };
    const layout = {
      margin: { l: 80, r: 16, t: 8, b: 24 },
      xaxis: { ...cleanAxis("GB"), tickformat: ".0f" },
      yaxis: { ...cleanAxis(), automargin: true, tickfont: { ...font, size: 11.5, color: P.text } },
      height: (opts && opts.height) || 260,
      showlegend: false,
    };
    draw(id, [trace], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Residual / actual-vs-predicted scatter (prediction diagnostics)        */
  /* -------------------------------------------------------------------- */
  function predictionVsActual(id, opts) {
    const hist = window.CloudSightData.prediction.history;
    const slope = window.CloudSightData.prediction.slopePerMonth;
    const intercept = window.CloudSightData.prediction.intercept;
    const actual = hist.map(d => d.usedGB);
    const fitted = hist.map((d, i) => +(intercept + slope * (hist.length - 1 - (hist.length - 1 - i))).toFixed(1));
    // simple fitted line from x=0..n using stored intercept (anchor to first)
    const minX = Math.min(...actual), maxX = Math.max(...actual);
    const scatter = {
      type: "scatter", mode: "markers", name: "Actual",
      x: actual, y: fitted,
      marker: { color: P.brand, size: 7, line: { color: "#fff", width: 1 } },
      hovertemplate: "Actual %{x:.0f} GB → Predicted %{y:.0f} GB<extra></extra>",
    };
    const line = {
      type: "scatter", mode: "lines", name: "Ideal (y = x)",
      x: [minX - 5, maxX + 5], y: [minX - 5, maxX + 5],
      line: { color: P.slate, width: 1.6, dash: "dash" },
      hoverinfo: "skip",
    };
    const layout = {
      margin: { l: 48, r: 16, t: 8, b: 36 },
      xaxis: { ...cleanAxis("Actual used (GB)"), tickformat: ".0f" },
      yaxis: { ...cleanAxis("Predicted (GB)"), tickformat: ".0f", scaleanchor: "x", scaleratio: 1 },
      legend: { orientation: "h", y: 1.08, x: 0, font: { ...font, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      height: (opts && opts.height) || 300,
    };
    draw(id, [scatter, line], layout);
  }

  /* -------------------------------------------------------------------- */
  /* Expose                                                                */
  /* -------------------------------------------------------------------- */
  window.CloudSightCharts = {
    storageDonut, growthArea, forecastChart, typeDistributionStacked,
    directoryBars, typeAnalysisCombo, throughput, usageByTypeBars,
    predictionVsActual,
  };

  // redraw helper on resize (debounced)
  let t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      document.querySelectorAll("[data-chart]").forEach(function (el) {
        if (el._fullLayout) Plotly.Plots.resize(el);
      });
    }, 180);
  });
})();
