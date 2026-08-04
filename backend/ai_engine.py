# backend/ai_engine.py — Gemini / OpenRouter / Grok fallback support
import os, json, random, re
import requests
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
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

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as exc:
        print(f"Gemini initialization failed: {exc}")

PRIMARY = GEMINI_MODEL
FALLBACK = GEMINI_FALLBACK_MODEL


def _call_gemini(prompt, temp=0.7):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model_name = FALLBACK if os.getenv("GEMINI_USE_FALLBACK_MODEL", "false").lower() == "true" else PRIMARY
    m = genai.GenerativeModel(model_name)
    cfg = genai.types.GenerationConfig(temperature=temp, max_output_tokens=1200)
    response = m.generate_content(prompt, generation_config=cfg)
    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text.strip()


def _call_openrouter(prompt, temp=0.7):
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
    }
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("OpenRouter returned an empty response")
    return content.strip()


def _call_grok(prompt, temp=0.7):
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
    }
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("Grok returned an empty response")
    return content.strip()


def _generate_text(prompt, temp=0.7, provider_order=None):
    providers = list(provider_order or DEFAULT_PROVIDER_ORDER)
    last_error = None

    for provider in providers:
        try:
            if provider == "gemini":
                return _call_gemini(prompt, temp=temp)
            if provider == "openrouter":
                return _call_openrouter(prompt, temp=temp)
            if provider == "grok":
                return _call_grok(prompt, temp=temp)
            raise RuntimeError(f"Unsupported provider: {provider}")
        except Exception as exc:
            last_error = exc
            print(f"{provider} failed: {exc}")

    print(f"All AI providers failed. Last error: {last_error}")
    return None


def _gemini(prompt, temp=0.7, fallback=False):
    provider_order = ["gemini", "openrouter", "grok"] if not fallback else ["openrouter", "grok", "gemini"]
    return _generate_text(prompt, temp=temp, provider_order=provider_order)


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
        ],
    },
}


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


def generate_questions(role, round_type="technical", resume_text=None, num_q=8, seed=None):
    seed = seed or random.randint(1000, 9999)
    diff = random.choice([
        "2 easy, 4 medium, 2 hard",
        "1 easy, 3 medium, 4 hard",
        "3 easy, 3 medium, 2 hard"
    ])

    role_lower = role.lower()
    role_key = None
    for key in ROLE_TOPICS:
        if key in role_lower or role_lower in key:
            role_key = key
            break

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

    if round_type == "hr":
        hr_questions = [
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
        selected_hr = random.sample(hr_questions, min(num_q, len(hr_questions)))

        prompt = f"""You are an experienced HR interviewer at a top technology company conducting 
the HR round of an internship interview.

The candidate is interviewing for: {role}
Session Seed: {seed}

Generate EXACTLY {num_q} unique HR and behavioral interview questions in English.

IMPORTANT: This is the HR round ONLY. The candidate will face a separate 
technical round later. Do NOT include ANY technical, coding, or role-specific 
questions here.

Suggested question areas to cover (pick and adapt as needed):
{chr(10).join(f"- {q}" for q in selected_hr)}

STRICT RULES:
- Every single question MUST be behavioral, situational, or motivational
- ZERO technical questions — no coding, no frameworks, no system design, no domain knowledge
- Questions must assess: personality, communication skills, culture fit, motivation, teamwork, leadership
- Questions should be suitable for an internship-level candidate (final year student / fresher)
- No filler questions — every question must have a clear purpose
- Questions should feel natural, not robotic — like a real HR conversation

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""
    else:
        selected_topics = random.sample(topic_pool, min(num_q, len(topic_pool)))

        if resume_text:
            prompt = f"""You are a senior {role} interviewer at a top technology company conducting 
the technical round of an internship interview.

The role: {role}
Candidate Resume: {resume_text[:1500]}
Session Seed: {seed}
Difficulty Distribution: {diff}

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
- Questions should cover different subtopics within {role}
- Appropriate difficulty for an internship level candidate
- Each question should feel like it belongs in a real {role} technical interview

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""
        else:
            prompt = f"""You are a senior {role} interviewer at a top technology company conducting 
the technical round of an internship interview.

The role: {role}
Session Seed: {seed}
Difficulty Distribution: {diff}

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
- Questions should cover different subtopics within {role}
- Appropriate difficulty for an internship level (fresher / final year student)
- Questions should vary each session based on the seed
- Each question should feel like it belongs in a real {role} technical interview

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""

    result = _parse(_gemini(prompt, temp=0.9))
    if result and isinstance(result, list):
        seen = set()
        unique = []
        for q in result:
            key = q.strip().lower() if isinstance(q, str) else str(q).strip().lower()
            if key not in seen:
                seen.add(key)
                unique.append(q)
        unique = _filter_questions(unique, round_type)
        if len(unique) >= num_q:
            return unique[:num_q]
        pool = _FALLBACK_QUESTIONS(role, round_type)
        random.shuffle(pool)
        return (unique + pool)[:num_q]
    pool = _FALLBACK_QUESTIONS(role, round_type)
    random.shuffle(pool)
    return pool[:num_q]


# ══════════════════════════════════
# 2. EVALUATE ANSWER
# ══════════════════════════════════
def evaluate_answer(question, answer, role):
    if not answer or answer.strip() in ["", "[SKIPPED]"]:
        return {
            "score":       0,
            "feedback":    "No answer was provided for this question.",
            "good_points": "—",
            "improve":     "You must attempt to answer every question during an interview.",
            "hint":        "Study this topic thoroughly before your next attempt."
        }

    relevance = _tfidf(question, answer)

    prompt = f"""You are a strict but fair technical interviewer evaluating an 
internship candidate's interview response.

Role: {role}
Interview Question: {question}
Candidate's Answer: {answer}

Scoring Criteria:
- 9-10: Excellent — thorough, accurate, includes examples and depth
- 7-8:  Good — correct understanding but lacks some depth or examples
- 5-6:  Average — partially correct, missing key concepts
- 3-4:  Below Average — mostly vague, incorrect or incomplete
- 0-2:  Poor — irrelevant or completely incorrect answer

Evaluate the answer and provide structured feedback in English.
Return ONLY valid JSON with no extra text:
{{
  "score": 7,
  "feedback": "2-3 lines of overall assessment...",
  "good_points": "What the candidate got right...",
  "improve": "What was missing or incorrect...",
  "hint": "What an ideal answer should include..."
}}"""

    result = _parse(_gemini(prompt, temp=0.3))
    if result:
        ai    = float(result.get("score", 5))
        final = round(min(10, max(0, ai * 0.7 + relevance * 10 * 0.3)), 1)
        result["score"] = final
        return result

    return {
        "score":       round(min(8, relevance * 10), 1),
        "feedback":    "Answer has been evaluated.",
        "good_points": "You made an attempt — that shows confidence.",
        "improve":     "Try to be more specific with technical details and examples.",
        "hint":        "Use proper technical terminology and back your answer with examples."
    }


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
                "c": "int* solution(int* nums, int n, int target, int* returnSize)"
            },
            "examples": [{"input": "[2, 7, 11, 15]\n9", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 2 + 7 = 9, so we return [0, 1]."}],
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
            "starter_code": {
                "python": "def solution(nums, target):\n    # Write your code here\n    pass",
                "javascript": "function solution(nums, target) {\n  // Write your code here\n}",
                "java": "class Solution {\n    public int[] solution(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nvector<int> solution(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}",
                "c": "#include<stdio.h>\nint* solution(int* nums, int n, int target, int* returnSize) {\n    // Write your code here\n    *returnSize = 0;\n    return NULL;\n}"
            },
            "test_cases": [
                {"input": "[2,7,11,15]\n9", "expected": "[0,1]"},
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
                "c": "char* solution(char* s)"
            },
            "examples": [{"input": "hello", "output": "olleh", "explanation": "Reverse the characters in the string."}],
            "constraints": ["1 <= s.length <= 10^5", "s[i] is a printable ascii character"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    pass",
                "javascript": "function solution(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n    public String solution(String s) {\n        // Write your code here\n        return \"\";\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nstring solution(string s) {\n    // Write your code here\n    return \"\";\n}",
                "c": "#include<stdio.h>\n#include<string.h>\nchar* solution(char* s) {\n    // Write your code here\n    return s;\n}"
            },
            "test_cases": [
                {"input": "hello", "expected": "olleh"},
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
            "examples": [{"input": "()[]{}", "output": "true", "explanation": "All brackets are properly closed in order."}],
            "constraints": ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    pass",
                "javascript": "function solution(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n    public boolean solution(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool solution(string s) {\n    // Write your code here\n    return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nint solution(char* s) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "()", "expected": "true"},
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
            "examples": [{"input": "A man, a plan, a canal: Panama", "output": "true", "explanation": "After removing non-alphanumeric characters and ignoring case, it reads 'amanaplanacanalpanama' which is a palindrome."}],
            "constraints": ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters"],
            "starter_code": {
                "python": "def solution(s):\n    # Write your code here\n    pass",
                "javascript": "function solution(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n    public boolean solution(String s) {\n        // Write your code here\n        return false;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool solution(string s) {\n    // Write your code here\n    return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nint solution(char* s) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "A man, a plan, a canal: Panama", "expected": "true"},
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
            "examples": [{"input": "[-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum of 6."}],
            "constraints": ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
            "starter_code": {
                "python": "def solution(nums):\n    # Write your code here\n    pass",
                "javascript": "function solution(nums) {\n  // Write your code here\n}",
                "java": "class Solution {\n    public int solution(int[] nums) {\n        // Write your code here\n        return 0;\n    }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nint solution(vector<int>& nums) {\n    // Write your code here\n    return 0;\n}",
                "c": "#include<stdio.h>\nint solution(int* nums, int n) {\n    // Write your code here\n    return 0;\n}"
            },
            "test_cases": [
                {"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6"},
                {"input": "[1]", "expected": "1"},
                {"input": "[5,4,-1,7,8]", "expected": "23"}
            ],
            "hints": ["Keep track of current sum and reset it if it becomes negative.", "Update max sum at each step."],
            "difficulty": difficulty,
            "topic": "arrays"
        },
    ]


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
- The function name MUST be "solution" in ALL languages (python, java, cpp, c, javascript)
- Starter code should define ONLY the function (no main, no driver code). User writes only the function body.
- Test case input: Each parameter on a SEPARATE LINE. Use JSON format for arrays/objects.
  Examples: "[1,2,3]" for array, "hello" for string, "42" for number, "true" for boolean
- Test case expected: The EXACT output the function should return, as a single JSON value.
  Examples: "[0,1]" for array, "true" for boolean, "6" for number
- NEVER use Python-style lists with single quotes in test cases. Always use JSON (double quotes).
- For C: When returning an array (int*, long*, double*), ALWAYS add "int* returnSize" as the LAST parameter. The driver passes a pointer to an int that the function fills with the array length. Set *returnSize before returning.

Return ONLY valid JSON with no extra text:
{{
  "title": "Problem Title",
  "description": "Clear and detailed problem description in 2-3 paragraphs",
  "function_signature": {{
    "python": "def solution(nums, target):",
    "java": "public int[] solution(int[] nums, int target)",
    "cpp": "vector<int> solution(vector<int>& nums, int target)",
    "c": "int* solution(int* nums, int n, int target, int* returnSize)"
  }},
  "examples": [
    {{
      "input": "example input (one param per line)",
      "output": "expected output",
      "explanation": "step by step explanation"
    }}
  ],
  "constraints": ["constraint 1", "constraint 2", "constraint 3"],
  "starter_code": {{
    "python": "def solution(nums, target):\\n    # Write your code here\\n    pass",
    "java": "class Solution {{\\n    public int[] solution(int[] nums, int target) {{\\n        // Write your code here\\n        return new int[]{{}};\\n    }}\\n}}",
    "cpp": "#include<bits/stdc++.h>\\nusing namespace std;\\nvector<int> solution(vector<int>& nums, int target) {{\\n    // Write your code here\\n    return {{}};\\n}}",
    "c": "#include<stdio.h>\\nint* solution(int* nums, int n, int target, int* returnSize) {{\\n    // Write your code here\\n    *returnSize = 0;\\n    return NULL;\\n}}"
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

    result = _parse(_gemini(prompt, temp=0.8))
    return result or random.choice(_FALLBACK_PROBLEMS(difficulty))


# ══════════════════════════════════
# 4. FINAL PERFORMANCE REPORT
# ══════════════════════════════════
def generate_report(role, evaluations, total_score, percentage):
    summary = "\n".join([
        f"Q{i+1}: Score {e.get('score', 0)}/10 — {str(e.get('feedback', ''))[:60]}"
        for i, e in enumerate(evaluations)
    ])

    prompt = f"""You are an expert career counselor analyzing the performance 
of a final-year student in a mock internship interview.

Applied Role: {role}
Total Score: {total_score} out of {len(evaluations) * 10} ({percentage}%)

Question-wise Performance Summary:
{summary}

Provide an honest, constructive, and detailed performance analysis in English.
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

    result = _parse(_gemini(prompt, temp=0.5))
    if result:
        return result

    return {
        "overall_summary":    "The candidate completed the interview and demonstrated a foundational understanding of the role.",
        "strengths":          ["Completed all questions", "Showed enthusiasm", "Basic knowledge present"],
        "weaknesses":         ["Needs more technical depth", "Examples were lacking in answers"],
        "recommendations":    ["Review core concepts daily", "Build practical projects", "Practice mock interviews regularly"],
        "readiness_score":    int(percentage),
        "readiness_level":    "Almost Ready" if percentage > 60 else "Needs More Preparation",
        "next_steps":         ["Identify and revise weak topics", "Add projects to GitHub", "Apply to internships on Internshala"],
        "motivational_message": "Keep practicing — consistent effort leads to success!"
    }