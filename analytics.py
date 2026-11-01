from datetime import datetime
from config import Config
from services import db

TYPE_NAME = {
    "vid": "Videos", "img": "Images", "doc": "Documents", "zip": "Archives",
    "aud": "Audio",  "code": "Code",  "folder": "Folders", "def": "Other",
}
TYPE_COLOR = {
    "Videos": "#6366f1", "Images": "#0ea5e9", "Documents": "#10b981",
    "Archives": "#f59e0b", "Audio": "#a855f7", "Code": "#14b8a6",
    "Folders": "#94a3b8", "Other": "#94a3b8",
}
TYPE_ORDER = ["Videos", "Images", "Documents", "Archives", "Audio", "Code", "Other"]

_M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def _label(d):
    if isinstance(d, str):
        d = datetime.fromisoformat(d)
    return f"{_M[d.month - 1]} {str(d.year)[2:]}"


def fmt_bytes(n):
    n = float(n)
    if n >= 1e9: return f"{n/1e9:.2f} GB"
    if n >= 1e6: return f"{n/1e6:.1f} MB"
    if n >= 1e3: return f"{n/1e3:.0f} KB"
    return f"{int(n)} B"


def get_summary(user_id):
    row = db.query(
        "SELECT COUNT(*) AS files, COALESCE(SUM(size_bytes),0) AS used_bytes "
        "FROM files WHERE user_id=%s", (user_id,), fetch="one")
    used_gb  = round(float(row["used_bytes"] or 0) / 1e9, 2)
    total_gb = float(Config.PLAN_TOTAL_GB)
    return {
        "totalStorageGB": total_gb,
        "usedStorageGB":  used_gb,
        "remainingGB":    round(max(total_gb - used_gb, 0), 2),
        "usedPercent":    round(used_gb / total_gb * 100, 1) if total_gb else 0,
        "fileCount":      int(row["files"] or 0),
        "usedTrendPct":   0,
        "remainingTrendPct": 0,
        "fileCountTrendPct": 0,
        "provider": "Local filesystem",
        "bucket":   "uploads/",
    }


def get_usage_by_type(user_id):
    rows = db.query(
        "SELECT type, COALESCE(SUM(size_bytes),0) AS bytes "
        "FROM files WHERE user_id=%s GROUP BY type ORDER BY bytes DESC",
        (user_id,)) or []
    by_name = {TYPE_NAME.get(r["type"], "Other"): float(r["bytes"] or 0) for r in rows}
    total   = sum(by_name.values()) or 1
    out = []
    for name in TYPE_ORDER:
        gb = round(by_name.get(name, 0) / 1e9, 2)
        if gb <= 0 and name not in by_name:
            continue
        out.append({"type": name, "gb": gb, "color": TYPE_COLOR[name],
                    "sharePct": round(by_name.get(name, 0) / total * 100, 1)})
    return out


def get_history(user_id, months=24):
    rows = db.query(
        "SELECT snapshot_date, used_gb, uploaded_gb "
        "FROM storage_snapshots WHERE user_id=%s "
        "ORDER BY snapshot_date DESC LIMIT %s",
        (user_id, months)) or []
    rows = list(reversed(rows))
    return [{"date":   r["snapshot_date"].isoformat()
                       if hasattr(r["snapshot_date"], "isoformat")
                       else str(r["snapshot_date"]),
             "label":  _label(r["snapshot_date"]),
             "usedGB": float(r["used_gb"]),
             "uploadedGB": float(r.get("uploaded_gb") or 0)}
            for r in rows]


def get_recent_files(user_id, limit=8):
    rows = db.query(
        "SELECT name, type, size_bytes, owner, shared, modified "
        "FROM files WHERE user_id=%s ORDER BY modified DESC LIMIT %s",
        (user_id, limit)) or []
    return [{"name":     r["name"],
             "type":     r["type"],
             "size":     fmt_bytes(r["size_bytes"]),
             "sizeBytes": int(r["size_bytes"]),
             "modified": (r["modified"].date().isoformat()
                          if hasattr(r["modified"], "date")
                          else str(r["modified"])),
             "owner":  r["owner"],
             "shared": bool(r["shared"])}
            for r in rows]


def get_largest_files(user_id, limit=5):
    rows = db.query(
        "SELECT name, type, size_bytes FROM files "
        "WHERE user_id=%s ORDER BY size_bytes DESC LIMIT %s",
        (user_id, limit)) or []
    max_b = max([int(r["size_bytes"]) for r in rows] or [1])
    return [{"name": r["name"], "type": r["type"],
             "size": fmt_bytes(r["size_bytes"]),
             "pct":  round(int(r["size_bytes"]) / max_b * 100)}
            for r in rows]


def get_top_directories(user_id):
    rows = db.query(
        "SELECT directory, COALESCE(SUM(size_bytes),0) AS bytes "
        "FROM files WHERE user_id=%s GROUP BY directory ORDER BY bytes DESC",
        (user_id,)) or []
    colors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#a855f7","#14b8a6","#94a3b8"]
    return [{"name":  r["directory"] or "/",
             "gb":    round(float(r["bytes"] or 0) / 1e9, 2),
             "color": colors[i % len(colors)]}
            for i, r in enumerate(rows)]


def get_type_analysis(user_id):
    rows = db.query(
        "SELECT type, COUNT(*) AS cnt, AVG(size_bytes) AS avg_bytes, "
        "COALESCE(SUM(size_bytes),0) AS bytes "
        "FROM files WHERE user_id=%s GROUP BY type", (user_id,)) or []
    total = sum(float(r["bytes"] or 0) for r in rows) or 1
    out = []
    for r in rows:
        name = TYPE_NAME.get(r["type"], "Other")
        out.append({"type": name,
                    "count": int(r["cnt"]),
                    "avgSizeMB": round(float(r["avg_bytes"] or 0) / 1e6, 1),
                    "sharePct":  round(float(r["bytes"] or 0) / total * 100, 1)})
    order = {n: i for i, n in enumerate(TYPE_ORDER)}
    out.sort(key=lambda x: order.get(x["type"], 99))
    return out


def get_file_manager_files(user_id):
    rows = db.query(
        "SELECT name, type, size_bytes, owner, shared, starred, status, modified, r2_key "
        "FROM files WHERE user_id=%s ORDER BY modified DESC", (user_id,)) or []
    return [{"name":     r["name"],
             "type":     r["type"],
             "size":     fmt_bytes(r["size_bytes"]),
             "sizeBytes": int(r["size_bytes"]),
             "r2_key":   r["r2_key"] or "",
             "modified": (r["modified"].strftime("%b %d, %Y")
                          if hasattr(r["modified"], "strftime")
                          else str(r["modified"])),
             "owner":    r["owner"],
             "starred":  bool(r["starred"]),
             "status":   r["status"]}
            for r in rows]


def get_type_growth(user_id):
    history = get_history(user_id)
    split   = get_usage_by_type(user_id)
    total   = sum(d["gb"] for d in split) or 1
    props   = {d["type"]: d["gb"] / total for d in split}
    n       = max(len(history) - 1, 1)
    out = []
    for i, h in enumerate(history):
        row = {"date": h["date"], "label": h["label"]}
        for t in ["Videos","Images","Documents","Archives","Audio","Code"]:
            row[t] = round(props.get(t, 0) * h["usedGB"] * (0.85 + 0.4 * (i/n)), 1)
        out.append(row)
    return out


def get_file_stats(user_id):
    total_row = db.query(
        "SELECT COUNT(*) AS n FROM files WHERE user_id=%s",
        (user_id,), fetch="one")
    total = int(total_row["n"] or 0)
    dir_rows = db.query(
        "SELECT directory, COUNT(*) AS n FROM files "
        "WHERE user_id=%s GROUP BY directory ORDER BY n DESC", (user_id,)) or []
    folders = [{"name": r["directory"] or "/", "count": int(r["n"])}
               for r in dir_rows]
    return {"total": total, "folders": folders}


def refresh_snapshot(user_id):
    from datetime import date
    today = date.today().isoformat()
    row   = db.query(
        "SELECT COALESCE(SUM(size_bytes),0) AS total FROM files WHERE user_id=%s",
        (user_id,), fetch="one")
    used_gb = round(float(row["total"] or 0) / 1e9, 4)
    db.execute(
        "INSERT INTO storage_snapshots (user_id, snapshot_date, used_gb, uploaded_gb) "
        "VALUES (%s,%s,%s,0) ON DUPLICATE KEY UPDATE used_gb=%s",
        (user_id, today, used_gb, used_gb))
    return used_gb


def build_dashboard(user_id):
    return {"summary":     get_summary(user_id),
            "usageByType": get_usage_by_type(user_id),
            "history":     get_history(user_id),
            "recentFiles": get_recent_files(user_id, 8),
            "largestFiles": get_largest_files(user_id, 5)}


def build_analytics(user_id):
    return {"summary":      get_summary(user_id),
            "usageByType":  get_usage_by_type(user_id),
            "history":      get_history(user_id),
            "topDirectories": get_top_directories(user_id),
            "typeGrowth":   get_type_growth(user_id),
            "typeAnalysis": get_type_analysis(user_id)}


def build_files(user_id):
    return get_file_manager_files(user_id)
