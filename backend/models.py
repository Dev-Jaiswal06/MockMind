# backend/models.py
from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

# ── Connect to MongoDB ──
_client = MongoClient(os.getenv("MONGODB_URI"))
db      = _client["mockmind"]

# ── Collections ──
users_col    = db["users"]
sessions_col = db["interview_sessions"]
qa_col       = db["interview_qa"]
coding_col   = db["coding_sessions"]
stats_col    = db["user_stats"]


def init_db():
    """Indexes banao — fast queries ke liye"""
    users_col.create_index([("email", ASCENDING)], unique=True)
    sessions_col.create_index([("user_id", ASCENDING)])
    sessions_col.create_index([("created_at", DESCENDING)])
    qa_col.create_index([("session_id", ASCENDING)])
    qa_col.create_index([("user_id", ASCENDING)])
    coding_col.create_index([("user_id", ASCENDING)])
    stats_col.create_index([("user_id", ASCENDING)], unique=True)
    print("✅ MockMind MongoDB Connected & Ready!")


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