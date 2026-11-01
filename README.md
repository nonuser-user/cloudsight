# CloudSight — Predictive Cloud Storage Analytics System
### BCA Integrated Project · Phase 2

A premium full-stack web application for analysing cloud storage usage,
managing files on Cloudflare R2, and forecasting future storage needs with a
**scikit-learn Linear Regression** model (R² = 0.993).

---

## Technology stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| Auth | Flask-Login · bcrypt |
| Database | MySQL 8+ · PyMySQL |
| Object storage | Cloudflare R2 · boto3 (S3-compatible) |
| ML / forecasting | scikit-learn LinearRegression · NumPy · pandas |
| Frontend | Bootstrap 5 · Plotly 2.32 · Vanilla JS |
| Charts | Plotly (interactive, responsive, brand-themed) |

---

## Quick start — Demo mode (no MySQL / R2 needed)

The app boots and shows the full UI with **sample data** when MySQL and R2 are
not configured. Use this for UI review.

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the development server
python app.py

# 3. Open in browser
#    http://127.0.0.1:5000
#    Sign in with any email / password (demo mode accepts all credentials)
```

The demo badge on every analytics page makes it clear the data is synthetic.

---

## Full setup — Live MySQL

### 1 — Copy and fill in .env

```bash
copy .env.example .env
```

Edit `.env` with your real values:

```env
SECRET_KEY=<generate with: python -c "import secrets;print(secrets.token_hex(32))">

# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=cloudsight
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=cloudsight

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=cloudsight-prod

PLAN_TOTAL_GB=500
```

### 2 — Create the MySQL database and tables

```bash
mysql -u root -p < schema.sql
```

Or, if your DB user can't CREATE DATABASE, create it manually first:

```sql
CREATE DATABASE cloudsight CHARACTER SET utf8mb4;
```

Then run only the `CREATE TABLE` statements from `schema.sql`.

### 3 — Seed demo data

```bash
python seed_db.py
```

This inserts:
- Demo user: `aarav.mehta@university.edu` / `demo1234`
- 12 realistic file records across multiple directories
- 24 months of monthly storage snapshots (used for ML training)

### 4 — Start the server

```bash
python app.py
# http://127.0.0.1:5000
```

Sign in with the seeded credentials. The UI automatically switches from sample
data to live MySQL data — the **"Live · MySQL connected"** badge confirms it.

---

## ML forecasting details

The predictor (`services/predictor.py`) fits `sklearn.linear_model.LinearRegression`
on the monthly `storage_snapshots` history:

| Metric | Value (on 24-month sample history) |
|---|---|
| R² | 0.9932 |
| RMSE | 4.99 GB |
| MAE | 3.90 GB |
| Slope | +8.71 GB / month |
| 12-month forecast | 466 GB |

A proper **OLS prediction interval** (grows with forecast horizon) is used for
the confidence band — not just a fixed ±value. The `/api/forecast?horizon=12&ci=0.95`
endpoint is called live from the ML Prediction page.

Run the predictor self-test any time (no DB needed):

```bash
python test_predictor.py
```

---

## API endpoints

All endpoints require an active session (redirect to `/login` otherwise). When
MySQL is not configured, each returns HTTP 503 and the frontend falls back to
sample data automatically.

| Endpoint | Method | Description |
|---|---|---|
| `/api/dashboard` | GET | Summary + recent/largest files + growth history |
| `/api/analytics` | GET | Type breakdown, directories, type-over-time, type analysis |
| `/api/files` | GET | Full file list for the file manager |
| `/api/files/upload` | POST | Upload a file to R2 + persist metadata to MySQL |
| `/api/files/url/<key>` | GET | Pre-signed 5-minute download URL |
| `/api/files/delete` | DELETE | Delete from R2 + remove metadata row |
| `/api/forecast` | GET | Linear Regression forecast (`?horizon=12&ci=0.95`) |
| `/api/network/status` | GET | DB + R2 configuration & reachability status |
| `/api/profile` | POST | Update name, phone, institution, student_id |

---

## Project structure

```
cloud/
├── app.py                  # Flask app, routes, API blueprint
├── config.py               # Config from .env, *_configured() flags
├── extensions.py           # Flask-Login LoginManager
├── schema.sql              # MySQL DDL (users, files, storage_snapshots)
├── seed_db.py              # Insert demo user + 24-month history
├── test_predictor.py       # Predictor self-test (no DB needed)
├── requirements.txt
├── .env.example            # Template — copy to .env
├── .gitignore
├── services/
│   ├── auth.py             # bcrypt hashing, register, authenticate, user loader
│   ├── analytics.py        # MySQL queries → dashboard/analytics/files payloads
│   ├── db.py               # PyMySQL lazy connection helper
│   ├── models.py           # User / FileRecord / StorageSnapshot dataclasses
│   ├── predictor.py        # sklearn LinearRegression + prediction interval
│   └── r2.py               # boto3 Cloudflare R2 client
├── static/
│   ├── css/style.css       # Complete design system (tokens, components, responsive)
│   └── js/
│       ├── data.js         # Sample data (used when DB unavailable)
│       ├── charts.js       # Plotly chart renderers (shared theme)
│       ├── main.js         # Sidebar, dropdowns, toasts, data-driven HTML renderers
│       └── api.js          # Fetch adapter — live API → re-render, or fallback
└── templates/
    ├── base.html           # Reusable sidebar + topbar
    ├── login.html          # Auth — POST to Flask
    ├── register.html       # Auth — POST to Flask
    ├── dashboard.html      # KPIs, charts, recent/largest files
    ├── files.html          # File manager, upload modal
    ├── analytics.html      # Storage trends, type breakdown
    ├── prediction.html     # ML forecast, diagnostics, insights
    ├── network.html        # Network metrics, transfer estimator
    ├── profile.html        # Profile + tabbed settings
    └── 404.html
```

---

## Demo credentials

```
Email    : aarav.mehta@university.edu
Password : demo1234
```

(After running `seed_db.py`. In demo mode without a DB, any email/password works.)
