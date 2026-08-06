# backend/app.py
from flask import Flask, request, make_response
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import sys
import socket
import subprocess
import logging

load_dotenv()

# ── Kill any old process using port 5000 ──
def _kill_stale_on_port(port):
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5
        )
        pids = set()
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if parts:
                    pids.add(parts[-1])
        my_pid = str(os.getpid())
        for pid in pids:
            if pid != my_pid and pid.isdigit():
                subprocess.run(
                    ["taskkill", "/F", "/PID", pid, "/T"],
                    capture_output=True, timeout=5
                )
                print(f"  Killed stale process PID {pid}")
        if pids:
            import time; time.sleep(1)
    except Exception as e:
        print(f"  Port cleanup skipped: {e}")

PORT = 5000
_kill_stale_on_port(PORT)

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("pymongo").setLevel(logging.WARNING)

from auth      import auth_bp
from interview import interview_bp
from coding    import coding_bp
from reports   import reports_bp
from models    import init_db

app = Flask(__name__)
app.config["JWT_SECRET_KEY"]           = os.getenv("JWT_SECRET_KEY","dev")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400

CORS(app, origins=["http://localhost:5173", "http://localhost:3000"],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
jwt = JWTManager(app)

app.register_blueprint(auth_bp)
app.register_blueprint(interview_bp)
app.register_blueprint(coding_bp)
app.register_blueprint(reports_bp)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        resp = make_response()
        resp.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Max-Age"] = "3600"
        return resp, 200

@app.route("/api/health")
def health():
    return {"status": "ok", "app": "MockMind"}

with app.app_context():
    init_db()

    # ── Auto-seed: agar collections empty hain toh questions daal do ──
    from models import question_bank_col, coding_problems_col, hr_questions_col
    if question_bank_col is not None and question_bank_col.count_documents({}) == 0:
        print("[SEED] Collections empty — seeding fallback questions...")
        from scripts.seed_fallback import seed
        seed()
        print("[SEED] Done!")
    else:
        tech = question_bank_col.count_documents({}) if question_bank_col is not None else 0
        coding = coding_problems_col.count_documents({}) if coding_problems_col is not None else 0
        hr = hr_questions_col.count_documents({}) if hr_questions_col is not None else 0
        print(f"[DB] Fallback ready: {tech} tech + {coding} coding + {hr} HR questions")

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  MockMind Backend — PID:", os.getpid())
    print("  http://localhost:5000")
    print("=" * 50 + "\n")
    sys.stdout.flush()
    app.run(
        host="127.0.0.1",
        port=PORT,
        debug=True,
        use_reloader=False,
    )
