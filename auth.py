import bcrypt
from flask_login import UserMixin

from services import db
from services.models import get_user_by_email, get_user_by_id, create_user

DEMO_EMAIL = "aarav.mehta@university.edu"
DEMO_PASSWORD = "demo1234"


class AuthUser(UserMixin):
    def __init__(self, id, name, email, initials="U", plan="", role="", is_demo=False):
        self.id       = str(id)
        self.name     = name
        self.email    = email
        self.initials = initials
        self.plan     = plan
        self.role     = role
        self.is_demo  = is_demo

    @classmethod
    def from_model(cls, user):
        return cls(user.id, user.name, user.email,
                   user.initials or "U", user.plan, user.role)

    @classmethod
    def demo(cls):
        return cls(0, "Aarav Mehta", DEMO_EMAIL, "AM",
                   "Premium · 500 GB", "Research Scholar · BCA", is_demo=True)


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())


def check_password(password, hashed):
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed)
    except ValueError:
        return False


def register_user(name, email, password, plan="Premium · 500 GB"):
    email = (email or "").strip().lower()
    if not name or not email or not password:
        raise ValueError("Name, email and password are required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if get_user_by_email(email):
        raise ValueError("An account with that email already exists.")
    return create_user(name, email, hash_password(password), plan=plan)


def authenticate(email, password):
    email = (email or "").strip().lower()
    if not db.is_configured():
        # No DB — accept any credentials in demo mode
        return AuthUser.demo()
    user = get_user_by_email(email)
    if user and check_password(password, user.password_hash):
        return AuthUser.from_model(user)
    return None


def load_user(user_id):
    """Flask-Login user loader. Returns None = not logged in."""
    if not user_id:
        return None
    # DB is configured — look up the real user
    if db.is_configured():
        if user_id == "0":
            return None   # 0 is the demo sentinel; not a real session
        try:
            user = get_user_by_id(int(user_id))
            return AuthUser.from_model(user) if user else None
        except Exception:
            return None
    # No DB — restore demo session only if the stored ID is the demo sentinel
    if user_id == "0":
        return AuthUser.demo()
    return None
