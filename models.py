
from dataclasses import dataclass, field
from datetime import datetime

from services import db


def _to_bool(v):
    return bool(int(v)) if v is not None else False


@dataclass
class User:
    id: int
    name: str
    email: str
    password_hash: bytes
    initials: str = ""
    plan: str = "Free · 15 GB"
    role: str = "Student"
    institution: str = ""
    student_id: str = ""
    phone: str = ""
    two_factor: bool = True
    created_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict) -> "User":
        return cls(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            password_hash=row["password_hash"],
            initials=row.get("initials", "") or "",
            plan=row.get("plan", "") or "",
            role=row.get("role", "") or "",
            institution=row.get("institution", "") or "",
            student_id=row.get("student_id", "") or "",
            phone=row.get("phone", "") or "",
            two_factor=_to_bool(row.get("two_factor")),
            created_at=row.get("created_at"),
        )

    @property
    def first_name(self) -> str:
        return (self.name or "").split(" ")[0]


def get_user_by_id(user_id: int) -> User | None:
    row = db.query(
        "SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,), fetch="one"
    )
    return User.from_row(row) if row else None


def get_user_by_email(email: str) -> User | None:
    row = db.query(
        "SELECT * FROM users WHERE email = %s LIMIT 1", (email,), fetch="one"
    )
    return User.from_row(row) if row else None


def create_user(name, email, password_hash, plan="Premium · 500 GB",
                role="Research Scholar · BCA") -> int:
    initials = "".join([p[0] for p in (name or "").split()[:2] if p]).upper()[:2] or "U"
    return db.execute(
        """INSERT INTO users (name, email, password_hash, initials, plan, role)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (name, email, password_hash, initials, plan, role),
    )


@dataclass
class FileRecord:
    id: int
    user_id: int
    name: str
    type: str
    size_bytes: int
    r2_key: str = ""
    owner: str = "You"
    shared: bool = False
    starred: bool = False
    status: str = "Synced"
    modified: datetime | None = None
    created_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict) -> "FileRecord":
        return cls(
            id=row["id"], user_id=row["user_id"], name=row["name"], type=row["type"],
            size_bytes=row["size_bytes"], r2_key=row.get("r2_key", "") or "",
            owner=row.get("owner", "You"), shared=_to_bool(row.get("shared")),
            starred=_to_bool(row.get("starred")), status=row.get("status", "Synced"),
            modified=row.get("modified"), created_at=row.get("created_at"),
        )


@dataclass
class StorageSnapshot:
    id: int
    user_id: int
    snapshot_date: datetime
    used_gb: float
    uploaded_gb: float

    @classmethod
    def from_row(cls, row: dict) -> "StorageSnapshot":
        return cls(
            id=row["id"], user_id=row["user_id"],
            snapshot_date=row["snapshot_date"], used_gb=float(row["used_gb"]),
            uploaded_gb=float(row.get("uploaded_gb", 0) or 0),
        )
