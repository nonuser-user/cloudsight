"""Linear Regression storage forecaster using scikit-learn."""
import math
from datetime import date, timedelta

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

_Z = {0.80: 1.282, 0.90: 1.645, 0.95: 1.960, 0.99: 2.576}
_M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def _label(d):
    return f"{_M[d.month-1]} {str(d.year)[2:]}"


def _add_months(d, months):
    y, m = d.year, d.month + months
    y += (m - 1) // 12
    m  = (m - 1) % 12 + 1
    return date(y, m, min(d.day, 28))


def forecast(history, horizon=12, capacity_gb=500.0, ci=0.95):
    if not history or len(history) < 2:
        raise ValueError("Need at least 2 data points.")

    used = np.array([float(h["usedGB"]) for h in history])
    x    = np.arange(len(history)).reshape(-1, 1)

    try:
        first_date = history[0]["date"]
        last_date  = history[-1]["date"]
        if isinstance(first_date, str): first_date = date.fromisoformat(first_date)
        if isinstance(last_date,  str): last_date  = date.fromisoformat(last_date)
    except Exception:
        first_date = date(2024, 11, 1)
        last_date  = date(2026, 10, 1)

    model = LinearRegression()
    model.fit(x, used)
    y_pred = model.predict(x)

    slope     = float(model.coef_[0])
    intercept = float(model.intercept_)
    r2   = float(r2_score(used, y_pred))
    rmse = float(math.sqrt(mean_squared_error(used, y_pred)))
    mae  = float(mean_absolute_error(used, y_pred))

    residuals = used - y_pred
    dof = max(len(used) - 2, 1)
    s2  = float(np.sum(residuals ** 2) / dof)
    z   = _Z.get(round(ci, 2), 1.96)
    x_mean = float(np.mean(x))
    sxx    = float(np.sum((x - x_mean) ** 2)) or 1.0
    n      = len(used)

    def band(h_idx):
        lev = 1.0 / n + (h_idx - x_mean) ** 2 / sxx
        return z * math.sqrt(s2 * (1.0 + lev))

    cur   = round(float(used[-1]), 1)
    p6    = round(float(intercept + slope * (n - 1 + 6)),  1)
    p12   = round(float(intercept + slope * (n - 1 + 12)), 1)

    cap_date = None
    if slope > 0:
        idx = (capacity_gb - intercept) / slope
        if idx >= 0:
            cap_date = _label(_add_months(first_date, int(math.floor(idx))))

    fc = []
    for k in range(1, horizon + 1):
        pred = float(intercept + slope * (n - 1 + k))
        b    = band(n - 1 + k)
        d    = _add_months(last_date, k)
        fc.append({"date": d.isoformat(), "label": _label(d),
                   "predicted": round(pred, 1),
                   "lower": round(pred - b, 1),
                   "upper": round(pred + b, 1)})

    hist = [{"date":       h["date"].isoformat()
                           if isinstance(h.get("date"), date)
                           else str(h.get("date", "")),
             "label":      h.get("label") or _label(first_date),
             "usedGB":     round(float(h["usedGB"]), 1),
             "uploadedGB": round(float(h.get("uploadedGB", 0) or 0), 1)}
            for h in history]

    return {"model": "Linear Regression (scikit-learn)",
            "feature": "Months since start",
            "target":  "Used storage (GB)",
            "horizonMonths":       horizon,
            "slopePerMonth":       round(slope, 2),
            "intercept":           round(intercept, 2),
            "rSquared":            round(r2, 4),
            "rmseGB":              round(rmse, 2),
            "maeGB":               round(mae, 2),
            "currentUsedGB":       cur,
            "predictedIn6Months":  p6,
            "predictedIn12Months": p12,
            "capacityGB":          capacity_gb,
            "capacityReachedDate": cap_date,
            "confidence":          ci,
            "history":             hist,
            "forecast":            fc}


def build_prediction(user_id, horizon=12, capacity_gb=None):
    from config import Config
    from services import analytics
    history = analytics.get_history(user_id)
    return forecast(history, horizon=horizon,
                    capacity_gb=capacity_gb or float(Config.PLAN_TOTAL_GB))
