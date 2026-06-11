# backend/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import users_col, stats_col
from datetime import datetime
from bson import ObjectId
import bcrypt

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/signup", methods=["POST"])
def signup():
    data     = request.get_json() or {}
    name     = data.get("name",     "").strip()
    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "")

    if not all([name, email, password]):
        return jsonify({"error": "All fields are required!"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters!"}), 400
    if users_col.find_one({"email": email}):
        return jsonify({"error": "Email is already registered!"}), 409

    hashed  = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    result  = users_col.insert_one({
        "name":          name,
        "email":         email,
        "password_hash": hashed,
        "created_at":    datetime.utcnow().isoformat()
    })
    user_id = str(result.inserted_id)

    stats_col.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {
            "user_id":             user_id,
            "total_interviews":    0,
            "total_coding":        0,
            "avg_interview_score": 0,
            "avg_coding_score":    0,
            "best_role":           None,
            "last_active":         datetime.utcnow().isoformat()
        }},
        upsert=True
    )

    token = create_access_token(identity=user_id)
    return jsonify({
        "message": f"Welcome {name}! Account created successfully.",
        "token":   token,
        "user":    {"id": user_id, "name": name, "email": email}
    }), 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "")

    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"error": "Email not registered!"}), 404
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Incorrect password!"}), 401

    user_id = str(user["_id"])
    token   = create_access_token(identity=user_id)
    return jsonify({
        "message": f"Welcome back, {user['name']}!",
        "token":   token,
        "user":    {"id": user_id, "name": user["name"], "email": user["email"]}
    })


@auth_bp.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user    = users_col.find_one({"_id": ObjectId(user_id)})
    stats   = stats_col.find_one({"user_id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "user": {
            "id":         str(user["_id"]),
            "name":       user["name"],
            "email":      user["email"],
            "created_at": user.get("created_at", "")
        },
        "stats": {k: v for k, v in (stats or {}).items() if k != "_id"}
    })