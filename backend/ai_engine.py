# backend/ai_engine.py — Gemini / OpenRouter / Grok fallback support
import copy, os, json, random, re
import requests
from datetime import datetime
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-1.5-flash").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini").strip()
GROK_API_KEY = os.getenv("GROK_API_KEY", "").strip()
GROK_MODEL = os.getenv("GROK_MODEL", "grok-2").strip()
DEFAULT_PROVIDER_ORDER = [
    p.strip().lower()
    for p in os.getenv("AI_PROVIDER_ORDER", "gemini,openrouter,grok").split(",")
    if p.strip()
]
AI_TIMEOUT = int(os.getenv("AI_TIMEOUT", "20"))

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as exc:
        print(f"Gemini initialization failed: {exc}")

PRIMARY = GEMINI_MODEL
FALLBACK = GEMINI_FALLBACK_MODEL


def _call_gemini(prompt, temp=0.7, max_tokens=1200, timeout=None):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model_name = FALLBACK if os.getenv("GEMINI_USE_FALLBACK_MODEL", "false").lower() == "true" else PRIMARY
    m = genai.GenerativeModel(model_name)
    cfg = genai.types.GenerationConfig(temperature=temp, max_output_tokens=max_tokens)
    response = m.generate_content(
        prompt,
        generation_config=cfg,
        request_options={"timeout": timeout or AI_TIMEOUT},
    )
    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text.strip()


def _call_openrouter(prompt, temp=0.7, max_tokens=1200, timeout=None):
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("APP_URL", "http://localhost:5173"),
        "X-Title": "MockMind",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temp,
        "max_tokens": max_tokens,
    }
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=timeout or AI_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("OpenRouter returned an empty response")
    return content.strip()


def _call_grok(prompt, temp=0.7, max_tokens=1200, timeout=None):
    if not GROK_API_KEY:
        raise RuntimeError("GROK_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROK_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temp,
        "max_tokens": max_tokens,
    }
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=timeout or AI_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("Grok returned an empty response")
    return content.strip()


def _generate_text(prompt, temp=0.7, provider_order=None, max_tokens=1200, timeout=None):
    providers = list(provider_order or DEFAULT_PROVIDER_ORDER)
    last_error = None

    for provider in providers:
        try:
            if provider == "gemini":
                return _call_gemini(prompt, temp=temp, max_tokens=max_tokens, timeout=timeout)
            if provider == "openrouter":
                return _call_openrouter(prompt, temp=temp, max_tokens=max_tokens, timeout=timeout)
            if provider == "grok":
                return _call_grok(prompt, temp=temp, max_tokens=max_tokens, timeout=timeout)
            raise RuntimeError(f"Unsupported provider: {provider}")
        except Exception as exc:
            last_error = exc
            print(f"{provider} failed: {exc}")

    print(f"All AI providers failed. Last error: {last_error}")
    return None


def _gemini(prompt, temp=0.7, fallback=False, max_tokens=1200, timeout=None):
    provider_order = ["gemini", "openrouter", "grok"] if not fallback else ["openrouter", "grok", "gemini"]
    return _generate_text(prompt, temp=temp, provider_order=provider_order, max_tokens=max_tokens, timeout=timeout)


# ══════════════════════════════════════════════════════════════
# MONGODB FALLBACK FUNCTIONS
# ══════════════════════════════════════════════════════════════

try:
    from models import (question_bank_col, coding_problems_col, hr_questions_col,
                        user_questions_col, user_weak_topics_col, stats_col)
except ImportError:
    question_bank_col = None
    coding_problems_col = None
    hr_questions_col = None
    user_questions_col = None
    user_weak_topics_col = None
    stats_col = None


def _get_user_seen_questions(user_id):
    """User ke pehle dekhe questions ki lowercase keys lo (repeat rokne ke liye)."""
    if not user_id or user_questions_col is None:
        return set()
    try:
        rows = list(user_questions_col.find(
            {"user_id": user_id}, {"question": 1, "_id": 0}
        ).limit(1000))
        return {str(r.get("question", "")).strip().lower() for r in rows if r.get("question")}
    except Exception:
        return set()


def _record_user_questions(user_id, questions):
    """User ko diye gaye questions record karo — dobara na aayen."""
    if not user_id or user_questions_col is None or not questions:
        return
    try:
        docs = [
            {"user_id": user_id, "question": q, "asked_at": datetime.utcnow().isoformat()}
            for q in questions
            if isinstance(q, str) and q.strip()
        ]
        if docs:
            user_questions_col.insert_many(docs)
    except Exception:
        pass


def _random_docs(col, match, size):
    """Atlas me $sample unsupported hai — count+skip+limit se random docs lo."""
    if size <= 0:
        return []
    try:
        total = col.count_documents(match)
        if total == 0:
            return []
        size = min(size, total)
        if size >= total:
            return list(col.find(match).limit(size))
        offset = random.randint(0, total - size)
        return list(col.find(match).skip(offset).limit(size))
    except Exception:
        return []


def _get_mongodb_technical_questions(role, num_q=8, difficulty_mix=None, seen=None, prefer_topics=None):
    """MongoDB se technical questions lo with difficulty balance (seen skip karo).
    prefer_topics diya ho toh un topics ke questions pehle pick hote hain (weak areas)."""
    if question_bank_col is None:
        return None

    if difficulty_mix is None:
        difficulty_mix = {"easy": 2, "medium": 4, "hard": 2}
    seen = seen or set()
    db_role = role.lower().strip()

    def _order_by_weak(rows):
        if not prefer_topics:
            return rows
        weak_rows, normal_rows = [], []
        for r in rows:
            if any(t in _extract_topics(r.get("question", ""), role) for t in prefer_topics):
                weak_rows.append(r)
            else:
                normal_rows.append(r)
        return weak_rows + normal_rows

    all_questions = []
    seen_texts = set()
    for diff, count in difficulty_mix.items():
        if count <= 0:
            continue
        if len(all_questions) >= num_q:
            break
        # seen filtering ke baad bhi count mil sake isliye extra fetch karo
        fetch = min(max(count * 4, count + 10), 60)
        results = _random_docs(
            question_bank_col,
            {"role": db_role, "type": "technical", "difficulty": diff},
            fetch,
        )
        added = 0
        for r in _order_by_weak(results):
            if added >= count or len(all_questions) >= num_q:
                break
            q_text = r["question"]
            key = q_text.strip().lower()
            if key in seen or key in seen_texts:
                continue
            seen_texts.add(key)
            all_questions.append({
                "question": q_text,
                "difficulty": r.get("difficulty", diff),
                "asked_count": r.get("asked_count", 0),
                "_id": r["_id"],
            })
            added += 1

    # Agar kam questions aaye toh balance ke bina bhi try karo
    if len(all_questions) < num_q:
        remaining = num_q - len(all_questions)
        fetch = min(max(remaining * 4, remaining + 10), 60)
        results = _random_docs(
            question_bank_col,
            {"role": db_role, "type": "technical"},
            fetch,
        )
        for r in _order_by_weak(results):
            q_text = r["question"]
            key = q_text.strip().lower()
            if key in seen or key in seen_texts:
                continue
            if len(all_questions) >= num_q:
                break
            seen_texts.add(key)
            all_questions.append({
                "question": q_text,
                "difficulty": r.get("difficulty", "medium"),
                "asked_count": r.get("asked_count", 0),
                "_id": r["_id"],
            })

    return all_questions[:num_q] if all_questions else None


def _get_mongodb_coding_problem(difficulty=None):
    """MongoDB se coding problem lo (least attempted pehle)."""
    if coding_problems_col is None:
        return None

    try:
        match = {}
        if difficulty:
            match["difficulty"] = difficulty
        result = list(
            coding_problems_col.find(match)
            .sort([("attempted", 1)])
            .limit(1)
        )
        if result:
            r = result[0]
            r.pop("_id", None)
            # Auto-fix: if only 1 example, add 2nd from test_cases
            examples = r.get("examples", [])
            test_cases = r.get("test_cases", [])
            if len(examples) == 1 and len(test_cases) >= 2:
                tc = test_cases[1]
                examples.append({
                    "input": tc.get("input", ""),
                    "output": tc.get("expected", ""),
                    "explanation": "See the second test case."
                })
                r["examples"] = examples
            return r
    except Exception:
        pass
    return None


# ══════════════════════════════════
# CODING PROBLEM — runnable filter
# ══════════════════════════════════
_NON_RUNNABLE_SIG_TOKENS = (
    "ListNode", "TreeNode", "GraphNode", "RandomNode",
    "Node*", "Node *", "struct Node", "class ",
)


def _is_runnable_problem(problem):
    """Return False for problems the execution harness cannot run in any
    language (linked-list/tree/graph pointers, class-based design problems,
    clone-graph style inputs). char** string-array problems are kept: they
    run fine in Python/C++/Java."""
    try:
        sig = problem.get("function_signature") or {}
        if isinstance(sig, dict):
            sig_text = " ".join(str(v) for v in sig.values())
        else:
            sig_text = " ".join(str(v) for v in sig)
        return not any(tok in sig_text for tok in _NON_RUNNABLE_SIG_TOKENS)
    except Exception:
        return True


def _get_mongodb_coding_problems(difficulty=None, num_q=20):
    """MongoDB se coding problems lo and return up to num_q items."""
    if coding_problems_col is None or num_q <= 0:
        return None

    try:
        match = {}
        if difficulty:
            match["difficulty"] = difficulty

        fetch = min(max(num_q * 4, num_q + 20), 100)
        docs = _random_docs(coding_problems_col, match, fetch)
        problems = []
        for r in docs:
            if len(problems) >= num_q:
                break
            r.pop("_id", None)
            if not _is_runnable_problem(r):
                continue
            # Auto-fix: if only 1 example, add 2nd from test_cases
            examples = r.get("examples", [])
            test_cases = r.get("test_cases", [])
            if len(examples) == 1 and len(test_cases) >= 2:
                tc = test_cases[1]
                examples.append({
                    "input": tc.get("input", ""),
                    "output": tc.get("expected", ""),
                    "explanation": "See the second test case."
                })
                r["examples"] = examples
            problems.append(r)

        if problems:
            return problems[:num_q]
    except Exception:
        pass
    return None


def _update_question_asked_count(question_id, collection_type="question_bank"):
    """Question ka asked_count badhao."""
    try:
        if collection_type == "question_bank" and question_bank_col is not None:
            question_bank_col.update_one({"_id": question_id}, {"$inc": {"asked_count": 1}})
        elif collection_type == "hr" and hr_questions_col is not None:
            hr_questions_col.update_one({"_id": question_id}, {"$inc": {"asked_count": 1}})
    except Exception:
        pass


def _update_coding_attempted(title, solved=False):
    """Coding problem ka attempted/solved count badhao."""
    try:
        if coding_problems_col is not None:
            inc_fields = {"attempted": 1}
            if solved:
                inc_fields["solved"] = 1
            coding_problems_col.update_one({"title": title}, {"$inc": inc_fields})
    except Exception:
        pass


def _save_ai_question_to_db(question_text, role, round_type, difficulty="medium"):
    """Gemini Bonus — AI-generated question ko MongoDB me save karo."""
    try:
        if round_type == "hr" and hr_questions_col is not None:
            existing = hr_questions_col.find_one({"question": question_text})
            if not existing:
                hr_questions_col.insert_one({
                    "question": question_text,
                    "category": "behavioral",
                    "asked_count": 0,
                    "avg_score": 0.0,
                    "total_score_sum": 0.0,
                    "times_scored": 0,
                    "source": "ai_generated",
                })
        elif round_type == "technical" and question_bank_col is not None:
            existing = question_bank_col.find_one({"question": question_text, "role": role})
            if not existing:
                question_bank_col.insert_one({
                    "role": role,
                    "type": "technical",
                    "difficulty": difficulty,
                    "question": question_text,
                    "asked_count": 0,
                    "avg_score": 0.0,
                    "total_score_sum": 0.0,
                    "times_scored": 0,
                    "source": "ai_generated",
                })
    except Exception:
        pass


def _save_ai_coding_to_db(problem):
    """Gemini Bonus — AI-generated coding problem ko MongoDB me save karo."""
    try:
        if coding_problems_col is not None and problem:
            existing = coding_problems_col.find_one({"title": problem.get("title", "")})
            if not existing:
                doc = dict(problem)
                doc["attempted"] = 0
                doc["solved"] = 0
                doc["avg_score"] = 0.0
                doc["total_score_sum"] = 0.0
                doc["times_scored"] = 0
                doc["source"] = "ai_generated"
                coding_problems_col.insert_one(doc)
    except Exception:
        pass


def _parse(text):
    if not text:
        return None
    try:
        if "```" in text:
            for part in text.split("```"):
                p = part.strip().lstrip("json").strip()
                if p.startswith(("[", "{")):
                    return json.loads(p)
        return json.loads(text.strip())
    except:
        return None


def _tfidf(t1, t2):
    try:
        v = TfidfVectorizer(stop_words="english")
        m = v.fit_transform([t1, t2])
        return float(cosine_similarity(m[0:1], m[1:2])[0][0])
    except:
        return 0.3


def _is_behavioral_question(question):
    q = question.lower().strip()
    behavioral_phrases = [
        "tell me about a time",
        "describe a time",
        "describe a situation",
        "tell me about a project you",
        "how do you handle",
        "how do you prioritize",
        "where do you see yourself",
        "why are you interested",
        "why should we hire you",
        "what are your strengths",
        "what are your weaknesses",
        "what motivates you",
        "describe your ideal",
        "tell me about yourself",
        "what does teamwork",
        "do you have any questions",
        "how do you deal with",
        "give an example of",
        "share an experience",
        "what is your approach to collaborating",
        "how do you receive feedback",
        "how do you manage stress",
        "how do you work under pressure",
        "tell me about your career",
        "what are your goals",
        "describe your work style",
        "how do you handle conflict",
        "how do you handle criticism",
        "tell me about a challenge you faced",
        "describe a mistake you made",
        "tell me about a success",
        "what do you know about our company",
        "why this company",
        "why this role",
        "what sets you apart",
        "how would your peers describe you",
        "what do you bring to the team",
        "are you a team player",
        "how do you handle failure",
        "tell me about a leadership",
        "describe a time you led",
        "tell me about a goal you set",
    ]
    for phrase in behavioral_phrases:
        if phrase in q:
            return True
    if re.search(r"\b(tell me about|describe|how do you|what are your|where do you|why (are you|should we))\b", q):
        technical_keywords = [
            "api", "database", "server", "code", "function", "algorithm",
            "react", "python", "sql", "docker", "kubernetes", "aws",
            "authentication", "deployment", "cache", "redis", "nginx",
            "testing", "debugging", "performance", "security", "rest",
            "graphql", "websocket", "microservice", "ci/cd", "terraform",
            "model", "training", "data", "pipeline", "architecture",
            "css", "html", "javascript", "typescript", "node",
            "django", "flask", "fastapi", "spring", "express",
            "git", "linux", "shell", "scripting", "monitoring",
            "metric", "log", "trace", "scalab", "load balanc",
            "index", "query", "schema", "migration", "orm",
        ]
        has_technical = any(kw in q for kw in technical_keywords)
        if not has_technical:
            return True
    return False


def _filter_questions(questions, round_type):
    if round_type != "technical":
        return questions
    filtered = [q for q in questions if not _is_behavioral_question(q)]
    return filtered


# ══════════════════════════════════
# 1. GENERATE QUESTIONS
# ══════════════════════════════════

ROLE_TOPICS = {
    "frontend developer": {
        "technical": [
            "Explain the virtual DOM in React and how it differs from the real DOM. When would you use useMemo vs useCallback?",
            "What is the difference between CSS Grid and Flexbox? When would you choose one over the other for a layout?",
            "How does the browser rendering pipeline work? What is reflow and repaint, and how do you minimize them?",
            "Explain event delegation in JavaScript. Why is it useful and how does it relate to the concept of bubbling?",
            "What are Web Workers? When would you use them and what are their limitations compared to Service Workers?",
            "How does code splitting work with React.lazy and Suspense? What happens when a chunk fails to load?",
            "Explain the CORS preflight request. Why does the browser send an OPTIONS request before the actual request?",
            "What is the difference between SSR, SSG, and ISR? Give an example of when you would use each.",
            "How do you handle form validation in React without a library? Explain controlled vs uncontrolled components.",
            "What are CSS custom properties (variables) and how do they differ from preprocessor variables like SASS?",
            "Explain the concept of Critical Rendering Path. How do you optimize it for faster page loads?",
            "What is the Shadow DOM and how is it used in Web Components? Give a practical use case.",
            "How does requestAnimationFrame work? Why is it preferred over setTimeout for animations?",
            "What are Progressive Images and how do you implement a blur-up loading technique?",
            "Explain the difference between localStorage, sessionStorage, IndexedDB, and cookies. When do you use each?",
            "Explain the semantic elements of HTML5 (header, nav, main, article, aside, footer). Why do they matter for accessibility and SEO?",
            "What is the difference between WCAG levels A, AA, and AAA? How would you test a page for accessibility?",
            "What is ARIA? Give examples of when you should use ARIA attributes and when you should avoid them.",
            "Compare Redux, Context API, and Zustand for state management. When would you choose each in a React app?",
            "How would you unit test a React component with Jest and React Testing Library? What would you mock?",
        ],
    },
    "backend developer": {
        "technical": [
            "Explain the N+1 query problem in ORMs. How do you detect and solve it in Django or SQLAlchemy?",
            "What is database connection pooling? How does it work and why is it critical for backend performance?",
            "Explain the CAP theorem. Give an example of a system that chooses AP over CP and why.",
            "What is the difference between horizontal and vertical scaling? When would you choose one over the other?",
            "How does JWT authentication work step by step? What happens when a token is compromised?",
            "Explain idempotency in REST APIs. Why is it important and how do you implement it for POST endpoints?",
            "What is a database transaction? Explain ACID properties with a real-world banking example.",
            "How do you implement rate limiting? Compare token bucket, sliding window, and fixed window approaches.",
            "Explain the difference between message queues (RabbitMQ, Kafka) and when you would use each.",
            "What is database sharding? What problems does it solve and what new challenges does it introduce?",
            "How does connection keep-alive work in HTTP/1.1 vs HTTP/2? Why does it matter for API servers?",
            "Explain the saga pattern for distributed transactions. How does it differ from two-phase commit?",
            "What is the difference between optimistic and pessimistic locking? Give a use case for each.",
            "How do you handle graceful shutdown in a backend service? What about in-flight requests?",
            "Explain how caching invalidation strategies work. Compare write-through, write-behind, and write-around.",
            "Explain the difference between unit, integration, and end-to-end testing for a backend service. Which layers would you mock?",
            "What is SQL injection? How do you prevent it in your backend code (parameterized queries, ORM usage)?",
            "How do you version a REST API and implement pagination? Compare offset vs cursor-based pagination.",
            "How do you containerize a backend service? What is a multi-stage Docker build and why is it used?",
        ],
    },
    "full stack developer": {
        "technical": [
            "How would you design a real-time chat application? Cover the frontend, backend, database, and WebSocket layer.",
            "Explain the difference between server-side rendering and client-side rendering. What are the trade-offs for SEO and performance?",
            "How do you handle authentication across a frontend SPA and a backend API? Explain the cookie vs token approach.",
            "What is the BFF (Backend for Frontend) pattern? When would you use it over a shared API gateway?",
            "How would you implement optimistic UI updates in a React app while handling server-side validation failures?",
            "Explain the difference between REST and GraphQL. When would GraphQL be a better choice?",
            "How do you implement infinite scrolling with proper caching and deduplication of API calls?",
            "What is the Strangler Fig pattern? How would you use it to migrate a monolith to microservices?",
            "How do you handle file uploads from a frontend to a backend? Explain multipart form data and presigned URLs.",
            "Explain how you would implement search autocomplete across the full stack. Cover debounce, API design, and indexing.",
            "How do you manage state across microservices when building a full stack e-commerce application?",
            "What is the difference between polling, long-polling, SSE, and WebSockets? When do you use each?",
            "How would you implement role-based access control (RBAC) across frontend routes and backend APIs?",
            "Explain how you would debug a slow page load that only happens in production. What tools and techniques would you use?",
            "How do you implement dark mode across a full stack application? Cover CSS, state management, and user preferences.",
            "Explain the rules of React hooks and common pitfalls like stale closures and incorrect dependency arrays.",
            "What are XSS and CSRF? How do you protect a full-stack application against both?",
            "How would you test a full-stack feature? Compare unit, integration, and E2E testing and when to use each.",
            "How do you write an efficient SQL query with joins and indexes? How would you analyze query performance?",
        ],
    },
    "machine learning": {
        "technical": [
            "Explain the bias-variance tradeoff. How does model complexity affect each, and how do you diagnose it from learning curves?",
            "What is the vanishing gradient problem? How do architectures like LSTM and ResNet address it?",
            "Explain the difference between L1 and L2 regularization. When would you use Lasso vs Ridge regression?",
            "How does a Random Forest handle overfitting compared to a single Decision Tree? What about feature importance?",
            "What is cross-validation? Explain stratified k-fold and why it is preferred over simple train-test split.",
            "Explain the attention mechanism in Transformers. How does self-attention differ from cross-attention?",
            "What is transfer learning? How would you fine-tune a pre-trained BERT model for sentiment analysis?",
            "Explain the difference between generative and discriminative models. Give an example of each.",
            "How do you handle missing data in a dataset? Compare mean imputation, MICE, and KNN imputation.",
            "What is the curse of dimensionality? How does PCA help and what are its limitations?",
            "Explain precision, recall, F1-score, and AUC-ROC. When would you optimize for recall over precision?",
            "How does gradient boosting work? Compare XGBoost, LightGBM, and CatBoost.",
            "What is data leakage? Give examples of how it can happen and how to prevent it.",
            "Explain the difference between batch normalization and layer normalization. When do you use each?",
            "How would you deploy a machine learning model to production? Discuss monitoring for data drift and model degradation.",
            "Describe the architecture of a CNN: convolution, pooling, and fully connected layers. Why do convolutions work well for images?",
            "What are tokenization and embeddings in NLP? How does word2vec create word vectors?",
            "Explain retrieval-augmented generation (RAG). How would you evaluate an LLM-powered system?",
            "Compare logistic regression, SVM, and Naive Bayes for classification. When would you choose each?",
        ],
    },
    "data science": {
        "technical": [
            "Explain the p-value in hypothesis testing. What are the common misinterpretations of p-values?",
            "What is Simpson's Paradox? Give a real-world example where aggregated data tells a different story.",
            "How do you handle multicollinearity in a regression model? What diagnostics would you use?",
            "Explain the Central Limit Theorem and why it matters for statistical inference in data science.",
            "What is the difference between ANOVA and t-test? When would you use each?",
            "How do you design an A/B test? Cover sample size calculation, statistical significance, and common pitfalls.",
            "Explain the difference between exploratory and confirmatory data analysis. How do they serve different purposes?",
            "What is survival analysis? When would you use Kaplan-Meier curves vs Cox proportional hazards?",
            "How do you detect and handle outliers? Compare Z-score, IQR, and isolation forest methods.",
            "Explain the difference between correlation and causation. How do you establish causal relationships from data?",
            "What is a funnel analysis? How would you identify where users drop off in an e-commerce checkout flow?",
            "How do you handle imbalanced classes in a classification problem? Compare oversampling, undersampling, and SMOTE.",
            "Explain time series decomposition. What are trend, seasonality, and residual components?",
            "What is the difference between parametric and non-parametric statistical tests? Give examples of each.",
            "How do you build a recommendation system? Compare collaborative filtering and content-based approaches.",
            "How would you extract, clean, and aggregate data with SQL for a business analysis task?",
            "How do you clean and transform a dataset with pandas and NumPy? Give examples of common operations.",
            "Explain decision trees vs gradient boosting (XGBoost). When would you use each?",
            "Describe common probability distributions (binomial, Poisson, normal). When does each apply in real data?",
        ],
    },
    "data analyst": {
        "technical": [
            "Write a SQL query to find the top 3 customers by revenue in each region using window functions.",
            "What is the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN? When would you use a CROSS JOIN?",
            "Explain the difference between DELETE, TRUNCATE, and DROP. What are the performance implications?",
            "How do you create a cohort analysis in SQL or Excel? Walk through the steps for a subscription business.",
            "What are window functions in SQL? Explain ROW_NUMBER, RANK, DENSE_RANK, and LAG/LEAD with examples.",
            "How do you clean messy data in Excel or Python? What are common data quality issues you encounter?",
            "Explain the difference between descriptive, diagnostic, predictive, and prescriptive analytics with examples.",
            "How would you build a dashboard in Tableau or Power BI? What design principles do you follow?",
            "What is a pivot table and when would you use one? How do you handle multiple value fields?",
            "How do you calculate and interpret moving averages? What are the differences between SMA and EMA?",
            "Explain the difference between normalization and standardization. When do you apply each in analysis?",
            "How do you handle missing values in a dataset? What questions do you ask before deciding on an approach?",
            "What is the difference between a bar chart, histogram, and box plot? When do you use each?",
            "How do you calculate year-over-year growth and month-over-month growth in SQL?",
            "Explain the concept of statistical significance vs practical significance in business analysis.",
            "What is a hypothesis test? Explain p-value and confidence intervals in plain language.",
            "How would you design an A/B test for a website change? What metrics would you track?",
            "What are CTEs and window functions in SQL? Give an example where a CTE simplifies a query.",
            "What are DAU/MAU, retention, and funnel analysis? How do they inform product decisions?",
        ],
    },
    "python developer": {
        "technical": [
            "Explain Python's GIL (Global Interpreter Lock). How does it affect threading and what are the workarounds?",
            "What is the difference between a generator and an iterator? When would you use a generator expression over a list comprehension?",
            "Explain decorators in Python. How would you write a decorator that logs execution time of a function?",
            "What are metaclasses in Python? When would you use __init_subclass__ instead of a metaclass?",
            "How does Python's memory management work? Explain reference counting, garbage collection, and __slots__.",
            "What is the difference between *args, **kwargs, and keyword-only arguments? Give edge cases for each.",
            "Explain context managers in Python. How do you write a custom one using both a class and contextlib?",
            "What is the difference between asyncio and multiprocessing? When would you use each?",
            "How do you profile a Python application for memory leaks? What tools and techniques do you use?",
            "Explain the difference between deepcopy and shallow copy. When does it matter for nested dictionaries?",
            "What are Python dataclasses? How do they differ from regular classes and NamedTuples?",
            "How does Python's import system work? Explain the role of __import__, importlib, and sys.path.",
            "What is monkey patching and why is it dangerous? Give an example where it might be justified.",
            "Explain the difference between map, filter, and reduce. When would you use a list comprehension instead?",
            "How do you handle circular imports in Python? What design patterns help avoid them?",
            "Explain Method Resolution Order (MRO) and multiple inheritance in Python. How does super() resolve calls?",
            "Compare Flask and Django. When would you choose each for a backend project?",
            "How do you write tests with pytest? Explain fixtures, parametrize, and mocking.",
            "How do you handle file I/O and exceptions in Python? What is the with statement for?",
        ],
    },
    "ui/ux designer": {
        "technical": [
            "Explain the double diamond design process. How do you move from research to ideation to prototyping?",
            "What is the difference between user-centered design and human-centered design?",
            "How do you conduct a heuristic evaluation? Walk through Nielsen's 10 usability heuristics.",
            "Explain the concept of affordance in design. Give examples of good and bad affordances in digital products.",
            "What is information architecture? How do you organize content for a complex web application?",
            "How do you approach designing for accessibility? Explain WCAG guidelines and ARIA labels.",
            "What is the difference between a wireframe, mockup, and prototype? When do you create each?",
            "Explain atomic design methodology. How do you build and maintain a design system using this approach?",
            "How do you handle design handoff to developers? What specs and assets do you provide?",
            "What is the Fitts's Law and how does it influence button sizing and placement in UI design?",
            "Explain the Gestalt principles of visual perception. How do you apply them in interface design?",
            "How do you conduct user testing? Compare moderated vs unmoderated testing and their trade-offs.",
            "What is a user persona and how do you create one? How do personas influence design decisions?",
            "Explain the difference between UX writing and copywriting. How does microcopy affect user experience?",
            "How do you design for different screen sizes? Explain responsive, adaptive, and fluid design approaches.",
            "How do you use Figma for design systems, reusable components, and team collaboration?",
            "What is micro-interaction and animation design? How do they affect usability and perceived performance?",
            "Compare iOS HIG and Material Design guidelines. When would you use each?",
            "What is SUS (System Usability Scale)? How do you measure task success and error rates in usability testing?",
        ],
    },
    "devops engineer": {
        "technical": [
            "Explain the difference between a Docker image and a container. What is a multi-stage build and why use it?",
            "How does Kubernetes scheduling work? Explain pods, deployments, services, and ingress controllers.",
            "What is Infrastructure as Code? Compare Terraform, Pulumi, and CloudFormation in terms of state management.",
            "Explain the GitOps workflow. How does ArgoCD or FluxCD automate Kubernetes deployments?",
            "What is a service mesh? Explain how Istio or Linkerd handles service-to-service communication.",
            "How do you set up a CI/CD pipeline from scratch? Cover build, test, scan, deploy stages.",
            "Explain the difference between blue-green, canary, and rolling deployments. When do you use each?",
            "What is observability? Compare the three pillars: logs, metrics, and traces.",
            "How do you handle secrets in a Kubernetes cluster? Compare Sealed Secrets, Vault, and External Secrets Operator.",
            "Explain networking in Kubernetes. How do services communicate across namespaces?",
            "What is the difference between a statefulset and a deployment in Kubernetes? When do you use each?",
            "How do you implement auto-scaling? Compare HPA, VPA, and cluster autoscaler.",
            "Explain how Prometheus and Grafana work together for monitoring. How do you set up meaningful alerts?",
            "What is the blast radius of a failed deployment? How do you implement circuit breakers and retry policies?",
            "How do you handle disaster recovery? Explain RTO, RPO, and backup strategies for cloud infrastructure.",
            "Explain IAM roles and policies, VPC, and object storage (like S3) in a cloud provider. How do they interact?",
            "What common Linux commands and shell scripting techniques do you use for ops (grep, awk, sed, systemd)?",
            "What are Helm charts, ConfigMaps, and Ingress in Kubernetes? How do you manage configuration?",
            "How do you aggregate logs with ELK or Loki and build dashboards? How do you correlate logs with metrics?",
        ],
    },
}


# ══════════════════════════════════════════════════════════════
# WEAK TOPIC TRACKING — adaptive question personalization
# ══════════════════════════════════════════════════════════════

# Har role ke topic keywords — question text se topic nikalne ke liye.
# Pehla match priority — order important hai (specific → generic).
ROLE_TOPIC_KEYWORDS = {
    "frontend developer": [
        ("React & Components", ["react", "virtual dom", "usememo", "usecallback", "react.lazy", "suspense",
                                 "controlled", "uncontrolled", "component", "jsx"]),
        ("CSS & Layout", ["css", "grid", "flexbox", "sass", "custom propert", "shadow dom",
                          "critical rendering", "reflow", "repaint"]),
        ("JavaScript Core", ["javascript", "event delegation", "bubbling", "web worker",
                             "requestanimationframe", "localstorage", "sessionstorage",
                             "indexeddb", "cookies"]),
        ("Browser & Network", ["cors", "preflight", "server-side", "client-side"]),
        ("SSR & Rendering", ["ssr", "ssg", "isr", "progressive image"]),
        ("HTML & Accessibility", ["html", "semantic", "accessibility", "wcag", "aria"]),
        ("State Management & Testing", ["redux", "context api", "zustand", "state management",
                                        "jest", "testing library", "unit test"]),
    ],
    "backend developer": [
        ("Databases & ORMs", ["n+1", "orm", "sqlalchemy", "django", "connection pool", "transaction",
                              "acid", "sharding", "optimistic", "pessimistic", "locking",
                              "query", "index", "schema", "migration"]),
        ("System Design & Scaling", ["cap theorem", "horizontal", "vertical", "scal", "rate limit",
                                     "token bucket", "sliding window", "saga", "two-phase",
                                     "distributed", "idempotency"]),
        ("APIs & Authentication", ["jwt", "token", "rest", "endpoint", "keep-alive", "http", "api"]),
        ("Messaging & Caching", ["message queue", "rabbitmq", "kafka", "cache", "invalidation",
                                 "write-through", "write-behind", "write-around"]),
        ("Operations & Reliability", ["graceful shutdown", "in-flight", "connection", "load balanc"]),
        ("Testing & Security", ["unit", "integration", "end-to-end", "e2e", "sql injection",
                                "security", "parameterized"]),
        ("API Design & Docker", ["version", "pagination", "cursor", "offset", "docker",
                                 "multi-stage", "containeriz"]),
    ],
    "full stack developer": [
        ("Real-time & WebSockets", ["websocket", "polling", "long-polling", "sse", "real-time"]),
        ("Frontend Patterns", ["optimistic ui", "spa", "server-side rendering", "client-side",
                               "dark mode", "infinite scroll"]),
        ("APIs & Data", ["rest", "graphql", "bff", "autocomplete", "file upload", "multipart",
                         "presigned", "api gateway", "role-based", "rbac"]),
        ("Architecture", ["microservice", "strangler fig", "monolith", "state", "cache"]),
        ("Debugging & Performance", ["slow page load", "debugging", "debug", "performance"]),
        ("Testing & Security", ["xss", "csrf", "unit test", "integration", "e2e", "end-to-end",
                                "jest", "security"]),
        ("React & SQL", ["hooks", "stale closure", "dependency array", "joins", "index",
                         "sql query", "query performance"]),
    ],
    "machine learning": [
        ("ML Fundamentals", ["bias-variance", "model complexity", "learning curve", "overfitt",
                             "cross-validation", "stratified", "train-test"]),
        ("Deep Learning", ["vanishing gradient", "lstm", "resnet", "attention", "transformer",
                           "self-attention", "cross-attention", "normalization"]),
        ("Regularization & Optimization", ["l1", "l2", "regularization", "lasso", "ridge",
                                           "gradient boost", "xgboost", "lightgbm", "catboost"]),
        ("Data & Features", ["missing data", "imputation", "mice", "knn", "dimensionality", "pca",
                             "feature importance", "data leakage"]),
        ("Evaluation Metrics", ["precision", "recall", "f1", "auc", "roc"]),
        ("MLOps & Deployment", ["deploy", "production", "drift", "monitoring", "generative",
                                "discriminative"]),
        ("Computer Vision & NLP", ["cnn", "convolution", "pooling", "tokeniz", "embedding",
                                   "word2vec"]),
        ("LLMs & RAG", ["rag", "retrieval-augmented", "llm", "evaluation"]),
        ("Classical Models", ["logistic regression", "svm", "support vector", "naive bayes"]),
    ],
    "data science": [
        ("Statistics", ["p-value", "hypothesis", "simpson", "central limit", "anova", "t-test",
                        "parametric", "non-parametric", "correlation", "causation"]),
        ("Experiments & A/B Testing", ["a/b", "ab test", "sample size", "significance"]),
        ("Regression & Modeling", ["regression", "multicollinearity", "survival analysis",
                                   "kaplan-meier", "cox", "outlier", "z-score", "iqr",
                                   "isolation forest"]),
        ("Imbalanced Data", ["imbalanced", "oversam", "undersam", "smote"]),
        ("Time Series", ["time series", "trend", "seasonality", "residual", "moving average",
                         "forecast"]),
        ("Recommendation Systems", ["recommendation", "collaborative", "content-based"]),
        ("Analytics & Funnels", ["funnel", "drop off", "checkout", "e-commerce", "cohort"]),
        ("SQL & Python", ["sql", "pandas", "numpy", "aggregate", "extract"]),
        ("Distributions & Sampling", ["binomial", "poisson", "distribution", "normal"]),
    ],
    "data analyst": [
        ("SQL & Joins", ["sql", "join", "cross join", "window function", "row_number", "rank",
                         "dense_rank", "lag", "lead", "query", "pivot"]),
        ("Data Cleaning", ["clean", "data quality", "missing value", "messy data"]),
        ("Analysis Types", ["descriptive", "diagnostic", "predictive", "prescriptive", "cohort"]),
        ("Dashboards & Visualization", ["dashboard", "tableau", "power bi", "bar chart", "histogram",
                                        "box plot", "visualization"]),
        ("Business Metrics", ["year-over-year", "month-over-month", "growth", "revenue",
                              "statistical significance", "practical significance",
                              "moving average", "sma", "ema"]),
        ("Statistics & A/B Testing", ["hypothesis", "p-value", "confidence interval", "a/b test",
                                      "ab test", "website change"]),
        ("Product & Business Metrics", ["dau", "mau", "retention", "funnel", "product metric"]),
    ],
    "python developer": [
        ("Python Internals", ["gil", "threading", "memory management", "reference counting",
                              "garbage collection", "__slots__", "import system", "sys.path",
                              "monkey patching", "circular import"]),
        ("Core Constructs", ["generator", "iterator", "decorator", "metaclass", "args", "kwargs",
                             "context manager", "contextlib", "dataclass", "namedtuple",
                             "deepcopy", "shallow copy", "map", "filter", "reduce",
                             "list comprehension"]),
        ("Concurrency & Async", ["asyncio", "multiprocessing", "thread"]),
        ("Profiling & Debugging", ["profile", "memory leak", "debug"]),
        ("OOP & Magic Methods", ["oop", "class", "mro", "multiple inheritance", "super()",
                                 "magic method"]),
        ("Frameworks & Testing", ["flask", "django", "fastapi", "pytest", "fixture",
                                  "parametrize", "mock"]),
        ("File I/O & Exceptions", ["file", "io", "with statement", "exception", "open("]),
    ],
    "ui/ux designer": [
        ("Design Process", ["double diamond", "research", "ideation", "prototyp", "user testing",
                            "moderated", "unmoderated", "persona"]),
        ("Design Principles", ["affordance", "fitts", "gestalt", "heuristic", "nielsen",
                               "accessibility", "wcag", "aria"]),
        ("Design Systems", ["atomic design", "design system", "wireframe", "mockup", "handoff",
                            "information architecture"]),
        ("UX Writing", ["ux writing", "copywriting", "microcopy"]),
        ("Responsive Design", ["responsive", "adaptive", "fluid", "screen size"]),
        ("Design Tools & Interaction", ["figma", "micro-interaction", "animation", "motion"]),
        ("Usability Metrics", ["sus", "system usability scale", "task success", "error rate"]),
        ("Mobile Patterns", ["ios", "material design", "mobile"]),
    ],
    "devops engineer": [
        ("Docker & Containers", ["docker", "image", "container", "multi-stage"]),
        ("Kubernetes", ["kubernetes", "k8s", "pod", "ingress", "namespace", "statefulset",
                        "hpa", "vpa", "cluster autoscaler", "gitops", "argocd", "fluxcd",
                        "service mesh", "istio", "linkerd", "networking"]),
        ("CI/CD & Deployments", ["ci/cd", "pipeline", "blue-green", "canary", "rolling",
                                 "deployment"]),
        ("Infrastructure as Code", ["terraform", "pulumi", "cloudformation", "iac", "secrets",
                                    "vault", "sealed secrets"]),
        ("Observability", ["observability", "logs", "metrics", "traces", "prometheus", "grafana",
                           "monitoring", "alert"]),
        ("Reliability & DR", ["disaster recovery", "rto", "rpo", "backup", "circuit breaker",
                              "retry", "blast radius"]),
        ("Cloud & Linux", ["iam", "vpc", "s3", "aws", "gcp", "azure", "grep", "awk", "sed",
                           "systemd", "shell scripting", "linux"]),
        ("Helm & Log Aggregation", ["helm", "configmap", "elk", "loki", "log aggregat"]),
    ],
}


# Har role ka coverage hint — AI prompt me inject hota hai taaki questions puri
# domain spread (common interview topics) cover karein.
_COVERAGE_HINTS = {
    "frontend developer": "React & JS core, HTML semantics, CSS layout, accessibility (WCAG/ARIA), "
        "state management, testing (Jest/RTL), browser APIs, performance, SSR/rendering, "
        "security (XSS/CSRF)",
    "backend developer": "databases & SQL, ORMs, API design & versioning, authentication (JWT), "
        "caching, messaging, scaling & distributed systems, testing, security, Docker, observability",
    "full stack developer": "React & JavaScript, CSS/HTML, state management, frontend-backend APIs, "
        "auth, databases & SQL, testing, security (XSS/CSRF), deployment, performance",
    "machine learning": "ML fundamentals, classical algorithms (regression/SVM/Naive Bayes), "
        "deep learning, CNN/computer vision, NLP & embeddings, LLMs & RAG, evaluation metrics, MLOps",
    "data science": "statistics & inference, probability distributions, experiments (A/B testing), "
        "SQL & data wrangling, pandas/NumPy, ML models, causal analysis, time series",
    "data analyst": "SQL (joins/windows/CTEs), statistics (hypothesis tests), A/B testing, "
        "data cleaning, dashboards, business & product metrics, data storytelling",
    "python developer": "Python internals (GIL/memory), core constructs (generators/decorators), "
        "OOP & magic methods, web frameworks, testing (pytest), file I/O & exceptions, async, "
        "packaging",
    "ui/ux designer": "design process & research, design principles & heuristics, design systems "
        "& tools (Figma), accessibility, interaction & animation, mobile patterns, usability "
        "testing & metrics",
    "devops engineer": "Docker & containers, Kubernetes, cloud (IAM/VPC/storage), Linux & shell, "
        "CI/CD, Infrastructure as Code, observability, Helm & config, reliability & DR",
}


# Generic tech topics — role map miss ho toh ye lagte hain (cross-cutting tech like React/DB/API)
GENERIC_TOPIC_KEYWORDS = [
    ("React & Components", ["react", "virtual dom", "usememo", "usecallback", "jsx", "component"]),
    ("JavaScript Core", ["javascript", "typescript", "closure", "promise", "event loop", "async"]),
    ("CSS & Styling", ["css", "flexbox", "grid", "sass", "responsive", "styling"]),
    ("HTML & Browser", ["html", "dom", "browser", "rendering", "cors", "web worker"]),
    ("Databases", ["database", "sql", "nosql", "mongodb", "postgres", "mysql", "query", "index",
                   "transaction", "orm", "sharding"]),
    ("APIs & Backend", ["api", "rest", "graphql", "http", "endpoint", "jwt", "authentication",
                        "websocket"]),
    ("System Design & Architecture", ["system design", "microservice", "scal", "architecture",
                                      "distributed", "message queue", "caching", "load balanc",
                                      "monolith"]),
    ("DevOps & Cloud", ["docker", "kubernetes", "ci/cd", "terraform", "aws", "azure", "cloud",
                        "deploy", "monitoring"]),
    ("Algorithms & Data Structures", ["algorithm", "complexity", "array", "tree", "graph",
                                      "sorting", "binary search", "stack", "queue", "heap"]),
    ("Data & ML", ["machine learning", "model", "training", "neural", "deep learning",
                   "data science", "statistics", "dataset"]),
    ("Python", ["python", "django", "flask", "generator", "decorator", "gil"]),
]


def _topic_keyword_hits(keywords, q):
    """Keyword match with word-boundary at start (prefix match allowed).
    'dom' 'random' me nahi milega, lekin 'scal' 'scaling' me milega."""
    try:
        return any(re.search(r"\b" + re.escape(kw), q) for kw in keywords)
    except Exception:
        return any(kw in q for kw in keywords)


def _extract_topics(question, role):
    """Question text se topic labels nikalo — ROLE_TOPIC_KEYWORDS keyword match,
    phir GENERIC_TOPIC_KEYWORDS fallback. Sab match hoke bhi khali ho toh role naam."""
    try:
        q = str(question).lower()
        role_lower = role.lower()
        role_key = None
        for key in ROLE_TOPIC_KEYWORDS:
            if key in role_lower or role_lower in key:
                role_key = key
                break

        topics = []
        if role_key:
            for topic, keywords in ROLE_TOPIC_KEYWORDS[role_key]:
                if _topic_keyword_hits(keywords, q):
                    topics.append(topic)
        for topic, keywords in GENERIC_TOPIC_KEYWORDS:
            if topic in topics:
                continue
            if _topic_keyword_hits(keywords, q):
                topics.append(topic)
        if not topics:
            topics = [role.title()]
        return topics
    except Exception:
        return [role.title()]


def _get_user_weak_topics(user_id, role):
    """User ke weak topics {topic: count} — count desc. Khali dict agar koi data nahi."""
    if not user_id or user_weak_topics_col is None:
        return {}
    try:
        rows = list(user_weak_topics_col.find(
            {"user_id": user_id, "role": role.lower().strip()},
            {"topic": 1, "count": 1, "_id": 0}
        ).sort("count", -1).limit(8))
        return {r["topic"]: r["count"] for r in rows if r.get("topic")}
    except Exception:
        return {}


def _record_weak_topics(user_id, role, evals):
    """Score < 4 waale questions ke topics weak_topics_col me count karo."""
    if not user_id or user_weak_topics_col is None or not evals:
        return
    try:
        role_lower = role.lower().strip()
        updates = {}
        for ev in evals:
            if not ev:
                continue
            score  = ev.get("score", 0)
            q_text = ev.get("question", "")
            if score >= 4 or not q_text:
                continue
            for topic in _extract_topics(q_text, role):
                updates[topic] = updates.get(topic, 0) + 1

        now = datetime.utcnow().isoformat()
        for topic, n in updates.items():
            user_weak_topics_col.update_one(
                {"user_id": user_id, "role": role_lower, "topic": topic},
                {"$inc": {"count": n}, "$set": {"last_weak_at": now}},
                upsert=True,
            )
    except Exception:
        pass


def _get_user_avg_score(user_id):
    """User ka average interview percentage — difficulty adjustment ke liye."""
    if not user_id or stats_col is None:
        return None
    try:
        doc = stats_col.find_one({"user_id": user_id}, {"avg_interview_score": 1})
        return doc.get("avg_interview_score") if doc else None
    except Exception:
        return None


_DIFFICULTY_PRESETS = [
    {"label": "1 easy, 3 medium, 4 hard", "mix": {"easy": 1, "medium": 3, "hard": 4}},
    {"label": "2 easy, 4 medium, 2 hard", "mix": {"easy": 2, "medium": 4, "hard": 2}},
    {"label": "3 easy, 3 medium, 2 hard", "mix": {"easy": 3, "medium": 3, "hard": 2}},
]


def _pick_difficulty(user_id):
    """Avg score se difficulty chuno — weak = easy, strong = hard, middle = random."""
    avg = _get_user_avg_score(user_id)
    if avg is None:
        return random.choice(_DIFFICULTY_PRESETS)
    if avg < 40:
        return _DIFFICULTY_PRESETS[2]
    if avg > 70:
        return _DIFFICULTY_PRESETS[0]
    return random.choice(_DIFFICULTY_PRESETS)


def _HR_FALLBACK_QUESTIONS(role):
    qs = [
        "Tell me about yourself and why you are interested in this role",
        "What are your greatest strengths and weaknesses",
        "Where do you see yourself in 5 years",
        "Why should we hire you for this position",
        "Tell me about a time you demonstrated leadership",
        "How do you handle stress and pressure at work",
        "Describe your ideal work environment",
        "Tell me about a time you failed and what you learned from it",
        "What motivates you in your professional life",
        "How do you handle conflict with a teammate or manager",
        "Tell me about a time you had to meet a tight deadline",
        "Describe a situation where you went above and beyond",
        "How do you prioritize tasks when everything feels urgent",
        "Tell me about a project you are most proud of and why",
        "Do you have any questions for us about the company or role",
        "Why are you interested in this company specifically",
        "How do you handle receiving constructive criticism",
        "Describe a time you had to adapt to a major change",
        "What does teamwork mean to you",
        "Tell me about a time you solved a problem creatively",
    ]
    random.shuffle(qs)
    return qs


def _TECH_FALLBACK_QUESTIONS(role):
    role_lower = role.lower()
    role_key = None
    for key in ROLE_TOPICS:
        if key in role_lower or role_lower in key:
            role_key = key
            break

    if role_key:
        pool = ROLE_TOPICS[role_key]["technical"][:]
    else:
        pool = [
            f"Explain a core concept in {role} that is most important for an intern to master",
            f"What tools and technologies are most critical for {role} and why",
            f"Describe a challenging technical problem you solved in a {role} context",
            f"How do you approach debugging and troubleshooting in {role}?",
            f"What testing and quality practices do you follow in {role}?",
            f"Explain the difference between two commonly confused concepts in {role}",
            f"How do you ensure performance and scalability in {role} work?",
            f"What security considerations are important in {role}?",
            f"Describe how you would architect a new system for a {role} use case",
            f"What monitoring and observability practices do you follow in {role}?",
        ]
    random.shuffle(pool)
    return pool


def _FALLBACK_QUESTIONS(role, round_type="technical"):
    if round_type == "hr":
        return _HR_FALLBACK_QUESTIONS(role)
    return _TECH_FALLBACK_QUESTIONS(role)


def _generate_hr_questions(num_q=8):
    """HR core + random pool — standard HR interview questions (repeat allowed)."""
    hr_core = [
        "Tell me about yourself and why you are interested in this role",
        "What are your greatest strengths and weaknesses",
        "Why should we hire you for this position",
        "Where do you see yourself in 5 years",
    ]
    hr_pool = [
        "Tell me about a time you demonstrated leadership",
        "How do you handle stress and pressure at work",
        "Describe your ideal work environment",
        "Tell me about a time you failed and what you learned from it",
        "What motivates you in your professional life",
        "How do you handle conflict with a teammate or manager",
        "Tell me about a time you had to meet a tight deadline",
        "Describe a situation where you went above and beyond",
        "How do you prioritize tasks when everything feels urgent",
        "Tell me about a project you are most proud of and why",
        "Do you have any questions for us about the company or role",
        "Why are you interested in this company specifically",
        "How do you handle receiving constructive criticism",
        "Describe a time you had to adapt to a major change",
        "What does teamwork mean to you",
        "Tell me about a time you solved a problem creatively",
    ]
    final = hr_core[:min(num_q, len(hr_core))]
    need  = num_q - len(final)
    if need > 0:
        random.shuffle(hr_pool)
        final = final + hr_pool[:need]
    return final[:num_q]


def _generate_technical_questions(role, num_q=8, seed=None, user_id=None, resume_text=None):
    """AI prompt → MongoDB fallback → hardcoded fallback. Weak topics prioritized."""
    if num_q <= 0:
        return []

    seed       = seed or random.randint(1000, 9999)
    preset     = _pick_difficulty(user_id)
    diff       = preset["label"]
    diff_mix   = preset["mix"]
    weak_topics = _get_user_weak_topics(user_id, role)

    weak_line = ""
    if weak_topics:
        weak_str = ", ".join(f"{t} (x{c})" for t, c in list(weak_topics.items())[:4])
        weak_line = (
            "\nThe candidate has previously scored below 4/10 on these topics: "
            f"{weak_str}. Make sure AT LEAST 2 questions directly test these weak "
            "topics so the candidate can improve on them."
        )

    role_lower = role.lower()
    role_key = None
    for key in ROLE_TOPICS:
        if key in role_lower or role_lower in key:
            role_key = key
            break

    coverage_hint = f"- Questions should cover different subtopics within {role}"
    if role_key and _COVERAGE_HINTS.get(role_key):
        coverage_hint = (
            "- Cover a broad spread of subtopics across the questions, including: "
            + _COVERAGE_HINTS[role_key]
        )

    if role_key:
        topic_pool = ROLE_TOPICS[role_key]["technical"]
    else:
        topic_pool = [
            f"Core technical fundamentals specific to {role}",
            f"Tools, frameworks, and technologies used in {role}",
            f"Problem-solving and debugging approaches for {role}",
            f"Best practices and design patterns in {role}",
            f"Performance optimization techniques for {role}",
        ]

    selected_topics = random.sample(topic_pool, min(num_q, len(topic_pool)))

    if resume_text:
        prompt = f"""You are a senior {role} interviewer at a top technology company conducting 
the technical round of an internship interview.

The role: {role}
Candidate Resume: {resume_text[:1500]}
Session Seed: {seed}
Difficulty Distribution: {diff}{weak_line}

IMPORTANT: This is the TECHNICAL round ONLY. Do NOT include ANY HR, behavioral, 
or motivational questions. Every question must test pure technical/domain knowledge.

You MUST generate questions that test SPECIFIC technical knowledge of {role}. 
Each question should require the candidate to demonstrate concrete understanding, 
not vague opinions.

Reference examples of the depth and specificity expected (use these as style guides, 
do NOT copy them verbatim):
{chr(10).join(f"- {t}" for t in selected_topics[:5])}

Generate EXACTLY {num_q} unique technical interview questions in English.

STRICT RULES:
- EVERY question must be purely technical — ZERO HR or behavioral questions
- Questions must test SPECIFIC knowledge related to {role} — not generic opinions
- At least {max(3, num_q // 2)} questions must be directly based on the candidate's resume skills and projects
- Questions must require the candidate to explain HOW or WHY, not just WHAT
- No filler questions — every question must test a concrete technical skill
{coverage_hint}
- Appropriate difficulty for an internship level candidate
- Each question should feel like it belongs in a real {role} technical interview

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""
    else:
        prompt = f"""You are a senior {role} interviewer at a top technology company conducting 
the technical round of an internship interview.

The role: {role}
Session Seed: {seed}
Difficulty Distribution: {diff}{weak_line}

IMPORTANT: This is the TECHNICAL round ONLY. Do NOT include ANY HR, behavioral, 
or motivational questions. Every question must test pure technical/domain knowledge.

You MUST generate questions that test SPECIFIC technical knowledge of {role}. 
Each question should require the candidate to demonstrate concrete understanding, 
not vague opinions.

Reference examples of the depth and specificity expected (use these as style guides, 
do NOT copy them verbatim):
{chr(10).join(f"- {t}" for t in selected_topics[:5])}

Generate EXACTLY {num_q} unique technical interview questions in English.

STRICT RULES:
- EVERY question must be purely technical — ZERO HR or behavioral questions
- Questions must test SPECIFIC knowledge related to {role} — not generic opinions
- Questions must require the candidate to explain HOW or WHY, not just WHAT
- No filler questions — every question must test a concrete technical skill
{coverage_hint}
- Appropriate difficulty for an internship level (fresher / final year student)
- Questions should vary each session based on the seed
- Each question should feel like it belongs in a real {role} technical interview

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""

    seen_by_user = _get_user_seen_questions(user_id)

    result = _parse(_gemini(prompt, temp=0.9, timeout=10, max_tokens=2000))
    ai_questions = []
    if result and isinstance(result, list):
        seen = set()
        for q in result:
            key = q.strip().lower() if isinstance(q, str) else str(q).strip().lower()
            if not key or key in seen or key in seen_by_user:
                continue
            seen.add(key)
            ai_questions.append(q)
        ai_questions = _filter_questions(ai_questions, "technical")

        # Gemini Bonus — AI-generated questions ko DB me save karo
        for q in ai_questions:
            _save_ai_question_to_db(q, role, "technical", diff)

        if len(ai_questions) >= num_q:
            return ai_questions[:num_q]

    # MongoDB Fallback — difficulty-balanced, user ke na-dekhe questions
    fill_needed = num_q - len(ai_questions)
    mongodb_qs = _get_mongodb_technical_questions(
        role, fill_needed, difficulty_mix=diff_mix, seen=seen_by_user,
        prefer_topics=list(weak_topics.keys()),
    )

    if mongodb_qs:
        # Asked count update karo
        for q in mongodb_qs:
            if "_id" in q:
                _update_question_asked_count(q["_id"], "question_bank")
        return (ai_questions + [q["question"] for q in mongodb_qs])[:num_q]

    # Hardcoded Fallback (last resort)
    pool = _TECH_FALLBACK_QUESTIONS(role)
    random.shuffle(pool)
    return (ai_questions + pool)[:num_q]


def generate_questions(role, round_type="technical", resume_text=None, num_q=8, seed=None, user_id=None):
    """Round dispatch — hr / technical / mixed (4 HR core + baaki technical)."""
    if round_type == "hr":
        final = _generate_hr_questions(num_q)
        _record_user_questions(user_id, final)
        return final

    if round_type == "mixed":
        hr_count = min(6, num_q)
        hr_qs    = _generate_hr_questions(hr_count)
        tech_qs  = _generate_technical_questions(
            role, num_q - hr_count, seed=seed, user_id=user_id, resume_text=resume_text
        )
        final = (hr_qs + tech_qs)[:num_q]
        _record_user_questions(user_id, final)
        return final

    final = _generate_technical_questions(
        role, num_q, seed=seed, user_id=user_id, resume_text=resume_text
    )
    _record_user_questions(user_id, final)
    return final


def evaluate_answers_batch(qa_list, role):
    """Saare answers ek hi AI call me evaluate karo — 1 call, 8 evaluations ka JSON array."""
    if not qa_list:
        return []

    # Pehle empty/skipped answers ko local score karo (AI call nahi chahiye)
    evals   = []
    ai_items = []  # (index, question, answer)
    for i, item in enumerate(qa_list):
        question = str(item.get("question", "")).strip()
        answer   = str(item.get("answer", "")).strip()
        if not answer or answer in ["[SKIPPED]"]:
            evals.append({
                "question":    question,
                "score":       0,
                "feedback":    "No answer was provided for this question.",
                "good_points": "—",
                "improve":     "You must attempt to answer every question during an interview.",
                "hint":        "Study this topic thoroughly before your next attempt."
            })
        else:
            ai_items.append((i, question, answer))
            evals.append(None)

    if ai_items:
        parts = []
        for n, (_, q, a) in enumerate(ai_items, 1):
            parts.append(f"Question {n}: {q}\nAnswer {n}: {a[:800]}")
        qa_block = "\n\n".join(parts)

        prompt = f"""You are a strict but fair technical interviewer evaluating an
internship candidate's interview responses.

Role: {role}
Total Questions: {len(ai_items)}

Evaluate EACH question independently. For EVERY question provide:
- score: 0 to 10 (9-10 Excellent, 7-8 Good, 5-6 Average, 3-4 Below Average, 0-2 Poor)
- feedback: 2-3 lines of overall assessment
- good_points: what the candidate got right
- improve: what was missing or incorrect
- hint: what an ideal answer should include

{qa_block}

Return ONLY a valid JSON array with one object per question, in the exact same order:
[
  {{"score": 7, "feedback": "...", "good_points": "...", "improve": "...", "hint": "..."}},
  {{"score": 8, "feedback": "...", "good_points": "...", "improve": "...", "hint": "..."}}
]"""

        result = _parse(_gemini(prompt, temp=0.3, max_tokens=4000, timeout=20))

        if isinstance(result, list) and result:
            # Partial result bhi use karo — jo AI ne diya woh lelo, missing pe TF-IDF
            for n, (idx, q, a) in enumerate(ai_items):
                r         = result[n] if n < len(result) and isinstance(result[n], dict) else None
                relevance = _tfidf(q, a)
                if r:
                    ai_score = float(r.get("score", 5))
                    final    = round(min(10, max(0, ai_score + relevance * 3)), 1)
                    evals[idx] = {
                        "question":    q,
                        "score":       final,
                        "feedback":    str(r.get("feedback", "Answer has been evaluated.")),
                        "good_points": str(r.get("good_points", "You made an attempt — that shows confidence.")),
                        "improve":     str(r.get("improve", "Try to be more specific with technical details and examples.")),
                        "hint":        str(r.get("hint", "Use proper technical terminology and back your answer with examples.")),
                    }
                else:
                    evals[idx] = {
                        "question":    q,
                        "score":       round(min(8, max(3.0, relevance * 10)), 1),
                        "feedback":    "Answer has been evaluated.",
                        "good_points": "You made an attempt — that shows confidence.",
                        "improve":     "Try to be more specific with technical details and examples.",
                        "hint":        "Use proper technical terminology and back your answer with examples.",
                    }
        else:
            # AI fail hua → local TF-IDF scoring (0 extra calls)
            for idx, q, a in ai_items:
                relevance = _tfidf(q, a)
                evals[idx] = {
                    "question":    q,
                    "score":       round(min(8, max(3.0, relevance * 10)), 1),
                    "feedback":    "Answer has been evaluated.",
                    "good_points": "You made an attempt — that shows confidence.",
                    "improve":     "Try to be more specific with technical details and examples.",
                    "hint":        "Use proper technical terminology and back your answer with examples.",
                }

    return evals


# ══════════════════════════════════
# 3. CODING PROBLEM
# ══════════════════════════════════
def _FALLBACK_PROBLEMS(difficulty):
    return [
        {
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
            "function_signature": {
                "python": "def solution(nums, target):",
                "java": "public int[] solution(int[] nums, int target)",
                "cpp": "vector<int> solution(vector<int>& nums, int target)",
                "c": "void solution(int nums[], int n, int target, int result[], int* resultSize)"
            },
            "examples": [{"input": "[2, 7, 11, 15]\n9", "output": "[0,1]", "explanation": "We use a hash map to store each element's index. For 7, we find 2 already in the map at index 0, so we return [0, 1]."}, {"input": "[3, 2, 4]\n6", "output": "[1,2]", "explanation": "We iterate and store each element. When we reach 4, its complement 2 is already in the map at index 1, so we return [1, 2]."}],
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
            "starter_code": {
                "python": "def solution(nums, target):\n    # Write your code here\n    return []",
                "java": "class Solution {\n    public int[] solution(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nvector<int> solution(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}",
                "c": "#include<stdio.h>\nvoid solution(int nums[], int n, int target, int result[], int* resultSize) {\n    // Write your code here\n    *resultSize = 0;\n}"
            },
            "test_cases": [
                {"input": "[1,4,3,6]\n7", "expected": "[1,2]"},
                {"input": "[3,2,4]\n6", "expected": "[1,2]"},
                {"input": "[3,3]\n6", "expected": "[0,1]"}
            ],
            "hints": ["Consider using a HashMap to store elements you have already seen.", "For each element, check if its complement (target - element) exists in the map."],
            "difficulty": difficulty,
            "topic": "arrays"
        },
        {
            "title": "Reverse a String",
            "description": "Write a function that reverses a string. The input string is given as a string s. Return the reversed string.",
            "function_signature": {
                "python": "def solution(s):",
                "java": "public String solution(String s)",
                "cpp": "string solution(string s)",
                "c": "void solution(char s[])"
            },
            "examples": [{"input": "hello", "output": "olleh", "explanation": "We use two pointers from both ends, swapping characters and moving toward the center. 'h' swaps with 'o', 'e' swaps with 'l', producing 'olleh'."}, {"input": "abcdef", "output": "fedcba", "explanation": "We swap characters from both ends: a<->f, b<->e, c<->d. This reverses the entire string to 'fedcba'."}],
            "constraints": ["1 <= s.length <= 10^5", "s[i] is a printable ascii character"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    return \"\"",
                "java": "class Solution {\n    public String solution(String s) {\n        // Write your code here\n        return \"\";\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nstring solution(string s) {\n    // Write your code here\n    return \"\";\n}",
                "c": "#include<stdio.h>\n#include<string.h>\nvoid solution(char s[]) {\n    // Write your code here\n}"
            },
            "test_cases": [
                {"input": "python", "expected": "nohtyp"},
                {"input": "Hannah", "expected": "hannaH"},
                {"input": "a", "expected": "a"}
            ],
            "hints": ["Use two pointers — one at start, one at end.", "Swap characters and move pointers towards center."],
            "difficulty": difficulty,
            "topic": "strings"
        },
        {
            "title": "Valid Parentheses",
            "description": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. A string is valid if open brackets are closed in the correct order and every close bracket has a corresponding open bracket of the same type.",
            "function_signature": {
                "python": "def solution(s):",
                "java": "public boolean solution(String s)",
                "cpp": "bool solution(string s)",
                "c": "int solution(char* s)"
            },
            "examples": [{"input": "()[]{}", "output": "true", "explanation": "We use a stack to track opening brackets. Each closing bracket matches the most recent opening bracket of the same type. All brackets are properly closed in order."}, {"input": "(]", "output": "false", "explanation": "We push '(' onto the stack, then encounter ']' which does not match '(' (round bracket). Since the brackets are mismatched, the string is invalid."}],
            "constraints": ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    return False",
                "java": "class Solution {\n    public boolean solution(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool solution(string s) {\n    // Write your code here\n    return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nint solution(char* s) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "{[()]}", "expected": "true"},
                {"input": "()[]{}", "expected": "true"},
                {"input": "(]", "expected": "false"}
            ],
            "hints": ["Use a stack data structure.", "Push open brackets, pop when matching close bracket is found."],
            "difficulty": difficulty,
            "topic": "strings"
        },
        {
            "title": "Palindrome Check",
            "description": "Given a string s, determine if it is a palindrome, considering only alphanumeric characters and ignoring cases. A palindrome reads the same forwards and backwards.",
            "function_signature": {
                "python": "def solution(s):",
                "java": "public boolean solution(String s)",
                "cpp": "bool solution(string s)",
                "c": "int solution(char* s)"
            },
            "examples": [{"input": "A man, a plan, a canal: Panama", "output": "true", "explanation": "After removing non-alphanumeric characters and ignoring case, it reads 'amanaplanacanalpanama' which is a palindrome."}, {"input": "race a car", "output": "false", "explanation": "After removing non-alphanumeric characters, 'raceacar' is not a palindrome."}],
            "constraints": ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    return False",
                "java": "class Solution {\n    public boolean solution(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool solution(string s) {\n    // Write your code here\n    return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nint solution(char* s) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "Was it a car or a cat I saw", "expected": "true"},
                {"input": "race a car", "expected": "false"},
                {"input": " ", "expected": "true"}
            ],
            "hints": ["Filter out non-alphanumeric characters first.", "Use two pointers from both ends and compare."],
            "difficulty": difficulty,
            "topic": "strings"
        },
        {
            "title": "Find Maximum Subarray",
            "description": "Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum. This is Kadane's Algorithm.",
            "function_signature": {
                "python": "def solution(nums):",
                "java": "public int solution(int[] nums)",
                "cpp": "int solution(vector<int>& nums)",
                "c": "int solution(int* nums, int n)"
            },
            "examples": [{"input": "[-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "Using Kadane's algorithm, we track the current sum. Starting at -2, we reset at each negative prefix. The maximum subarray [4,-1,2,1] has sum 6."}, {"input": "[1]", "output": "1", "explanation": "With a single element, the maximum subarray is the element itself, giving sum 1."}],
            "constraints": ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
            "starter_code": {
                "python": "def solution(nums):\n    # Write your code here\n    return 0",
                "java": "class Solution {\n    public int solution(int[] nums) {\n        // Write your code here\n        return 0;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nint solution(vector<int>& nums) {\n    // Write your code here\n    return 0;\n}",
                "c": "#include<stdio.h>\nint solution(int* nums, int n) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "[5,4,-1,7,8]", "expected": "23"},
                {"input": "[1]", "expected": "1"},
                {"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6"}
            ],
            "hints": ["Keep track of current sum and reset it if it becomes negative.", "Update max sum at each step."],
            "difficulty": difficulty,
            "topic": "arrays"
        },
    ]


def generate_coding_problems(role, difficulty="medium", count=20):
    if count <= 1:
        return [generate_coding_problem(role, difficulty)]

    problems = []
    if coding_problems_col is not None:
        docs = _get_mongodb_coding_problems(difficulty, count)
        if docs:
            problems = docs

    if len(problems) < count:
        fallback = _FALLBACK_PROBLEMS(difficulty)
        if fallback:
            while len(problems) < count:
                for item in random.sample(fallback, len(fallback)):
                    if len(problems) >= count:
                        break
                    problems.append(copy.deepcopy(item))

    if problems:
        seen, unique = set(), []
        for p in problems:
            if not _is_runnable_problem(p):
                continue
            title = (p.get("title") or "").strip()
            if title in seen:
                continue
            seen.add(title)
            unique.append(p)
        if unique:
            return unique[:count]

    return [generate_coding_problem(role, difficulty) for _ in range(count)]


def generate_coding_problem(role, difficulty="medium"):
    topic_map = {
        "frontend":    ["array methods", "string operations", "async/await", "closures"],
        "backend":     ["sorting algorithms", "recursion", "hashing", "graph traversal"],
        "fullstack":   ["arrays", "strings", "object-oriented programming", "recursion"],
        "ml":          ["matrix operations", "statistical calculations", "sorting"],
        "python":      ["list comprehension", "OOP concepts", "recursion", "generators"],
        "datascience": ["data transformation", "statistical calculations", "array operations"],
        "analyst":     ["array manipulation", "string parsing", "sorting algorithms"],
        "uiux":        ["arrays", "strings", "basic logic"],
        "devops":      ["string parsing", "basic algorithms", "data structures"],
    }
    topics = ["arrays", "strings", "recursion"]
    for k, v in topic_map.items():
        if k in role.lower():
            topics = v
            break

    topic = random.choice(topics)
    seed  = random.randint(100, 9999)

    prompt = f"""You are a technical interviewer creating a coding assessment problem.

Role: {role}
Difficulty Level: {difficulty}
Topic: {topic}
Problem Seed: {seed} (ensures uniqueness)

Create a unique coding problem that:
- Can be solved in 15-20 minutes
- Is appropriate for an internship-level candidate
- Has clear problem statement, examples, and test cases
- Seed ensures the problem is different each time

CRITICAL RULES for code and test cases:
- The function name MUST be "solution" in ALL languages (python, java, cpp, c)
- Starter code should define ONLY the function (no main, no driver code). User writes only the function body.
- Test case input: Each parameter on a SEPARATE LINE. Use JSON format for arrays/objects.
  Examples: "[1,2,3]" for array, "hello" for string, "42" for number, "true" for boolean
- Test case expected: The EXACT output the function should return, as a single JSON value.
  Examples: "[0,1]" for array, "true" for boolean, "6" for number
- NEVER use Python-style lists with single quotes in test cases. Always use JSON (double quotes).
- For C: Use simple college-level signatures. For scalar returns (int, bool, char), use: `int solution(int n)`. For array returns, use output parameters: `void solution(int nums[], int n, int target, int result[], int* resultSize)` where result[] is a pre-allocated output buffer and resultSize is set by the function. NEVER use `int*` return type or `malloc` in C.
- For Python: NEVER use `pass` as the function body in starter code. Always include a proper return statement: `return []` for arrays, `return ""` for strings, `return 0` for int, `return False` for bool, `return None` for objects/trees, `pass` only for void/in-place functions.
- CRITICAL: test_cases MUST use DIFFERENT inputs than examples. NEVER copy example inputs into test_cases. The test_cases are hidden and must not overlap with the visible examples.
- CRITICAL: Each explanation in "examples" must be a detailed paragraph explaining the APPROACH, not just restating the output. Format: "We [do X] which gives [result]. Therefore [conclusion]."

MANDATORY FIELDS:
- "examples": MUST contain EXACTLY 2 examples (Example 1 and Example 2). Each example must have "input", "output", and "explanation".
- "test_cases": MUST contain EXACTLY 3 hidden test cases. Each test case must have "input" and "expected". These inputs MUST be completely different from the example inputs.

Return ONLY valid JSON with no extra text:
{{
  "title": "Problem Title",
  "description": "Clear problem description with 2-3 paragraphs. Include: (1) What the function should do, (2) Input/output format with examples, (3) Edge cases and constraints the user should consider. Make it educational like LeetCode.",
  "function_signature": {{
    "python": "def solution(nums, target):",
    "java": "public int[] solution(int[] nums, int target)",
    "cpp": "vector<int> solution(vector<int>& nums, int target)",
    "c": "void solution(int nums[], int n, int target, int result[], int* resultSize)"
  }},
  "examples": [
    {{
      "input": "example input (one param per line)",
      "output": "expected output",
      "explanation": "Detailed step-by-step explanation. Format: 'We [do X] which gives [result]. Therefore [conclusion].' Never use vague one-liners."
    }},
    {{
      "input": "second example input (one param per line)",
      "output": "expected output",
      "explanation": "Detailed step-by-step explanation. Format: 'We [do X] which gives [result]. Therefore [conclusion].' Never use vague one-liners."
    }}
  ],
  "constraints": ["constraint 1", "constraint 2", "constraint 3"],
  "starter_code": {{
    "python": "def solution(nums, target):\\n    # Write your code here\\n    return []",
    "java": "class Solution {{\\n    public int[] solution(int[] nums, int target) {{\\n        // Write your code here\\n        return new int[]{{}};\\n    }}\\n}}",
    "cpp": "#include<bits/stdc++.h>\\nusing namespace std;\\nvector<int> solution(vector<int>& nums, int target) {{\\n    // Write your code here\\n    return {{}};\\n}}",
    "c": "#include<stdio.h>\\nvoid solution(int nums[], int n, int target, int result[], int* resultSize) {{\\n    // Write your code here\\n    *resultSize = 0;\\n}}"
  }},
  "test_cases": [
    {{"input": "param1_value\\nparam2_value", "expected": "expected_output"}},
    {{"input": "param1_value\\nparam2_value", "expected": "expected_output"}},
    {{"input": "param1_value\\nparam2_value", "expected": "expected_output"}}
  ],
  "hints": ["hint 1 to guide without giving away the solution", "hint 2"],
  "difficulty": "{difficulty}",
  "topic": "{topic}"
}}"""

    result = _parse(_gemini(prompt, temp=0.8, max_tokens=2500))

    # Gemini Bonus — AI-generated coding problem ko DB me save karo
    if result:
        _save_ai_coding_to_db(result)
        return result

    # MongoDB Fallback — least attempted problem
    mongodb_problem = _get_mongodb_coding_problem(difficulty)
    if mongodb_problem:
        return mongodb_problem

    # Hardcoded Fallback (last resort)
    return random.choice(_FALLBACK_PROBLEMS(difficulty))


# ══════════════════════════════════
# 4. FINAL PERFORMANCE REPORT
# ══════════════════════════════════
def _readiness_level(percentage):
    if percentage >= 70:
        return "Internship Ready"
    elif percentage >= 55:
        return "Almost Ready"
    elif percentage >= 40:
        return "Needs More Preparation"
    return "Foundation Required"


def _next_steps(percentage, round_type):
    if round_type == "hr":
        return [
            "Practice common HR questions using the STAR method (Situation, Task, Action, Result)",
            "Work on clear, confident and professional communication",
            "Prepare a crisp self-introduction and 2-3 achievement stories",
        ]
    if round_type == "mixed":
        return [
            "Practice HR questions with the STAR method",
            "Revise core technical concepts for your target role",
            "Take one mock interview every week and review your feedback",
        ]
    return [
        "Revise core technical concepts for your target role",
        "Build a small project to strengthen practical skills",
        "Take one technical mock interview every week",
    ]


def _smart_report(role, evaluations, total_score, percentage, round_type="technical"):
    """0 API calls — evaluations se personalized report banao (AI fail hone par fallback)."""
    scored = [e for e in evaluations if e.get("score", 0) > 0]
    scored.sort(key=lambda e: e.get("score", 0), reverse=True)

    top3    = scored[:3]
    bottom2 = scored[-2:] if len(scored) >= 2 else scored

    def _line(e):
        q = str(e.get("question", "")).strip()
        fb = str(e.get("feedback", "")).strip()
        base = f"{e['score']}/10"
        if q:
            return f"{base} — {q[:75]}"
        if fb and fb not in ("—",):
            return f"{base} — {fb[:75]}"
        return f"{base}"

    strengths  = [_line(e) for e in top3]
    weaknesses = [_line(e) for e in bottom2]

    if len(evaluations) == 0:
        mx = 0
    else:
        mx = len(evaluations) * 10

    return {
        "overall_summary": f"You scored {percentage}% ({total_score}/{mx}) across {len(evaluations)} questions in the {role} interview.",
        "strengths":       strengths or ["Attempted the questions — that's a good start!"],
        "weaknesses":      weaknesses or ["Review core concepts before your next attempt"],
        "recommendations": [
            "Revise the low-scoring topics listed above first",
            "Practice explaining concepts with real-world examples",
            "Take one mock interview every week",
        ],
        "readiness_score":    int(percentage),
        "readiness_level":    _readiness_level(percentage),
        "next_steps":         _next_steps(percentage, round_type),
        "motivational_message": "Consistent practice pays off — every attempt brings you closer!",
    }


def generate_report(role, evaluations, total_score, percentage, round_type="technical"):
    summary = "\n".join([
        f"Q{i+1}: Score {e.get('score', 0)}/10 — {str(e.get('feedback', ''))[:60]}"
        for i, e in enumerate(evaluations)
    ])

    prompt = f"""You are an expert career counselor analyzing the performance 
of a final-year student in a mock {round_type} internship interview.

Applied Role: {role}
Round Type: {round_type}
Total Score: {total_score} out of {len(evaluations) * 10} ({percentage}%)

Question-wise Performance Summary:
{summary}

Provide an honest, constructive, and detailed performance analysis in English.
Make sure your advice and recommendations match the {round_type} round — for an HR
round focus on communication, confidence and behavioral answers, not coding bootcamps.
Return ONLY valid JSON with no extra text:
{{
  "overall_summary": "2-3 sentences summarizing the overall performance honestly",
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "Specific strength 3"
  ],
  "weaknesses": [
    "Specific weakness 1",
    "Specific weakness 2"
  ],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "readiness_score": 75,
  "readiness_level": "Internship Ready",
  "next_steps": [
    "Concrete next step 1",
    "Concrete next step 2",
    "Concrete next step 3"
  ],
  "motivational_message": "A short encouraging message for the candidate"
}}"""

    result = _parse(_gemini(prompt, temp=0.5, timeout=10, max_tokens=2500))
    if result:
        # Readiness score/level aur next_steps hamesha ACTUAL performance + round se derive
        # karo — AI ko 8% par "Internship Ready" jaisa inconsistent data dene se rokta hai.
        result["readiness_score"] = int(percentage)
        result["readiness_level"] = _readiness_level(percentage)
        result["next_steps"]      = _next_steps(percentage, round_type)
        return result

    return _smart_report(role, evaluations, total_score, percentage, round_type)