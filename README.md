# 🧠 MockMind — AI-Based Mock Technical and HR Interview System

<div align="center">

![MockMind Banner](https://img.shields.io/badge/MockMind-AI%20Interview%20System-8b5cf6?style=for-the-badge&logo=robot&logoColor=white)

[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://reactjs.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?style=flat-square&logo=flask)](https://flask.palletsprojects.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb)](https://mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/Google-Gemini%20AI-orange?style=flat-square&logo=google)](https://aistudio.google.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

### *"Practice Smart. Think Sharp. Get Hired."*

**An intelligent web-based system that simulates real placement interviews using Google Gemini AI — designed to help final-year students and freshers prepare for technical and HR interviews.**

[Live Demo](#) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [API Documentation](#-api-documentation)
- [Team Members](#-team-members)
- [Screenshots](#-screenshots)

---

## 🔍 Overview

**MockMind** is a full-stack AI-powered mock interview preparation system developed as a Final Year Project. The system simulates real technical and HR interview environments, providing students with personalized practice sessions, instant AI-driven feedback, live coding assessments, and detailed performance analytics.

The platform addresses a critical gap in interview preparation by offering:
- **Dynamic AI question generation** — no two sessions are identical
- **Resume-based personalization** — questions tailored to the candidate's skill set
- **Real-time code execution** — live coding environment with 5 programming languages
- **Hybrid evaluation engine** — combining Google Gemini AI with TF-IDF cosine similarity scoring

---

## ✨ Features

### 🤖 AI Interview Module
- 100% AI-generated questions using Google Gemini 2.0 Flash
- Two interview modes: **Role-Based** and **Resume-Based**
- Support for 9 job roles (Frontend, Backend, Full Stack, ML, Data Science, etc.)
- Fresh unique questions every session using session seeding
- Real-time answer evaluation with detailed feedback

### 💻 Coding Assessment Module
- AI-generated coding problems based on selected role and difficulty
- Monaco Editor (VS Code-like) for code writing
- Support for **5 programming languages**: Python, JavaScript, Java, C++, C
- Real-time code execution via **Piston API** (free, no key required)
- Automated test case validation with pass/fail results

### 📊 Performance Analytics
- Session-wise score history with interactive charts
- Role-wise performance breakdown
- Strengths and weaknesses identification
- AI-generated personalized improvement recommendations
- Readiness score and internship readiness assessment

### 🔐 Authentication System
- Secure user registration and login
- JWT-based session management
- Password hashing with bcrypt
- Protected routes and persistent sessions

---

## 🏗 System Architecture
┌─────────────────────────────────────────────────────┐ │ CLIENT LAYER │ │ React.js + Vite (Port 5173) │ │ Landing → Auth → Dashboard → Interview/Coding │ └─────────────────────┬───────────────────────────────┘ │ HTTP / REST API ┌─────────────────────▼───────────────────────────────┐ │ SERVER LAYER │ │ Flask Python (Port 5000) │ │ Auth API │ Interview API │ Coding API │ Reports │ └──────┬──────────────┬───────────────┬───────────────┘ │ │ │ ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ │ MongoDB │ │ Google │ │ Piston │ │ Atlas DB │ │ Gemini AI │ │ Code API │ │ (Free) │ │ (Free) │ │ (Free) │ └─────────────┘ └────────────┘ └────────────┘

text


---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React.js 18 | UI Framework |
| Vite | Build Tool |
| React Router DOM | Client-side Routing |
| Framer Motion | Animations |
| Recharts | Performance Charts |
| Monaco Editor | Code Editor |
| Axios | HTTP Client |
| React Hot Toast | Notifications |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.11 | Programming Language |
| Flask 3.0 | Web Framework |
| Flask-JWT-Extended | Authentication |
| Flask-CORS | Cross-Origin Requests |
| PyPDF2 | Resume PDF Parsing |
| Scikit-learn | TF-IDF Evaluation |
| bcrypt | Password Hashing |

### AI & External Services
| Service | Purpose | Cost |
|---|---|---|
| Google Gemini 2.0 Flash | Question Generation & Evaluation | Free |
| MongoDB Atlas M0 | Cloud Database | Free (512MB) |
| Piston API | Code Execution | Free (Unlimited) |

---

## 📁 Project Structure
MockMind/ │ ├── 📁 backend/
│ ├── app.py # Main Flask application │ ├── auth.py # Authentication APIs │ ├── interview.py # Interview module APIs │ ├── coding.py # Coding module APIs │ ├── reports.py # Analytics & reports APIs │ ├── ai_engine.py # Gemini AI integration │ ├── models.py # MongoDB models & helpers │ ├── code_runner.py # Piston API integration │ ├── resume_parser.py # PDF/DOCX resume parser │ ├── config.py # App configuration │ └── requirements.txt # Python dependencies │ ├── 📁 frontend/
│ └── src/ │ ├── App.jsx # Root component & routing │ ├── index.css # Global styles │ ├── context/ │ │ └── AuthContext.jsx # Authentication context │ ├── utils/ │ │ └── api.js # Axios API instance │ ├── components/ │ │ ├── ProtectedRoute.jsx │ │ └── RobotAnimation.jsx │ └── pages/ │ ├── Landing.jsx # Home page │ ├── Login.jsx │ ├── Signup.jsx │ ├── Dashboard.jsx │ ├── Interview.jsx # Interview module │ ├── Coding.jsx # Coding module │ └── Reports.jsx # Analytics page │ └── README.md

text


---

## 🚀 Installation & Setup

### Prerequisites

Make sure you have the following installed:
✅ Node.js v18+ → nodejs.org ✅ Python 3.11 → python.org ✅ Git → git-scm.com

text


### 1. Clone the Repository

```bash
git clone https://github.com/Dev-Jaiswal06/mockmind.git
cd mockmind
2. Backend Setup
Bash

# Navigate to backend
cd backend

# Create virtual environment with Python 3.11
py -3.11 -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
3. Environment Variables
Create a .env file inside the backend/ folder:

env

# Google Gemini API Key (free at aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mockmind

# JWT Secret Key
JWT_SECRET_KEY=your_secret_key_here

# Flask Environment
FLASK_ENV=development
Getting Free API Keys
Google Gemini API (Free)

text

1. Visit aistudio.google.com
2. Sign in with Google account
3. Click "Get API Key" → "Create API Key"
4. Copy and paste into .env
MongoDB Atlas (Free)

text

1. Visit mongodb.com/atlas
2. Create free account → Select M0 Free Tier
3. Create database user and whitelist IP (0.0.0.0/0)
4. Click Connect → Drivers → Copy connection string
5. Replace <password> with your password
4. Start Backend Server
Bash

# Inside backend/ with venv activated
python app.py
text

✅ MockMind MongoDB Connected & Ready!
🧠 MockMind Backend Starting...
📍 http://localhost:5000
5. Frontend Setup
Bash

# Open new terminal
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
text

➜  Local:   http://localhost:5173/
6. Open in Browser
text

http://localhost:5173
📡 API Documentation
Authentication Endpoints
Method	Endpoint	Description
POST	/api/auth/signup	Register new user
POST	/api/auth/login	Login user
GET	/api/auth/me	Get current user info
Interview Endpoints
Method	Endpoint	Description
GET	/api/interview/roles	Get available job roles
POST	/api/interview/start	Start new interview session
POST	/api/interview/submit-answer	Submit & evaluate answer
POST	/api/interview/complete	Complete session & get report
GET	/api/interview/history	Get past interview sessions
GET	/api/interview/session/<id>	Get session details
Coding Endpoints
Method	Endpoint	Description
GET	/api/coding/problem	Get AI-generated problem
POST	/api/coding/run	Run code (Piston API)
POST	/api/coding/submit	Submit against test cases
Reports Endpoints
Method	Endpoint	Description
GET	/api/reports/dashboard	Get dashboard statistics
GET	/api/reports/performance	Get performance analytics
👥 Team Members
Member	Role	Responsibility
Your Name	Project Lead & Full Stack	Project setup, Authentication, Dashboard, GitHub management
Member 2	Frontend Developer	Interview module UI, Coding module UI, Reports UI
Member 3	Backend Developer	Flask APIs, Interview logic, Coding execution
Member 4	AI & Database	MongoDB models, Gemini AI integration, Analytics
🎯 Supported Job Roles
Role	Technical Focus
Frontend Developer	HTML, CSS, JavaScript, React
Backend Developer	Node.js, APIs, Databases
Full Stack Developer	MERN Stack, System Design
Machine Learning	Algorithms, Statistics, Python
Data Science	Analytics, Visualization, ML
Data Analyst	SQL, Excel, Business Intelligence
Python Developer	OOP, Libraries, Frameworks
UI/UX Designer	Design Principles, Tools
DevOps Engineer	CI/CD, Docker, Cloud
📊 Evaluation Methodology
MockMind uses a hybrid scoring system combining two approaches:

text

Final Score = (AI Score × 0.70) + (Relevance Score × 0.30)

Where:
  AI Score       = Google Gemini evaluation (0-10)
  Relevance Score = TF-IDF Cosine Similarity between question and answer
This ensures both the quality of the answer and its relevance to the question are considered.

🔒 Security
Passwords hashed using bcrypt with salt rounds
API routes protected with JWT Bearer tokens
Environment variables used for all sensitive keys
MongoDB Atlas IP whitelisting
CORS configured for specific origins only
📄 License
This project is developed as a Final Year Academic Project.

🙏 Acknowledgements
Google Gemini AI — AI question generation and evaluation
MongoDB Atlas — Free cloud database
Piston API — Free code execution engine
Framer Motion — Animation library
Recharts — Chart components
<div align="center">
MockMind — AI-Based Mock Technical and HR Interview System

Final Year Project | Computer Science & Engineering

</div> ```
