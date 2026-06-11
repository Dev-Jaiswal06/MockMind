# backend/app.py
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

load_dotenv()

from auth      import auth_bp
from interview import interview_bp
from coding    import coding_bp
from reports   import reports_bp
from models    import init_db

app = Flask(__name__)
app.config["JWT_SECRET_KEY"]           = os.getenv("JWT_SECRET_KEY","dev")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400

CORS(app, origins=[
    "http://localhost:5173",
    "http://localhost:3000"
])
jwt = JWTManager(app)

app.register_blueprint(auth_bp)
app.register_blueprint(interview_bp)
app.register_blueprint(coding_bp)
app.register_blueprint(reports_bp)

@app.route("/api/health")
def health():
    return {"status":"ok","app":"MockMind 🧠"}

with app.app_context():
    init_db()

if __name__ == "__main__":
    print("\n🧠 MockMind Backend Starting...")
    print("📍 http://localhost:5000\n")
    app.run(debug=True, port=5000)