import os
from dotenv import load_dotenv

load_dotenv()


def _bool(val, default=False):
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY") or "change-me-in-production"
    DEBUG = _bool(os.getenv("FLASK_DEBUG"), default=True)

    MYSQL_HOST     = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT     = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER     = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "cloudsight")
    MYSQL_DSN      = os.getenv("MYSQL_DSN")

    @staticmethod
    def mysql_configured():
        if Config.MYSQL_DSN:
            return True
        return bool(os.getenv("MYSQL_USER") and os.getenv("MYSQL_PASSWORD")
                    and os.getenv("MYSQL_DATABASE"))

    @staticmethod
    def mysql_params():
        if Config.MYSQL_DSN:
            import re
            m = re.match(
                r"mysql://([^:]+):([^@]*)@([^:/]+)(?::(\d+))?/(\w+)",
                Config.MYSQL_DSN)
            if m:
                return dict(user=m.group(1), password=m.group(2),
                            host=m.group(3), port=int(m.group(4) or 3306),
                            database=m.group(5), charset="utf8mb4")
        return dict(host=Config.MYSQL_HOST, port=Config.MYSQL_PORT,
                    user=Config.MYSQL_USER, password=Config.MYSQL_PASSWORD,
                    database=Config.MYSQL_DATABASE, charset="utf8mb4")

    PLAN_TOTAL_GB = int(os.getenv("PLAN_TOTAL_GB", "500"))
