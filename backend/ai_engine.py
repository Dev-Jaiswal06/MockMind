# backend/ai_engine.py — Google Gemini (All English)
import os, json, random
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PRIMARY  = "gemini-2.0-flash"
FALLBACK = "gemini-1.5-flash-8b"


def _gemini(prompt, temp=0.7, fallback=False):
    model_name = FALLBACK if fallback else PRIMARY
    try:
        m   = genai.GenerativeModel(model_name)
        cfg = genai.types.GenerationConfig(
            temperature=temp, max_output_tokens=1200
        )
        return m.generate_content(prompt, generation_config=cfg).text.strip()
    except Exception as e:
        err = str(e).lower()
        if ("quota" in err or "429" in err) and not fallback:
            print("Quota exceeded — switching to fallback model...")
            return _gemini(prompt, temp, fallback=True)
        print(f"Gemini error: {e}")
        return None


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


# ══════════════════════════════════
# 1. GENERATE QUESTIONS
# ══════════════════════════════════
def generate_questions(role, resume_text=None, num_q=8, seed=None):
    seed = seed or random.randint(1000, 9999)
    diff = random.choice([
        "2 easy, 4 medium, 2 hard",
        "1 easy, 3 medium, 4 hard",
        "3 easy, 3 medium, 2 hard"
    ])
    types = random.sample([
        "conceptual understanding",
        "real-world scenario based",
        "debugging and error analysis",
        "best practices and design",
        "project experience based",
        "technology comparison",
        "behavioral and situational",
        "problem-solving approach"
    ], 4)

    if resume_text:
        prompt = f"""You are a senior technical interviewer at a top technology company 
conducting an internship interview.

Role: {role}
Candidate Resume: {resume_text[:1500]}
Session Seed: {seed}
Difficulty Distribution: {diff}
Question Types to Include: {", ".join(types)}

Generate EXACTLY {num_q} unique interview questions in English.

Rules:
- At least 4 questions must be directly based on the candidate's resume skills and projects
- Questions must be creative, specific, and non-generic
- Mix of technical depth and soft skills
- Appropriate difficulty for an internship level candidate
- Each question should feel like it belongs in a real interview

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""
    else:
        prompt = f"""You are a senior technical interviewer at a top technology company 
conducting an internship interview.

Role: {role}
Session Seed: {seed}
Difficulty Distribution: {diff}
Question Types: {", ".join(types)}

Generate EXACTLY {num_q} unique, creative interview questions in English.

Rules:
- No generic or repetitive questions
- Mix of technical and behavioral questions
- Appropriate for internship level (fresher / final year student)
- Questions should vary each session based on the seed
- Include at least 2 HR/behavioral questions

Return ONLY a valid JSON array with no extra text:
["Question 1?", "Question 2?", ..., "Question {num_q}?"]"""

    result = _parse(_gemini(prompt, temp=0.9))
    if result and isinstance(result, list):
        return result[:num_q]
    return [f"Please describe your experience with {role} — Topic {i+1}" for i in range(num_q)]


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

Return ONLY valid JSON with no extra text:
{{
  "title": "Problem Title",
  "description": "Clear and detailed problem description in 2-3 paragraphs",
  "examples": [
    {{
      "input": "example input",
      "output": "expected output",
      "explanation": "step by step explanation"
    }}
  ],
  "constraints": ["constraint 1", "constraint 2", "constraint 3"],
  "starter_code": {{
    "python": "def solution(...):\\n    # Write your code here\\n    pass",
    "javascript": "function solution(...) {{\\n  // Write your code here\\n}}",
    "java": "class Solution {{\\n  public static void main(String[] args) {{\\n    // Write your code here\\n  }}\\n}}",
    "cpp": "#include<bits/stdc++.h>\\nusing namespace std;\\nint main() {{\\n  // Write your code here\\n  return 0;\\n}}",
    "c": "#include<stdio.h>\\nint main() {{\\n  // Write your code here\\n  return 0;\\n}}"
  }},
  "test_cases": [
    {{"input": "test case 1 input", "expected": "expected output 1"}},
    {{"input": "test case 2 input", "expected": "expected output 2"}},
    {{"input": "test case 3 input", "expected": "expected output 3"}}
  ],
  "hints": ["hint 1 to guide without giving away the solution", "hint 2"],
  "difficulty": "{difficulty}",
  "topic": "{topic}"
}}"""

    result = _parse(_gemini(prompt, temp=0.8))
    return result or {
        "title": "Two Sum",
        "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
        "examples": [
            {
                "input": "[2, 7, 11, 15], target = 9",
                "output": "[0, 1]",
                "explanation": "nums[0] + nums[1] = 2 + 7 = 9, so we return [0, 1]."
            }
        ],
        "constraints": [
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "Only one valid answer exists"
        ],
        "starter_code": {
            "python":     "def two_sum(nums, target):\n    # Write your code here\n    pass",
            "javascript": "function twoSum(nums, target) {\n  // Write your code here\n}",
            "java":       "class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    // Write your code here\n    return new int[]{};\n  }\n}",
            "cpp":        "#include<bits/stdc++.h>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n  // Write your code here\n  return {};\n}",
            "c":          "#include<stdio.h>\nint* twoSum(int* nums, int n, int target) {\n  // Write your code here\n  return NULL;\n}"
        },
        "test_cases": [
            {"input": "[2,7,11,15]\n9", "expected": "[0, 1]"},
            {"input": "[3,2,4]\n6",     "expected": "[1, 2]"},
            {"input": "[3,3]\n6",       "expected": "[0, 1]"}
        ],
        "hints": [
            "Consider using a HashMap to store elements you have already seen.",
            "For each element, check if its complement (target - element) exists in the map."
        ],
        "difficulty": difficulty,
        "topic":      "arrays"
    }


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