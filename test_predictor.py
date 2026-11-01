"""Quick check that the Linear Regression predictor works.
Run: python test_predictor.py  (no DB needed)
"""
from datetime import date, timedelta
from services.predictor import forecast

USED_GB = [
    168, 176, 182, 189, 197, 205, 214, 223, 231, 239, 246, 253,
    261, 268, 276, 285, 293, 305, 318, 328, 338, 351, 361, 372.4,
]

history = [
    {"date": date(2024, 11, 1) + timedelta(days=30 * i), "usedGB": v}
    for i, v in enumerate(USED_GB)
]

r = forecast(history, horizon=12, capacity_gb=500.0)
print(f"R²       : {r['rSquared']}")
print(f"Slope    : +{r['slopePerMonth']} GB/mo")
print(f"+6 mo    : {r['predictedIn6Months']} GB")
print(f"+12 mo   : {r['predictedIn12Months']} GB")
print(f"Capacity : {r['capacityReachedDate']}")
assert r["rSquared"] > 0.90, "R² too low"
print("OK")
