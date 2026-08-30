"""
MockMind User ID Migration Script
Run: python scripts/migrate_user_ids.py

1. Purane hex ObjectId user references ko naye sequential IDs (MM-1001, MM-1002...) me convert karta hai:
   - users collection me missing 'uid' assign karta hai (created_at order me)
   - Sabhi child collections ka 'user_id' field rewrite karta hai:
     user_stats, interview_sessions, interview_qa, coding_sessions,
     user_questions, user_weak_topics
2. Orphan cleanup: jin docs ka user_id hex hai aur owner users collection me
   EXIST nahi karta (deleted accounts ke ghost records) — unhe delete kar deta hai.

Idempotent hai — dobara chalao to kuch nahi bigdega.
"""
import re
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import (
    users_col, stats_col, sessions_col, qa_col, coding_col,
    user_questions_col, user_weak_topics_col, next_user_seq,
)

CHILD_COLLECTIONS = [
    ("user_stats",         stats_col),
    ("interview_sessions", sessions_col),
    ("interview_qa",       qa_col),
    ("coding_sessions",    coding_col),
    ("user_questions",     user_questions_col),
    ("user_weak_topics",   user_weak_topics_col),
]

HEX_PATTERN = r"^[0-9a-f]{24}$"


def migrate():
    # ── Step 1: jinko uid nahi mila, unhe assign karo (purane → naye order me) ──
    pending = list(users_col.find(
        {"uid": {"$exists": False}},
        sort=[("created_at", 1)]
    ))
    print(f"[1/4] {len(pending)} users ko naya uid assign hoga...")

    id_map = {}
    for u in pending:
        uid = f"MM-{next_user_seq():04d}"
        users_col.update_one({"_id": u["_id"]}, {"$set": {"uid": uid}})
        id_map[str(u["_id"])] = uid
        print(f"      {u.get('email', '?'):40s} -> {uid}")

    # ── Jo users ke paas pehle se uid hai, unka purana hex reference bhi map karo ──
    for u in users_col.find({"uid": {"$exists": True}}, {"uid": 1}):
        id_map.setdefault(str(u["_id"]), u["uid"])

    # ── Step 2: child collections ka user_id rewrite karo ──
    print(f"\n[2/4] Child collections rewrite ho rahi hain...")
    total = 0
    for name, col in CHILD_COLLECTIONS:
        count = 0
        for doc in col.find({"user_id": {"$in": list(id_map.keys())}}):
            new_id = id_map[doc["user_id"]]
            col.update_one({"_id": doc["_id"]}, {"$set": {"user_id": new_id}})
            count += 1
        total += count
        print(f"      {name:22s} {count} docs updated")

    # ── Step 3: orphan sweep — deleted accounts ke ghost records ──
    # user_id hex-format hai AUR kisi existing user se match nahi karta => owner gone
    print(f"\n[3/4] Orphan records dhundhe ja rahe hain...")
    orphan_total = 0
    for name, col in CHILD_COLLECTIONS:
        result = col.delete_many({
            "user_id": {
                "$regex": HEX_PATTERN,
                "$options": "i",
                "$nin": list(id_map.keys()),
            }
        })
        if result.deleted_count:
            print(f"      {name:22s} {result.deleted_count} orphan docs DELETED")
        orphan_total += result.deleted_count

    # ── Step 4: summary ──
    print(f"\n[4/4] Done! {total} documents migrate hue, {orphan_total} orphans delete hue.")
    if total:
        print("Note: purane JWT tokens invalid ho gaye — sabko dobara login karna hoga.")


if __name__ == "__main__":
    migrate()
