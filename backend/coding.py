# backend/coding.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import coding_col, update_user_stats
from ai_engine import generate_coding_problem
from code_runner import run_with_piston
from datetime import datetime

coding_bp = Blueprint("coding", __name__)


@coding_bp.route("/api/coding/problem", methods=["GET"])
@jwt_required()
def get_problem():
    role = request.args.get("role",       "Full Stack Developer")
    diff = request.args.get("difficulty", "medium")
    return jsonify({"problem": generate_coding_problem(role, diff)})


@coding_bp.route("/api/coding/run", methods=["POST"])
@jwt_required()
def run_code():
    d = request.get_json()
    return jsonify(run_with_piston(
        d.get("code",""), d.get("language","python"), d.get("stdin","")
    ))


@coding_bp.route("/api/coding/submit", methods=["POST"])
@jwt_required()
def submit_code():
    uid    = get_jwt_identity()
    d      = request.get_json()
    code   = d.get("code","")
    lang   = d.get("language","python")
    tcs    = d.get("test_cases",[])
    title  = d.get("problem_title","")

    results, passed = [], 0
    for i, tc in enumerate(tcs):
        r   = run_with_piston(code, lang, tc.get("input",""))
        got = (r.get("stdout") or "").strip()
        exp = tc.get("expected","").strip()
        ok  = (got == exp)
        if ok: passed += 1
        results.append({
            "test_case":i+1,"input":tc.get("input",""),
            "expected":exp,"got":got,"passed":ok,
            "stderr":r.get("stderr","")
        })

    score = round((passed/len(tcs)*100),1) if tcs else 0
    coding_col.insert_one({
        "user_id":       uid, "problem_title": title,
        "language":      lang, "code_submitted": code,
        "test_passed":   passed, "test_total": len(tcs),
        "score":         score,
        "status":        "passed" if passed==len(tcs) else "partial",
        "created_at":    datetime.utcnow().isoformat()
    })
    update_user_stats(uid)
    return jsonify({
        "results":results,"passed":passed,
        "total":len(tcs),"score":score,
        "all_passed":passed==len(tcs)
    })