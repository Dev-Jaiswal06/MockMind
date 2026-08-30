"""
MockMind User Deletion Script
Run: python scripts/delete_user.py <email | MM-XXXX> [--yes]

Ek command me user + uske SAARE records cascade-delete ho jaate hain:
users, user_stats, interview_sessions, interview_qa,
coding_sessions, user_questions, user_weak_topics,
password_resets, email_verifications

Preview dikhata hai, confirm karne par delete hota hai.
--yes flag se confirmation skip.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import (
    users_col, stats_col, sessions_col, qa_col, coding_col,
    user_questions_col, user_weak_topics_col, password_resets_col,
    email_verifications_col, get_user_by_identity,
)


def find_target(identifier):
    """uid (MM-XXXX), ObjectId hex ya email — kisi se bhi user dhundo."""
    user = get_user_by_identity(identifier.strip())
    if not user:
        user = users_col.find_one({"email": identifier.strip().lower()})
    return user


def collect_counts(user):
    """Har collection se is user ke records ki ginti."""
    uid  = user.get("uid") or ""
    oid  = str(user["_id"])
    both = {"$in": [x for x in (uid, oid) if x]}   # legacy hex refs bhi cover
    email = user.get("email", "")

    return [
        ("user_stats",          stats_col.count_documents({"user_id": both})),
        ("interview_sessions",  sessions_col.count_documents({"user_id": both})),
        ("interview_qa",        qa_col.count_documents({"user_id": both})),
        ("coding_sessions",     coding_col.count_documents({"user_id": both})),
        ("user_questions",      user_questions_col.count_documents({"user_id": both})),
        ("user_weak_topics",    user_weak_topics_col.count_documents({"user_id": both})),
        ("password_resets",     password_resets_col.count_documents({"email": email})),
        ("email_verifications", email_verifications_col.count_documents({"email": email})),
    ]


def main():
    argv      = sys.argv[1:]
    assume_yes = "--yes" in argv
    args       = [a for a in argv if a != "--yes"]

    if not args:
        print("Usage: python scripts/delete_user.py <email | MM-XXXX> [--yes]")
        print("Example: python scripts/delete_user.py dev@example.com")
        return

    identifier = args[0]
    user = find_target(identifier)
    if not user:
        print(f"[X] '{identifier}' se koi user nahi mila.")
        return

    uid_disp = user.get("uid") or "(legacy - no uid)"
    print(f"\nUser mila: {user.get('name')} ({uid_disp}, {user.get('email')})")
    print("\nYe records delete honge:")

    counts = collect_counts(user)
    total = 0
    for label, n in counts:
        print(f"  {label:22s}: {n}")
        total += n
    print(f"  {'users (account)':22s}: 1")
    total += 1

    if not assume_yes:
        try:
            ans = input(f"\nTotal {total} docs. Confirm delete? (y/N): ").strip().lower()
        except EOFError:
            ans = "n"
        if ans != "y":
            print("Cancel — kuch delete nahi hua.")
            return

    # ── Pehle child records, account sabse last (fail hone par re-run safe) ──
    uid  = user.get("uid") or ""
    oid  = str(user["_id"])
    both = {"$in": [x for x in (uid, oid) if x]}
    email = user.get("email", "")

    print()
    deleted = {}
    deleted["user_stats"]          = stats_col.delete_many({"user_id": both}).deleted_count
    deleted["interview_sessions"]  = sessions_col.delete_many({"user_id": both}).deleted_count
    deleted["interview_qa"]        = qa_col.delete_many({"user_id": both}).deleted_count
    deleted["coding_sessions"]     = coding_col.delete_many({"user_id": both}).deleted_count
    deleted["user_questions"]      = user_questions_col.delete_many({"user_id": both}).deleted_count
    deleted["user_weak_topics"]    = user_weak_topics_col.delete_many({"user_id": both}).deleted_count
    deleted["password_resets"]     = password_resets_col.delete_many({"email": email}).deleted_count
    deleted["email_verifications"] = email_verifications_col.delete_many({"email": email}).deleted_count

    for label, n in deleted.items():
        print(f"  {label:22s}: {n} deleted")
    users_col.delete_one({"_id": user["_id"]})
    print(f"  {'users (account)':22s}: 1 deleted")

    grand = sum(deleted.values()) + 1
    print(f"\n[OK] {user.get('name')} poore data ke saath delete ho gaya. Total {grand} docs removed.")


if __name__ == "__main__":
    main()
