from pathlib import Path

from flask import (Flask, render_template, redirect, url_for,
                   request, jsonify, send_from_directory, Blueprint)
from flask_login import login_user, logout_user, login_required, current_user

from config import Config
from extensions import login_manager
from services import db as db_svc
from services import storage as stor
from services import analytics, predictor
from services.auth import authenticate, register_user, load_user, DEMO_EMAIL

app = Flask(__name__)
app.secret_key = Config.SECRET_KEY
app.config["DEBUG"] = Config.DEBUG
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024 * 1024  # 5 GB

login_manager.init_app(app)


@login_manager.user_loader
def _load_user(user_id):
    return load_user(user_id)


PAGES = {
    "dashboard":  ("Dashboard",             "Overview of your cloud storage"),
    "files":      ("Cloud File Manager",    "Browse, upload and manage files"),
    "analytics":  ("Storage Analytics",     "Usage trends and file-type analysis"),
    "prediction": ("ML Storage Prediction", "Linear Regression forecasting"),
    "network":    ("Network Simulation",    "Network info and transfer simulation"),
    "profile":    ("Profile & Settings",    "Manage your account"),
}

FTYPE = {
    "jpg": "img", "jpeg": "img", "png": "img", "gif": "img", "webp": "img",
    "mp4": "vid", "avi": "vid", "mov": "vid", "mkv": "vid", "webm": "vid",
    "mp3": "aud", "wav": "aud", "flac": "aud", "ogg": "aud",
    "zip": "zip", "tar": "zip", "gz": "zip", "7z": "zip", "rar": "zip",
    "py": "code", "js": "code", "ts": "code", "java": "code",
    "c": "code", "cpp": "code", "html": "code", "css": "code", "json": "code",
}


@app.context_processor
def globals():
    if current_user.is_authenticated:
        su = {"name": current_user.name, "email": current_user.email,
              "initials": current_user.initials, "plan": current_user.plan}
    else:
        su = {"name": "Guest", "email": "", "initials": "G", "plan": ""}
    return {"sample_user": su,
            "db_live": db_svc.is_configured(),
            "storage_live": stor.is_configured()}


# auth routes

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    error = None
    if request.method == "POST":
        user = authenticate(request.form.get("email", "").strip().lower(),
                            request.form.get("password", ""))
        if user:
            login_user(user, remember=bool(request.form.get("remember")))
            return redirect(request.args.get("next") or url_for("dashboard"))
        error = "Incorrect email or password."
    return render_template("login.html", active_page="login", error=error)


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    error = None
    if request.method == "POST":
        name  = request.form.get("fullName", "").strip()
        email = request.form.get("remail", "").strip().lower()
        pw    = request.form.get("rpass", "")
        pw2   = request.form.get("rpass2", "")
        plan  = request.form.get("plan", "Premium · 500 GB")
        if pw != pw2:
            error = "Passwords do not match."
        else:
            try:
                if db_svc.is_configured():
                    register_user(name, email, pw, plan=plan)
                    login_user(authenticate(email, pw))
                else:
                    from services.auth import AuthUser
                    login_user(AuthUser.demo())
                return redirect(url_for("dashboard"))
            except ValueError as e:
                error = str(e)
    return render_template("register.html", active_page="register", error=error)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


@app.route("/")
def index():
    return redirect(url_for("dashboard") if current_user.is_authenticated
                    else url_for("login"))


# page routes

def _page(name):
    t, s = PAGES[name]
    return render_template(f"{name}.html", active_page=name,
                           page_title=t, page_subtitle=s)


@app.route("/dashboard")
@login_required
def dashboard(): return _page("dashboard")

@app.route("/files")
@login_required
def files(): return _page("files")

@app.route("/analytics")
@login_required
def analytics_page(): return _page("analytics")

@app.route("/prediction")
@login_required
def prediction(): return _page("prediction")

@app.route("/network")
@login_required
def network(): return _page("network")

@app.route("/profile")
@login_required
def profile(): return _page("profile")

@app.route("/uploads/<path:key>")
@login_required
def serve_upload(key):
    p = (Path(stor.UPLOAD_ROOT) / key).resolve()
    if not str(p).startswith(str(stor.UPLOAD_ROOT)):
        return "Forbidden", 403
    return send_from_directory(stor.UPLOAD_ROOT, key, as_attachment=True)


api = Blueprint("api", __name__, url_prefix="/api")


def _uid():
    try:
        return int(current_user.get_id() or 0)
    except Exception:
        return 0

def _need_db():
    if not db_svc.is_configured():
        return jsonify({"error": "db_unavailable"}), 503
    return None

@api.route("/summary")
@login_required
def api_summary():
    err = _need_db()
    if err: return err
    try:
        return jsonify(analytics.get_summary(_uid()))
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503


@api.route("/dashboard")
@login_required
def api_dashboard():
    err = _need_db()
    if err: return err
    try:
        return jsonify(analytics.build_dashboard(_uid()))
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503


@api.route("/analytics")
@login_required
def api_analytics():
    err = _need_db()
    if err: return err
    try:
        return jsonify(analytics.build_analytics(_uid()))
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503


@api.route("/files")
@login_required
def api_files():
    err = _need_db()
    if err: return err
    try:
        return jsonify(analytics.build_files(_uid()))
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503


@api.route("/files/stats")
@login_required
def api_file_stats():
    err = _need_db()
    if err: return err
    try:
        return jsonify(analytics.get_file_stats(_uid()))
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503


@api.route("/files/upload", methods=["POST"])
@login_required
def api_upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "no_file"}), 400

    uid   = _uid()
    fname = Path(f.filename).name
    key   = f"users/{uid}/{fname}"

    # Stream directly to disk — avoids loading large files into RAM
    dest = Path(stor.UPLOAD_ROOT) / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        f.save(str(dest))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    file_size = dest.stat().st_size

    if db_svc.is_configured():
        ext   = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        ftype = FTYPE.get(ext, "doc")
        db_svc.execute(
            """INSERT INTO files
               (user_id, name, type, size_bytes, directory, r2_key, status)
               VALUES (%s, %s, %s, %s, '/', %s, 'Synced')
               ON DUPLICATE KEY UPDATE size_bytes=%s, r2_key=%s, status='Synced'""",
            (uid, fname, ftype, file_size, key, file_size, key),
        )
        try:
            analytics.refresh_snapshot(uid)
        except Exception:
            pass

    return jsonify({"ok": True, "key": key, "url": stor.file_url(key),
                    "size": file_size, "name": fname})


@api.route("/files/url/<path:key>")
@login_required
def api_file_url(key):
    return jsonify({"url": stor.file_url(key)})


@api.route("/files/delete", methods=["DELETE", "POST"])
@login_required
def api_delete():
    body = request.get_json(silent=True) or {}
    key  = body.get("key") or request.form.get("key")
    if not key:
        return jsonify({"error": "key_required"}), 400

    uid = _uid()
    try:
        stor.delete_object(key)
    except stor.StorageUnavailable as e:
        return jsonify({"error": str(e)}), 500

    if db_svc.is_configured():
        db_svc.execute(
            "DELETE FROM files WHERE r2_key=%s AND user_id=%s", (key, uid))
        try:
            analytics.refresh_snapshot(uid)
        except Exception:
            pass

    return jsonify({"ok": True})


@api.route("/forecast")
@login_required
def api_forecast():
    err = _need_db()
    if err: return err
    horizon = min(int(request.args.get("horizon", 12)), 36)
    ci      = min(max(float(request.args.get("ci", 0.95)), 0.50), 0.99)
    try:
        result = predictor.build_prediction(
            _uid(), horizon=horizon,
            capacity_gb=float(Config.PLAN_TOTAL_GB))
        result["confidence"] = ci
        return jsonify(result)
    except db_svc.DatabaseUnavailable as e:
        return jsonify({"error": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": str(e)}), 422


@api.route("/network/status")
@login_required
def api_network_status():
    return jsonify({
        "db":      {"configured": db_svc.is_configured()},
        "storage": {"configured": True, "reachable": stor.is_reachable(),
                    "type": "Local filesystem",
                    "path": str(stor.UPLOAD_ROOT)},
    })


@api.route("/profile", methods=["POST"])
@login_required
def api_profile_update():
    if not db_svc.is_configured():
        return jsonify({"ok": True})
    body    = request.get_json(silent=True) or {}
    uid     = _uid()
    allowed = {"name", "phone", "institution", "student_id"}
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if updates:
        db_svc.execute(
            "UPDATE users SET " + ", ".join(f"{k}=%s" for k in updates) + " WHERE id=%s",
            list(updates.values()) + [uid])
    return jsonify({"ok": True})


app.register_blueprint(api)


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html", active_page=None), 404


if __name__ == "__main__":
    app.run(
        debug=Config.DEBUG,
        port=5000,
        use_reloader=False,   # prevents upload files triggering server restart
    )
