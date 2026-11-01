"""Local filesystem storage — drop-in replacement for any S3/R2 client.
To switch to cloud storage later, only this file needs to change."""
from pathlib import Path

_HERE = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = _HERE / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)


class StorageUnavailable(RuntimeError):
    pass


def is_configured():
    return True


def is_reachable():
    try:
        t = UPLOAD_ROOT / ".ping"
        t.write_text("ok")
        t.unlink()
        return True
    except OSError:
        return False


def _path(key):
    p = (UPLOAD_ROOT / key).resolve()
    if not str(p).startswith(str(UPLOAD_ROOT)):
        raise StorageUnavailable("Invalid key.")
    return p


def upload_bytes(key, data, content_type=""):
    dest = _path(key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return key


def download_bytes(key):
    p = _path(key)
    if not p.exists():
        raise StorageUnavailable(f"Not found: {key}")
    return p.read_bytes()


def delete_object(key):
    p = _path(key)
    if p.exists():
        p.unlink()
    return True


def list_objects(prefix="", max_keys=500):
    base = _path(prefix) if prefix else UPLOAD_ROOT
    if not base.exists():
        return []
    out = []
    for f in base.rglob("*"):
        if not f.is_file():
            continue
        stat = f.stat()
        out.append({"key": f.relative_to(UPLOAD_ROOT).as_posix(),
                    "size": stat.st_size,
                    "last_modified": stat.st_mtime})
        if len(out) >= max_keys:
            break
    return out


def file_url(key):
    return f"/uploads/{key}"


def presigned_url(key, expires=3600):
    return file_url(key)


def public_url(key):
    return file_url(key)
