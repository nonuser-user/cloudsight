import threading
import pymysql
from config import Config


class DatabaseUnavailable(RuntimeError):
    pass


_lock = threading.Lock()


def is_configured():
    return Config.mysql_configured()


def _params():
    p = Config.mysql_params()
    p["cursorclass"] = pymysql.cursors.DictCursor
    return p


def connect():
    if not is_configured():
        raise DatabaseUnavailable("MySQL not configured (set MYSQL_* in .env).")
    try:
        return pymysql.connect(**_params())
    except pymysql.Error as e:
        raise DatabaseUnavailable(f"MySQL connection failed: {e}") from e


def query(sql, args=None, fetch="all"):
    with _lock:
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, args or ())
                return cur.fetchone() if fetch == "one" else cur.fetchall()
        finally:
            conn.close()


def execute(sql, args=None):
    with _lock:
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, args or ())
                conn.commit()
                return cur.lastrowid
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def executemany(sql, seq):
    with _lock:
        conn = connect()
        try:
            with conn.cursor() as cur:
                n = cur.executemany(sql, seq)
                conn.commit()
                return n
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
