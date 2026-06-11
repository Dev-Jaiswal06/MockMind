# backend/reports.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import sessions_col, coding_col, stats_col

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/api/reports/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    uid = get_jwt_identity()

    stats = stats_col.find_one({"user_id":uid})
    if stats: stats.pop("_id",None)

    recent_int = list(sessions_col.find(
        {"user_id":uid,"completed":True},
        sort=[("created_at",-1)], limit=5
    ))
    for r in recent_int: r["id"]=str(r.pop("_id"))

    recent_code = list(coding_col.find(
        {"user_id":uid}, sort=[("created_at",-1)], limit=5
    ))
    for r in recent_code: r.pop("_id",None)

    chart = list(sessions_col.find(
        {"user_id":uid,"completed":True},
        sort=[("created_at",1)], limit=10
    ))
    for r in chart: r["id"]=str(r.pop("_id"))

    # Role-wise average
    pipeline = [
        {"$match":{"user_id":uid,"completed":True}},
        {"$group":{
            "_id":"$role",
            "avg":{"$avg":"$percentage"},
            "best":{"$max":"$percentage"},
            "count":{"$sum":1}
        }},
        {"$sort":{"avg":-1}}
    ]
    role_stats = [
        {"role":r["_id"],"avg_score":round(r["avg"],1),
         "best":round(r["best"],1),"count":r["count"]}
        for r in sessions_col.aggregate(pipeline)
    ]

    return jsonify({
        "stats":             stats or {},
        "recent_interviews": recent_int,
        "recent_coding":     recent_code,
        "chart_data":        chart,
        "role_stats":        role_stats
    })


@reports_bp.route("/api/reports/performance", methods=["GET"])
@jwt_required()
def performance():
    uid = get_jwt_identity()

    all_s = list(sessions_col.find(
        {"user_id":uid,"completed":True},
        sort=[("created_at",-1)]
    ))
    for r in all_s: r["id"]=str(r.pop("_id"))

    pipeline = [
        {"$match":{"user_id":uid,"completed":True}},
        {"$group":{
            "_id":"$role",
            "best":{"$max":"$percentage"},
            "avg":{"$avg":"$percentage"}
        }},
        {"$sort":{"best":-1}}
    ]
    role_perf = [
        {"role":r["_id"],"best":round(r["best"],1),"avg":round(r["avg"],1)}
        for r in sessions_col.aggregate(pipeline)
    ]

    weak_pipeline = [
        {"$match":{"user_id":uid,"completed":True}},
        {"$group":{"_id":"$role","avg":{"$avg":"$percentage"}}},
        {"$match":{"avg":{"$lt":60}}}
    ]
    weak = [r["_id"] for r in sessions_col.aggregate(weak_pipeline)]

    return jsonify({
        "all_sessions":     all_s,
        "role_performance": role_perf,
        "weak_roles":       weak
    })