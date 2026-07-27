# backend/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import users_col, stats_col, password_resets_col
from datetime import datetime, timedelta
from bson import ObjectId
from email_utils import send_reset_email
import bcrypt
import secrets
import os

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


# ── FORGOT PASSWORD ──
@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Rate limiting: 10 requests per email per hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_count = password_resets_col.count_documents({
        "email":     email,
        "created_at": {"$gte": one_hour_ago.isoformat()}
    })
    if recent_count >= 10:
        return jsonify({"error": "Too many requests. Try again later."}), 429

    # Always return same response — email existence na reveal karo
    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"message": "If that email exists, a reset link has been sent."}), 200

    # Purane tokens delete karo is email ke liye
    password_resets_col.delete_many({"email": email})

    # Naya token banao (random string + expiry)
    token = secrets.token_urlsafe(32)
    password_resets_col.insert_one({
        "email":      email,
        "token":      token,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
        "used":       False
    })

    # Frontend link banao
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link   = f"{frontend_url}/reset-password?token={token}"

    # Email bhejo
    send_reset_email(email, reset_link)

    return jsonify({"message": "If that email exists, a reset link has been sent."}), 200


# ── RESET PASSWORD ──
@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data         = request.get_json() or {}
    token        = data.get("token",    "").strip()
    new_password = data.get("password", "")

    if not token or not new_password:
        return jsonify({"error": "Token and password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # Token dhundho
    record = password_resets_col.find_one({"token": token, "used": False})
    if not record:
        return jsonify({"error": "Invalid or expired reset link"}), 400

    # Check expiry
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.utcnow() > expires_at:
        password_resets_col.delete_one({"_id": record["_id"]})
        return jsonify({"error": "Reset link has expired. Request a new one."}), 400

    # Password update karo
    email     = record["email"]
    new_hash  = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    users_col.update_one(
        {"email": email},
        {"$set": {"password_hash": new_hash}}
    )

    # Token mark as used
    password_resets_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )

    return jsonify({"message": "Password updated successfully. You can now log in."}), 200