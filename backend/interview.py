# backend/interview.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import sessions_col, qa_col, update_user_stats
from ai_engine import generate_questions, evaluate_answers_batch, generate_report, _record_weak_topics
from resume_parser import parse_resume
from datetime import datetime
from bson import ObjectId
import random

interview_bp = Blueprint("interview", __name__)

ROLES = [
    {"id":"frontend",    "label":"Frontend Developer",   "icon":"⚛️"},
    {"id":"backend",     "label":"Backend Developer",    "icon":"🟩"},
    {"id":"fullstack",   "label":"Full Stack Developer", "icon":"💻"},
    {"id":"ml",          "label":"Machine Learning",     "icon":"🤖"},
    {"id":"datascience", "label":"Data Science",         "icon":"📊"},
    {"id":"analyst",     "label":"Data Analyst",         "icon":"📈"},
    {"id":"python",      "label":"Python Developer",     "icon":"🐍"},
    {"id":"uiux",        "label":"UI/UX Designer",       "icon":"🎨"},
    {"id":"devops",      "label":"DevOps Engineer",      "icon":"⚙️"},
]


@interview_bp.route("/api/interview/roles", methods=["GET"])
def get_roles():
    return jsonify({"roles": ROLES})


@interview_bp.route("/api/interview/start", methods=["POST"])
@jwt_required()
def start_interview():
    user_id = get_jwt_identity()
    role    = request.form.get("role",  "Full Stack Developer")
    i_type  = request.form.get("type",  "role")
    round_type = request.form.get("round", "technical")
    num_q   = int(request.form.get("questions", 8))
    resume  = request.files.get("resume")

    resume_text, skills = None, []
    if resume and resume.filename:
        resume_text, skills = parse_resume(resume.read(), resume.filename)

    seed = random.randint(10000, 99999)
    qs   = generate_questions(
        role=role,
        round_type=round_type,
        resume_text=resume_text if i_type != "role" else None,
        num_q=num_q, seed=seed,
        user_id=user_id
    )

    sid = str(sessions_col.insert_one({
        "user_id": user_id, "role": role, "interview_type": i_type,
        "round_type": round_type,
        "hr_count": 6 if round_type == "mixed" else 0,
        "resume_text": resume_text, "total_questions": len(qs),
        "total_score": 0, "percentage": 0, "grade": None,
        "time_taken": 0, "completed": False, "seed": seed,
        "created_at": datetime.utcnow().isoformat()
    }).inserted_id)

    return jsonify({
        "success": True, "session_id": sid, "role": role,
        "total_questions": len(qs), "questions": qs,
        "skills_detected": skills
    })


@interview_bp.route("/api/interview/submit-answer", methods=["POST"])
@jwt_required()
def submit_answer():
    user_id = get_jwt_identity()
    d       = request.get_json()
    qa_col.insert_one({
        "session_id":     d.get("session_id"),
        "user_id":        user_id,
        "question":       d.get("question"),
        "answer":         d.get("answer", ""),
        "score":          0,
        "feedback":       "",
        "good_points":    "",
        "improve":        "",
        "hint":           "",
        "question_index": d.get("question_index", 0),
        "created_at":     datetime.utcnow().isoformat()
    })
    return jsonify({"success": True})


@interview_bp.route("/api/interview/complete", methods=["POST"])
@jwt_required()
def complete_interview():
    user_id = get_jwt_identity()
    d       = request.get_json()
    sid     = d.get("session_id")
    role    = d.get("role", "")

    rows  = list(qa_col.find({"session_id": sid}, sort=[("question_index",1)]))

    # Batch evaluation — saare answers ek hi AI call me
    qa_data = [{"question": r.get("question",""), "answer": r.get("answer","")} for r in rows]
    evals   = evaluate_answers_batch(qa_data, role)

    # Scores + feedback wapas DB me save karo
    for r, ev in zip(rows, evals):
        if ev is None:
            continue
        qa_col.update_one(
            {"_id": r["_id"]},
            {"$set": {
                "score":       ev.get("score", 0),
                "feedback":    ev.get("feedback", ""),
                "good_points": ev.get("good_points", ""),
                "improve":     ev.get("improve", ""),
                "hint":        ev.get("hint", ""),
            }}
        )

    total = sum(e.get("score", 0) for e in evals if e)
    mx    = len(evals) * 10
    pct   = round((total / mx * 100), 1) if mx > 0 else 0
    grade = "A+" if pct>=85 else "A" if pct>=70 else "B" if pct>=55 else "C" if pct>=40 else "D"

    # Weak topics record karo (HR questions ko count nahi karte) —
    # agle interview me inhe prioritize karega. Mixed round me HR core
    # indices [0, hr_count) skip hote hain.
    session     = sessions_col.find_one({"_id": ObjectId(sid)})
    round_type  = session.get("round_type", "technical") if session else "technical"
    if round_type != "hr":
        hr_count = session.get("hr_count", 0) if session else 0
        tech_evals = evals[hr_count:] if hr_count else evals
        _record_weak_topics(user_id, role, tech_evals)

    report = generate_report(role, evals, total, pct, round_type)
    sessions_col.update_one(
        {"_id": ObjectId(sid)},
        {"$set": {"completed":True,"total_score":total,
                  "percentage":pct,"grade":grade,"time_taken":d.get("time_taken",0)}}
    )
    update_user_stats(user_id)
    return jsonify({"success":True,"total_score":total,"max_score":mx,
                    "percentage":pct,"grade":grade,"report":report,
                    "evaluations": evals})


@interview_bp.route("/api/interview/history", methods=["GET"])
@jwt_required()
def get_history():
    uid  = get_jwt_identity()
    rows = list(sessions_col.find(
        {"user_id":uid,"completed":True},
        sort=[("created_at",-1)], limit=20
    ))
    for r in rows:
        r["id"] = str(r.pop("_id"))
    return jsonify({"sessions": rows})


@interview_bp.route("/api/interview/session/<sid>", methods=["GET"])
@jwt_required()
def session_detail(sid):
    uid     = get_jwt_identity()
    session = sessions_col.find_one({"_id":ObjectId(sid),"user_id":uid})
    if not session:
        return jsonify({"error":"Not found"}), 404
    qa = list(qa_col.find({"session_id":sid},sort=[("question_index",1)]))
    for q in qa: q.pop("_id",None)
    session["id"] = str(session.pop("_id"))
    return jsonify({"session":session,"qa_list":qa})