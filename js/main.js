/* CloudSight — UI interactions and data-driven HTML renderers. */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Tiny utils                                                          */
  /* ------------------------------------------------------------------ */
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D = window.CloudSightData || {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtBytes(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + " KB";
    return n + " B";
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  /* ------------------------------------------------------------------ */
  /* File-type icon set                                                  */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 22"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>',
    vid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m10 9 5 3-5 3z"/></svg>',
    aud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12v2M10 16v2"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/></svg>',
    def: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  };
  function fileIconClass(type) {
    return ({ img: "file-ico--img", doc: "file-ico--doc", vid: "file-ico--vid", aud: "file-ico--aud", zip: "file-ico--zip", code: "file-ico--code", folder: "file-ico--folder" })[type] || "file-ico--def";
  }
  function fileIconSvg(type) { return ICONS[type] || ICONS.def; }
  window.CloudSightFileIcon = fileIconSvg;

  /* ------------------------------------------------------------------ */
  /* Chrome: sidebar, dropdowns, password toggle                         */
  /* ------------------------------------------------------------------ */  function setupChrome() {
    const sidebar = qs("#sidebar");
    const backdrop = qs("#sidebarBackdrop");
    const toggle = qs("#sidebarToggle");
    if (toggle && sidebar && backdrop) {
      const open = () => { sidebar.classList.add("is-open"); backdrop.classList.add("is-open"); };
      const close = () => { sidebar.classList.remove("is-open"); backdrop.classList.remove("is-open"); };
      toggle.addEventListener("click", open);
      backdrop.addEventListener("click", close);
      qsa(".nav-item").forEach(a => a.addEventListener("click", () => { if (window.innerWidth < 992) close(); }));
    }

    // dropdowns (notifications + profile)
    const pairs = [["#notifBtn", "#notifMenu"], ["#profileBtn", "#profileMenu"]];
    pairs.forEach(([btnSel, menuSel]) => {
      const btn = qs(btnSel), menu = qs(menuSel);
      if (!btn || !menu) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // close others
        qsa(".menu.is-open").forEach(m => { if (m !== menu) m.classList.remove("is-open"); });
        menu.classList.toggle("is-open");
      });
      menu.addEventListener("click", (e) => e.stopPropagation());
    });
    document.addEventListener("click", () => qsa(".menu.is-open").forEach(m => m.classList.remove("is-open")));

    // password show/hide
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".toggle-pw");
      if (!btn) return;
      const targetId = btn.getAttribute("data-toggle");
      const input = targetId ? document.getElementById(targetId) : btn.parentElement.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.style.color = show ? "var(--brand-600)" : "var(--text-faint)";
    });

    // segment toggles (generic)
    qsa(".segment").forEach(seg => {
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        qsa("button", seg).forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        seg.dispatchEvent(new CustomEvent("segment:change", { detail: { value: b.dataset.value } }));
      });
    });

    // tab bars (generic)
    qsa(".tabbar").forEach(bar => {
      bar.addEventListener("click", (e) => {
        const b = e.target.closest(".tabbar__btn"); if (!b) return;
        qsa(".tabbar__btn", bar).forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        bar.dispatchEvent(new CustomEvent("tab:change", { detail: { value: b.dataset.value, btn: b } }));
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */
  function toast(title, msg, tone) {
    let stack = qs("#toastStack");
    if (!stack) { stack = document.createElement("div"); stack.id = "toastStack"; stack.className = "toast-stack"; document.body.appendChild(stack); }
    const toneClass = tone === "success" ? "toast-pop--success" : tone === "danger" ? "toast-pop--danger" : tone === "warning" ? "toast-pop--warning" : "toast-pop--brand";
    const ico = tone === "success" ? '<path d="M20 6 9 17l-5-5"/>' : tone === "danger" ? '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>' : tone === "warning" ? '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>' : '<path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/>';
    const el = document.createElement("div");
    el.className = "toast-pop " + toneClass;
    el.innerHTML = `<svg class="toast-pop__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ico}</svg>
      <div class="flex-grow-1"><div class="toast-pop__title">${esc(title)}</div><div class="toast-pop__msg">${esc(msg)}</div></div>
      <button class="icon-btn" style="width:26px;height:26px" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    stack.appendChild(el);
    el.querySelector("button").addEventListener("click", () => el.remove());
    setTimeout(() => { if (el.parentNode) el.style.transition = "opacity .25s, transform .25s"; el.style.opacity = "0"; el.style.transform = "translateX(10px)"; setTimeout(() => el.remove(), 260); }, 4200);
  }
  window.CloudSightToast = toast;

  /* ------------------------------------------------------------------ */
  /* Renderers — KPIs                                                    */
  /* ------------------------------------------------------------------ */
  function trendBadge(pct, invert) {
    const up = pct >= 0;
    const good = invert ? !up : up; // for "remaining" lower is concerning
    const cls = good ? "kpi__trend--up" : "kpi__trend--down";
    const arrow = up ? '<path d="m5 12 7-7 7 7"/>' : '<path d="m5 12 7 7 7-7"/>';
    return `<span class="kpi__trend ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">${arrow}</svg>${Math.abs(pct)}%</span>`;
  }

  function renderKPIs() {
    const wrap = qs("[data-kpis]"); if (!wrap) return;
    const s = D.summary;
    const cards = [
      {
        iconCls: "kpi__icon--brand", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>',
        label: "Total Storage", value: `${s.totalStorageGB}<small> GB</small>`, meta: `${trendBadge(s.usedTrendPct)} <span class="text-muted-2">vs last month</span>`,
      },
      {
        iconCls: "kpi__icon--success", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
        label: "Used Storage", value: `${s.usedStorageGB}<small> GB</small>`, meta: `${s.usedPercent}% of plan · <span class="badge-soft ${s.usedPercent >= 90 ? 'badge-soft--danger' : s.usedPercent >= 70 ? 'badge-soft--warning' : 'badge-soft--success'}">${s.usedPercent >= 90 ? 'Critical' : s.usedPercent >= 70 ? 'High' : 'Normal'}</span>`,
      },
      {
        iconCls: "kpi__icon--info", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
        label: "Remaining", value: `${s.remainingGB}<small> GB</small>`, meta: `${trendBadge(s.remainingTrendPct, true)} <span class="text-muted-2">vs last month</span>`,
      },
      {
        iconCls: "kpi__icon--warning", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9h16M9 4v16"/></svg>',
        label: "Total Files", value: `${s.fileCount.toLocaleString()}`, meta: `${trendBadge(s.fileCountTrendPct)} <span class="text-muted-2">new files</span>`,
      },
    ];
    wrap.innerHTML = cards.map(c => `
      <div class="col-12 col-sm-6 col-xxl-3">
        <div class="kpi fade-up">
          <div class="kpi__top">
            <span class="kpi__icon ${c.iconCls}">${c.icon}</span>
          </div>
          <div>
            <div class="kpi__label">${c.label}</div>
            <div class="kpi__value">${c.value}</div>
          </div>
          <div class="kpi__meta">${c.meta}</div>
        </div>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — storage donut + legend                                   */
  /* ------------------------------------------------------------------ */
  function renderTypeLegend(target, withPct) {
    const el = qs(target); if (!el) return;
    const total = D.usageByType.reduce((a, b) => a + b.gb, 0);
    el.innerHTML = D.usageByType.map(d => `
      <div class="d-flex align-items-center justify-content-between py-2">
        <div class="d-flex align-items-center gap-2">
          <span class="dot-status" style="background:${d.color}"></span>
          <span style="font-size:13.5px;color:var(--text)">${d.type}</span>
        </div>
        <div class="d-flex align-items-center gap-3">
          <span style="font-size:13px;color:var(--text-muted)">${d.gb.toFixed(1)} GB</span>
          ${withPct ? `<span class="badge-soft badge-soft--neutral">${(d.gb / total * 100).toFixed(1)}%</span>` : ""}
        </div>
      </div>`).join("");
  }

  function renderStorageBar(target) {
    const el = qs(target); if (!el) return;
    const s = D.summary;
    el.innerHTML = `
      <div class="d-flex align-items-end justify-content-between mb-2">
        <div>
          <div class="kpi__label">Storage plan usage</div>
          <div class="kpi__value">${s.usedStorageGB}<small> GB</small> <span class="text-faint" style="font-size:14px;font-weight:500">/ ${s.totalStorageGB} GB</span></div>
        </div>
        <span class="badge-soft ${s.usedPercent >= 70 ? "badge-soft--warning" : "badge-soft--success"}">${s.usedPercent}% used</span>
      </div>
      <div class="progress-soft mb-3"><div class="progress-soft__bar ${s.usedPercent >= 70 ? "bar--warning" : "bar--success"}" style="width:${s.usedPercent}%"></div></div>
      <div class="d-flex justify-content-between" style="font-size:12.5px;color:var(--text-muted)">
        <span><i class="bi bi-check-circle-fill" style="color:var(--success)"></i> ${s.remainingGB} GB free</span>
        <span><i class="bi bi-cloud-fill" style="color:var(--brand-500)"></i> ${s.provider}</span>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — recent files table                                       */
  /* ------------------------------------------------------------------ */
  function renderRecentFiles(target, limit) {
    const el = qs(target); if (!el) return;
    const rows = (D.recentFiles || []).slice(0, limit || D.recentFiles.length);
    el.innerHTML = rows.map(f => `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <span class="file-ico ${fileIconClass(f.type)}">${fileIconSvg(f.type)}</span>
            <div class="minw-0">
              <div class="cell-strong text-truncate" style="max-width:230px">${esc(f.name)}</div>
              <div class="cell-muted" style="font-size:12px">${f.owner}${f.shared ? ' · <i class="bi bi-people-fill" style="font-size:11px"></i> Shared' : ""}</div>
            </div>
          </div>
        </td>
        <td class="cell-muted">${f.size}</td>
        <td class="cell-muted">${fmtDate(f.modified)}</td>
        <td class="text-end">
          <div class="d-flex justify-content-end gap-1">
            <button class="icon-btn" title="Download" data-act="download" data-name="${esc(f.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/></svg></button>
            <button class="icon-btn" title="Rename" data-act="rename" data-name="${esc(f.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
            <button class="icon-btn" title="Delete" data-act="delete" data-name="${esc(f.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
          </div>
        </td>
      </tr>`).join("");

    // wire actions
    qsa("[data-act]", el).forEach(btn => btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const name = btn.getAttribute("data-name");
      if (act === "download") toast("Download started", `${name} is downloading from ${D.summary.provider}.`, "success");
      else if (act === "rename") toast("Rename", `Rename mode for “${name}” (demo).`, "brand");
      else if (act === "delete") toast("Move to trash?", `“${name}” would be deleted after confirmation (demo).`, "warning");
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — largest files                                            */
  /* ------------------------------------------------------------------ */
  function renderLargestFiles(target) {
    const el = qs(target); if (!el) return;
    const max = Math.max(...D.largestFiles.map(f => f.pct));
    el.innerHTML = D.largestFiles.map(f => `
      <div class="list-row">
        <span class="file-ico ${fileIconClass(f.type)}">${fileIconSvg(f.type)}</span>
        <div class="flex-grow-1 minw-0">
          <div class="cell-strong text-truncate" style="max-width:200px">${esc(f.name)}</div>
          <div class="progress-soft mt-1" style="height:6px"><div class="progress-soft__bar bar--brand" style="width:${(f.pct / max) * 100}%"></div></div>
        </div>
        <span class="badge-soft badge-soft--neutral ms-auto">${f.size}</span>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — activity feed                                            */
  /* ------------------------------------------------------------------ */
  const ACT_ICONS = {
    upload: '<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 3 4-6"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    backup: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  };
  function renderActivity(target) {
    const el = qs(target); if (!el) return;
    const toneClass = { brand: "file-ico--brand", success: "file-ico--success", info: "file-ico--info", warning: "file-ico--warning" };
    el.innerHTML = D.activity.map(a => `
      <div class="d-flex align-items-start gap-3 py-2">
        <span class="file-ico ${toneClass[a.tone] || "file-ico--def"}" style="width:34px;height:34px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17">${ACT_ICONS[a.icon] || ""}</svg></span>
        <div class="flex-grow-1">
          <div style="font-size:13.5px;color:var(--text-strong);font-weight:500">${esc(a.title)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${esc(a.meta)}</div>
        </div>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — file manager grid + list                                 */
  /* ------------------------------------------------------------------ */
  function statusBadge(status) {
    if (status === "Synced") return '<span class="badge-soft badge-soft--success"><span class="dot-status" style="background:var(--success)"></span> Synced</span>';
    if (status === "Uploading") return '<span class="badge-soft badge-soft--info"><span class="spinner-soft" style="width:11px;height:11px;border-width:1.5px"></span> Uploading</span>';
    if (status === "Failed") return '<span class="badge-soft badge-soft--danger"><span class="dot-status" style="background:var(--danger)"></span> Failed</span>';
    return `<span class="badge-soft badge-soft--neutral">${esc(status)}</span>`;
  }

  const _DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
  const _DL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/></svg>';

  function _doDelete(name, key, rowEl) {
    if (!confirm('Delete "' + name + '"?\nThis permanently removes the file.')) return;
    fetch("/api/files/delete", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.ok) {
        if (rowEl) rowEl.remove();
        toast("Deleted", '"' + name + '" was removed.', "success");
        if (window.CloudSightAPI) window.CloudSightAPI.loadSummary();
      } else {
        toast("Error", data.error || "Delete failed.", "danger");
      }
    })
    .catch(function(){ toast("Error", "Request failed.", "danger"); });
  }

  function renderFileManagerList(target) {
    const el = qs(target); if (!el) return;
    const DL = _DL, DEL = _DEL;
    el.innerHTML = D.fileManagerFiles.map(function(f) {
      return '<tr>'
        + '<td><div class="d-flex align-items-center gap-3">'
        + '<span class="file-ico ' + fileIconClass(f.type) + '">' + fileIconSvg(f.type) + '</span>'
        + '<div class="cell-strong">' + esc(f.name) + '</div></div></td>'
        + '<td class="cell-muted">' + f.size + '</td>'
        + '<td class="cell-muted">' + f.modified + '</td>'
        + '<td class="cell-muted">' + esc(f.owner || "You") + '</td>'
        + '<td>' + statusBadge(f.status) + '</td>'
        + '<td class="text-end"><div class="d-flex justify-content-end gap-1">'
        + '<a class="icon-btn" title="Download" href="/uploads/' + esc(f.r2_key || ("users/1/" + f.name)) + '">' + DL + '</a>'
        + '<button class="icon-btn" style="color:var(--danger)" title="Delete"'
        + ' data-name="' + esc(f.name) + '" data-key="' + esc(f.r2_key || ("users/1/" + f.name)) + '">' + DEL + '</button>'
        + '</div></td></tr>';
    }).join("");
    qsa("[data-key]", el).forEach(function(btn) {
      btn.addEventListener("click", function() {
        _doDelete(btn.getAttribute("data-name"), btn.getAttribute("data-key"), btn.closest("tr"));
      });
    });
  }

  function renderFileManagerGrid(target) {
    const el = qs(target); if (!el) return;
    const DL = _DL, DEL = _DEL;
    el.innerHTML = D.fileManagerFiles.map(function(f) {
      return '<div class="col">'
        + '<div class="card-base p-3 h-100 d-flex flex-column">'
        + '<div class="d-flex align-items-center justify-content-between mb-2">'
        + '<span class="file-ico ' + fileIconClass(f.type) + '">' + fileIconSvg(f.type) + '</span>'
        + '<button class="icon-btn" style="color:var(--danger);width:28px;height:28px" title="Delete"'
        + ' data-name="' + esc(f.name) + '" data-key="' + esc(f.r2_key || ("users/1/" + f.name)) + '">' + DEL + '</button>'
        + '</div>'
        + '<div class="cell-strong text-truncate flex-grow-1" style="font-size:13px" title="' + esc(f.name) + '">' + esc(f.name) + '</div>'
        + '<div class="d-flex align-items-center justify-content-between mt-2">'
        + '<span class="cell-muted" style="font-size:12px">' + f.size + '</span>'
        + '<a class="icon-btn" style="width:28px;height:28px" href="/uploads/' + esc(f.r2_key || ("users/1/" + f.name)) + '" title="Download">' + DL + '</a>'
        + '</div></div></div>';
    }).join("");
    qsa("[data-key]", el).forEach(function(btn) {
      btn.addEventListener("click", function() {
        _doDelete(btn.getAttribute("data-name"), btn.getAttribute("data-key"), btn.closest(".col"));
      });
    });
  }

  function renderTypeAnalysisTable(target) {
    const el = qs(target); if (!el) return;
    el.innerHTML = D.typeAnalysis.map(t => `
      <tr>
        <td><div class="d-flex align-items-center gap-2"><span class="dot-status" style="background:${D.palette[t.type === "Videos" ? "brand" : t.type === "Images" ? "sky" : t.type === "Documents" ? "emerald" : t.type === "Archives" ? "amber" : t.type === "Audio" ? "violet" : "teal"]}"></span> ${t.type}</div></td>
        <td class="cell-strong">${t.count.toLocaleString()}</td>
        <td class="cell-muted">${t.avgSizeMB.toFixed(1)} MB</td>
        <td><div class="d-flex align-items-center gap-2"><div class="progress-soft" style="width:90px;height:6px"><div class="progress-soft__bar bar--brand" style="width:${t.sharePct}%"></div></div><span class="cell-muted" style="font-size:12px">${t.sharePct}%</span></div></td>
      </tr>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — prediction metrics                                       */
  /* ------------------------------------------------------------------ */
  function renderPredictionMetrics(target) {
    const el = qs(target); if (!el) return;
    const p = D.prediction;
    const tiles = [
      { label: "R² (coefficient of determination)", value: p.rSquared.toFixed(3), sub: "Excellent fit", tone: "success" },
      { label: "RMSE", value: p.rmseGB.toFixed(1) + " GB", sub: "Root mean squared error", tone: "neutral" },
      { label: "MAE", value: p.maeGB.toFixed(1) + " GB", sub: "Mean absolute error", tone: "neutral" },
      { label: "Slope", value: "+" + p.slopePerMonth.toFixed(1) + " GB/mo", sub: "Growth rate", tone: "brand" },
      { label: "Forecast (6 mo)", value: p.predictedIn6Months.toFixed(1) + " GB", sub: `+${((p.predictedIn6Months / p.currentUsedGB - 1) * 100).toFixed(1)}%`, tone: "info" },
      { label: "Forecast (12 mo)", value: p.predictedIn12Months.toFixed(1) + " GB", sub: `+${((p.predictedIn12Months / p.currentUsedGB - 1) * 100).toFixed(1)}%`, tone: "warning" },
    ];
    el.innerHTML = tiles.map(t => `
      <div class="metric-tile">
        <div class="metric-tile__label">${t.label}</div>
        <div class="metric-tile__value">${t.value}</div>
        <div class="metric-tile__sub">${t.sub}</div>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Renderers — network metrics                                          */
  /* ------------------------------------------------------------------ */
  function renderNetworkMetrics(target) {
    const el = qs(target); if (!el) return;
    const n = D.networkInfo;
    const tiles = [
      { label: "Latency", value: n.latencyMs + " ms", sub: "APAC · Mumbai", tone: "success" },
      { label: "Download", value: n.downloadMbps + " Mbps", sub: "Peak throughput", tone: "brand" },
      { label: "Upload", value: n.uploadMbps + " Mbps", sub: "Peak throughput", tone: "info" },
      { label: "Packet loss", value: n.packetsLostPct + "%", sub: "Within SLA", tone: "success" },
      { label: "Uptime (30d)", value: n.uptime30d, sub: "Service health", tone: "success" },
      { label: "Connections", value: n.activeConnections, sub: "Active to R2", tone: "neutral" },
    ];
    el.innerHTML = tiles.map(t => `
      <div class="metric-tile">
        <div class="metric-tile__label"><span class="dot-status" style="background:${t.tone === "success" ? "var(--success)" : t.tone === "warning" ? "var(--warning)" : "var(--brand-500)"}"></span> ${t.label}</div>
        <div class="metric-tile__value">${t.value}</div>
        <div class="metric-tile__sub">${t.sub}</div>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Transfer time calculator                                              */
  /* ------------------------------------------------------------------ */
  function calcTransferTime(mb, mbps) {
    const mbPerSec = mbps / 8;
    const sec = mb / mbPerSec;
    if (sec < 60) return sec.toFixed(1) + " s";
    if (sec < 3600) return (sec / 60).toFixed(1) + " min";
    return (sec / 3600).toFixed(2) + " h";
  }

  /* ------------------------------------------------------------------ */
  /* Expose renderers                                                     */
  /* ------------------------------------------------------------------ */
  window.CloudSightRender = {
    renderKPIs, renderTypeLegend, renderStorageBar,
    renderRecentFiles, renderLargestFiles, renderActivity,
    renderFileManagerList, renderFileManagerGrid,
    renderTypeAnalysisTable, renderPredictionMetrics,
    renderNetworkMetrics, calcTransferTime,
  };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                  */
  /* ------------------------------------------------------------------ */
  function boot() {
    setupChrome();
    // run renderers that have targets on this page
    renderKPIs();
    renderTypeLegend("[data-type-legend]");
    renderStorageBar("[data-storage-bar]");
    renderRecentFiles("[data-recent-files]");
    renderLargestFiles("[data-largest-files]");
    renderActivity("[data-activity]");
    renderFileManagerList("[data-fm-list]");
    renderFileManagerGrid("[data-fm-grid]");
    renderTypeAnalysisTable("[data-type-analysis]");
    renderPredictionMetrics("[data-prediction-metrics]");
    renderNetworkMetrics("[data-network-metrics]");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
