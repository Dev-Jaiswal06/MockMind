# backend/models.py
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConfigurationError, ServerSelectionTimeoutError
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()


def _build_client():
    """Create a Mongo client with sane timeouts and optional DNS fallback."""
    primary_uri = os.getenv("MONGODB_URI", "").strip()
    fallback_uri = os.getenv("MONGODB_URI_FALLBACK", "").strip()

    if not primary_uri:
        raise RuntimeError("MONGODB_URI is missing in backend/.env")

    options = {
        "serverSelectionTimeoutMS": int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "8000")),
        "connectTimeoutMS": int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "8000")),
        "socketTimeoutMS": int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "8000")),
    }

    try:
        client = MongoClient(primary_uri, **options)
        client.admin.command("ping")
        return client
    except ConfigurationError as exc:
        error_text = str(exc).lower()
        dns_timeout = "resolution lifetime expired" in error_text or "dns operation timed out" in error_text
        if dns_timeout and fallback_uri:
            client = MongoClient(fallback_uri, **options)
            client.admin.command("ping")
            return client
        raise RuntimeError(
            "MongoDB DNS resolution failed. Either fix local DNS or set MONGODB_URI_FALLBACK "
            "with Atlas non-SRV URI (mongodb://...)."
        ) from exc
    except ServerSelectionTimeoutError as exc:
        raise RuntimeError(
            "MongoDB server selection timed out. Check URI, IP allowlist, and network access."
        ) from exc


# ── Connect to MongoDB ──
_client = _build_client()
db      = _client["mockmind"]

# ── Collections ──
users_col      = db["users"]
sessions_col   = db["interview_sessions"]
qa_col         = db["interview_qa"]
coding_col     = db["coding_sessions"]
stats_col      = db["user_stats"]
password_resets_col = db["password_resets"]
email_verifications_col = db["email_verifications"]

# ── Fallback Question Bank Collections ──
question_bank_col   = db["question_bank"]
coding_problems_col = db["coding_problems"]
hr_questions_col    = db["hr_questions"]
user_questions_col  = db["user_questions"]
user_weak_topics_col = db["user_weak_topics"]


def init_db():
    """Indexes banao — fast queries ke liye"""
    users_col.create_index([("email", ASCENDING)], unique=True)
    sessions_col.create_index([("user_id", ASCENDING)])
    sessions_col.create_index([("created_at", DESCENDING)])
    qa_col.create_index([("session_id", ASCENDING)])
    qa_col.create_index([("user_id", ASCENDING)])
    coding_col.create_index([("user_id", ASCENDING)])
    stats_col.create_index([("user_id", ASCENDING)], unique=True)
    try:
        email_verifications_col.drop_index("token_1")
    except Exception:
        pass
    email_verifications_col.create_index([("code", ASCENDING)])
    # ── Fallback Question Bank Indexes ──
    question_bank_col.create_index([("role", ASCENDING), ("type", ASCENDING), ("difficulty", ASCENDING)])
    question_bank_col.create_index([("asked_count", ASCENDING)])
    question_bank_col.create_index([("role", ASCENDING), ("type", ASCENDING), ("asked_count", ASCENDING)])
    coding_problems_col.create_index([("difficulty", ASCENDING)])
    coding_problems_col.create_index([("topic", ASCENDING)])
    coding_problems_col.create_index([("attempted", ASCENDING)])
    hr_questions_col.create_index([("category", ASCENDING)])
    hr_questions_col.create_index([("asked_count", ASCENDING)])
    hr_questions_col.create_index([("category", ASCENDING), ("asked_count", ASCENDING)])
    user_questions_col.create_index([("user_id", ASCENDING)])
    user_weak_topics_col.create_index(
        [("user_id", ASCENDING), ("role", ASCENDING), ("topic", ASCENDING)],
        unique=True,
    )
    user_weak_topics_col.create_index([("count", DESCENDING)])
    print("[OK] MockMind MongoDB Connected & Ready!")


def update_user_stats(user_id):
    """User stats update karo after each session"""
    int_sessions  = list(sessions_col.find({"user_id": user_id, "completed": True}))
    code_sessions = list(coding_col.find({"user_id": user_id}))

    total_int  = len(int_sessions)
    avg_int    = round(
        sum(s.get("percentage", 0) for s in int_sessions) / total_int, 1
    ) if total_int > 0 else 0

    total_code = len(code_sessions)
    avg_code   = round(
        sum(s.get("score", 0) for s in code_sessions) / total_code, 1
    ) if total_code > 0 else 0

    # Best role nikalo
    role_map = {}
    for s in int_sessions:
        r = s.get("role", "")
        role_map.setdefault(r, []).append(s.get("percentage", 0))

    best_role = None
    if role_map:
        best_role = max(
            role_map,
            key=lambda r: sum(role_map[r]) / len(role_map[r])
        )

    stats_col.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id":             user_id,
            "total_interviews":    total_int,
            "avg_interview_score": avg_int,
            "total_coding":        total_code,
            "avg_coding_score":    avg_code,
            "best_role":           best_role,
            "last_active":         datetime.utcnow().isoformat()
        }},
        upsert=True
    )