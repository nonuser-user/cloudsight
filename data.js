/* CloudSight — sample/fallback data.
   When MySQL is connected, api.js overwrites these with real values.
   Starts at zero so no fake numbers flash before the API responds. */
(function () {
  "use strict";

  // Helper to build a date label N months before a fixed "today".
  function monthsBack(n) {
    const d = new Date(2026, 9, 26); // fixed "today" for repeatable demos
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 10);
  }
  const mmm = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortMonth(iso) { const d = new Date(iso); return mmm[d.getMonth()] + " " + String(d.getFullYear()).slice(2); }

  /* -------------------------------------------------------------------- */
  /* Storage summary                                                      */
  /* -------------------------------------------------------------------- */
  const TOTAL_GB = 500;
  const USED_GB = 0;          // starts at 0; replaced by live API on page load
  const summary = {
    totalStorageGB: TOTAL_GB,
    usedStorageGB: USED_GB,
    remainingGB: TOTAL_GB,
    usedPercent: 0,
    fileCount: 0,
    fileCountTrendPct: 0,
    usedTrendPct: 0,
    remainingTrendPct: 0,
    avgFileSizeMB: 0,
    lastBackup: "—",
    bucket: "uploads/",
    provider: "Local filesystem",
  };

  /* -------------------------------------------------------------------- */
  /* Storage usage by file type (donut)                                    */
  /* -------------------------------------------------------------------- */
  const usageByType = [
    { type: "Videos",     gb: 128.6, color: "#6366f1" },
    { type: "Images",     gb: 84.2,  color: "#0ea5e9" },
    { type: "Documents",  gb: 62.8,  color: "#10b981" },
    { type: "Archives",    gb: 44.3,  color: "#f59e0b" },
    { type: "Audio",       gb: 28.1,  color: "#a855f7" },
    { type: "Code",        gb: 14.5,  color: "#14b8a6" },
    { type: "Other",       gb: 9.9,   color: "#94a3b8" },
  ];

  /* -------------------------------------------------------------------- */
  /* Historical storage growth (24 months)                                 */
  /* -------------------------------------------------------------------- */
  // A gentle upward curve so the Linear Regression forecast looks realistic.
  const historyRaw = [
    168, 176, 182, 189, 197, 205, 214, 223, 231, 239, 246, 253,
    261, 268, 276, 285, 293, 305, 318, 328, 338, 351, 361, 372.4
  ];
  const history = historyRaw.map((gb, i) => {
    const iso = monthsBack(23 - i);
    return { date: iso, label: shortMonth(iso), usedGB: gb, uploadedGB: +(Math.random() * 12 + 6).toFixed(1) };
  });

  /* Recent files — starts empty, filled by API */
  const recentFiles = [];

  /* Largest files — starts empty, filled by API */
  const largestFiles = [];

  /* -------------------------------------------------------------------- */
  /* File-type distribution over time (stacked area for analytics page)    */
  /* -------------------------------------------------------------------- */
  const typeGrowth = history.map((h, i) => {
    const factor = 0.85 + (i / 23) * 0.45;
    return {
      date: h.date, label: h.label,
      Videos:    +(128.6 * factor * (0.4 + i / 60)).toFixed(1),
      Images:    +(84.2  * factor * (0.5 + i / 70)).toFixed(1),
      Documents: +(62.8  * factor * (0.6 + i / 80)).toFixed(1),
      Archives:  +(44.3  * factor * (0.5 + i / 90)).toFixed(1),
      Audio:     +(28.1  * factor * (0.6 + i / 90)).toFixed(1),
      Code:      +(14.5  * factor * (0.5 + i / 95)).toFixed(1),
    };
  });

  /* -------------------------------------------------------------------- */
  /* Storage by directory (top folders)                                     */
  /* -------------------------------------------------------------------- */
  const topDirectories = [
    { name: "/projects/thesis",          gb: 96.4, color: "#6366f1" },
    { name: "/media/videos",             gb: 84.1, color: "#0ea5e9" },
    { name: "/datasets",                 gb: 72.8, color: "#10b981" },
    { name: "/backups",                  gb: 58.3, color: "#f59e0b" },
    { name: "/media/photos",             gb: 31.2, color: "#a855f7" },
    { name: "/documents",               gb: 19.6, color: "#14b8a6" },
    { name: "/misc",                     gb: 10.0, color: "#94a3b8" },
  ];

  /* -------------------------------------------------------------------- */
  /* File-type analysis (count + avg size)                                 */
  /* -------------------------------------------------------------------- */
  const typeAnalysis = [
    { type: "Images",    count: 5821, avgSizeMB: 14.4, sharePct: 45.3 },
    { type: "Documents", count: 3144, avgSizeMB: 20.0, sharePct: 16.9 },
    { type: "Videos",    count:  612, avgSizeMB: 210.2, sharePct: 34.5 },
    { type: "Audio",     count:  898, avgSizeMB: 31.2, sharePct: 7.5 },
    { type: "Archives",  count: 1024, avgSizeMB: 43.3, sharePct: 11.9 },
    { type: "Code",      count:  942, avgSizeMB: 15.4, sharePct: 3.9 },
    { type: "Other",     count:  406, avgSizeMB: 24.3, sharePct: 2.7 },
  ];

  /* -------------------------------------------------------------------- */
  /* ML prediction (Linear Regression forecast)                             */
  /* -------------------------------------------------------------------- */
  // Forecast extends the historical curve 12 months forward using a fitted
  // slope (~ +8.7 GB/month) plus a confidence band. Numbers are illustrative.
  const forecastMonths = 12;
  const slopePerMonth = 8.7;
  const lastUsed = history[history.length - 1].usedGB;
  const forecast = [];
  for (let i = 1; i <= forecastMonths; i++) {
    const iso = (function () {
      const d = new Date(2026, 9, 26); d.setMonth(d.getMonth() + i); return d.toISOString().slice(0, 10);
    })();
    const predicted = +(lastUsed + slopePerMonth * i).toFixed(1);
    const band = +(9 + i * 2.1).toFixed(1); // grows with horizon
    forecast.push({ date: iso, label: shortMonth(iso), predicted, lower: +(predicted - band).toFixed(1), upper: +(predicted + band).toFixed(1) });
  }
  const prediction = {
    model: "Linear Regression (scikit-learn)",
    feature: "Months since start",
    target: "Used storage (GB)",
    horizonMonths: forecastMonths,
    slopePerMonth,
    intercept: 162.4,
    rSquared: 0.974,
    rmseGB: 7.9,
    maeGB: 6.2,
    currentUsedGB: lastUsed,
    predictedIn6Months: +(lastUsed + slopePerMonth * 6).toFixed(1),
    predictedIn12Months: +(lastUsed + slopePerMonth * 12).toFixed(1),
    capacityGB: TOTAL_GB,
    capacityReachedDate: "2027-04",
    confidence: 0.95,
    history,
    forecast,
  };

  /* -------------------------------------------------------------------- */
  /* Network simulation & info                                              */
  /* -------------------------------------------------------------------- */
  const networkInfo = {
    provider: "Local filesystem",
    region: "Local · same machine",
    endpoint: "http://127.0.0.1:5000/uploads/",
    protocol: "HTTP (Flask dev server)",
    status: "Operational",
    uptime30d: "100%",
    latencyMs: 38,
    downloadMbps: 940,
    uploadMbps: 420,
    packetsLostPct: 0.04,
    activeConnections: 6,
    r2Buckets: 3,
    r2StorageClass: "Standard",
  };

  // Throughput over the last 60s for the live-ish simulation chart.
  const throughput60s = (function () {
    const dl = [], up = [];
    for (let i = 0; i < 60; i++) {
      dl.push(+(760 + Math.sin(i / 5) * 120 + Math.random() * 60).toFixed(0));
      up.push(+(300 + Math.cos(i / 6) * 70 + Math.random() * 40).toFixed(0));
    }
    return { dl, up };
  })();

  // Transfer simulation presets: estimate time to upload a given file size.
  const transferSim = {
    presets: [
      { label: "Document (10 MB)",   mb: 10 },
      { label: "Album (250 MB)",      mb: 250 },
      { label: "HD video (4 GB)",     mb: 4096 },
      { label: "Dataset (25 GB)",     mb: 25600 },
    ],
    defaultMbps: networkInfo.uploadMbps,
  };

  /* -------------------------------------------------------------------- */
  /* File manager — folder tree + file list                                 */
  /* -------------------------------------------------------------------- */
  const folderTree = [
    { name: "projects",      icon: "folder", path: "/projects" },
    { name: "media",         icon: "folder", path: "/media" },
    { name: "datasets",      icon: "folder", path: "/datasets" },
    { name: "backups",       icon: "folder", path: "/backups" },
    { name: "documents",    icon: "folder", path: "/documents" },
  ];

  const fileManagerFiles = [
    { name: "Thesis_Draft_v4.docx",      type: "doc",   size: "4.2 MB",  sizeBytes: 4404019,  modified: "Oct 26, 2026", owner: "You",     starred: true,  status: "Synced" },
    { name: "dataset_landsat_2026.zip",   type: "zip",   size: "1.8 GB",  sizeBytes: 1932735283, modified: "Oct 25, 2026", owner: "You",    starred: false, status: "Synced" },
    { name: "orientation_video.mp4",     type: "vid",   size: "642 MB",  sizeBytes: 673185792, modified: "Oct 24, 2026", owner: "P. Rao",  starred: true,  status: "Synced" },
    { name: "sensor_readings_q3.csv",    type: "doc",   size: "18.4 MB", sizeBytes: 19293798, modified: "Oct 23, 2026", owner: "You",     starred: false, status: "Synced" },
    { name: "podcast_episode_12.mp3",     type: "aud",   size: "88 MB",   sizeBytes: 92274688, modified: "Oct 22, 2026", owner: "You",     starred: false, status: "Uploading" },
    { name: "analytics_module.py",       type: "code",  size: "32 KB",   sizeBytes: 32768,   modified: "Oct 22, 2026", owner: "You",     starred: false, status: "Synced" },
    { name: "campus_photo.jpg",          type: "img",   size: "5.1 MB",  sizeBytes: 5354086,  modified: "Oct 21, 2026", owner: "S. Iyer", starred: true,  status: "Synced" },
    { name: "report_final.pdf",          type: "doc",   size: "9.6 MB",  sizeBytes: 10066330, modified: "Oct 20, 2026", owner: "You",     starred: false, status: "Synced" },
    { name: "raw_footage_intro.mp4",      type: "vid",   size: "528 MB",  sizeBytes: 553648128, modified: "Oct 19, 2026", owner: "You",     starred: false, status: "Synced" },
    { name: "model_checkpoint.h5",        type: "doc",   size: "410 MB",  sizeBytes: 429916160, modified: "Oct 18, 2026", owner: "You",     starred: false, status: "Synced" },
    { name: "logo_assets.zip",           type: "zip",   size: "62 MB",   sizeBytes: 65011712, modified: "Oct 17, 2026", owner: "Design",  starred: false, status: "Synced" },
    { name: "voiceover_take_3.wav",       type: "aud",   size: "141 MB",  sizeBytes: 147849216, modified: "Oct 16, 2026", owner: "You",     starred: false, status: "Failed" },
  ];

  /* -------------------------------------------------------------------- */
  /* User profile                                                          */
  /* -------------------------------------------------------------------- */
  const user = {
    name: "Aarav Mehta",
    initials: "AM",
    email: "aarav.mehta@university.edu",
    phone: "+91 98765 43210",
    role: "Research Scholar · BCA",
    institution: "University Department of Computer Applications",
    studentId: "BCA-2023-1042",
    plan: "Premium · 500 GB",
    memberSince: "Aug 2024",
    twoFactor: true,
    storageBreakdown: usageByType,
  };

  /* -------------------------------------------------------------------- */
  /* Notifications / activity feed                                          */
  /* -------------------------------------------------------------------- */
  const activity = [
    { icon: "upload", title: "Uploaded dataset_landsat_2026.zip", meta: "1.8 GB · Oct 25", tone: "brand" },
    { icon: "chart",  title: "ML forecast refreshed",                meta: "R² = 0.974 · Oct 25", tone: "success" },
    { icon: "share",  title: "Shared report_final.pdf with P. Rao", meta: "Oct 20", tone: "info" },
    { icon: "warn",   title: "Storage crossed 70% used",            meta: "Oct 12", tone: "warning" },
    { icon: "backup", title: "Backup completed to R2",              meta: "1,284 files · Oct 11", tone: "success" },
  ];

  /* -------------------------------------------------------------------- */
  /* Expose                                                                */
  /* -------------------------------------------------------------------- */
  window.CloudSightData = {
    IS_SAMPLE: true,
    summary,
    usageByType,
    history,
    recentFiles,
    largestFiles,
    typeGrowth,
    topDirectories,
    typeAnalysis,
    prediction,
    networkInfo,
    throughput60s,
    transferSim,
    folderTree,
    fileManagerFiles,
    user,
    activity,
    // shared palette so charts stay on-brand everywhere
    palette: {
      brand: "#6366f1", brandDark: "#4f46e5", brandLight: "#c7d2fe",
      sky: "#0ea5e9", emerald: "#10b981", amber: "#f59e0b",
      violet: "#a855f7", teal: "#14b8a6", slate: "#94a3b8",
      grid: "#eef0f4", text: "#334155", textMuted: "#64748b",
    },
  };
})();
