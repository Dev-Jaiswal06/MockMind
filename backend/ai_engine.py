# backend/ai_engine.py — Google Gemini (All English)
import os, json, random
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PRIMARY  = "gemini-2.0-flash"
FALLBACK = "gemini-1.5-flash"


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
def _FALLBACK_QUESTIONS(role):
    tech = [
        f"What is your experience with core {role} technologies and which do you enjoy most?",
        f"Explain a challenging {role} project you worked on and how you solved technical problems.",
        f"How do you stay updated with the latest trends in {role}?",
        f"Describe your approach to debugging a complex issue in a {role} application.",
        f"What testing strategies do you follow when building {role} applications?",
        f"Explain the difference between REST and GraphQL from a {role} perspective.",
        f"How do you handle state management in your {role} projects?",
        f"What database design considerations are important in {role} development?",
        f"Describe a time you optimized the performance of a {role} application.",
        f"How do you ensure code quality and maintainability in your {role} projects?",
        f"What version control strategies do you use in team-based {role} development?",
        f"Explain how you would design a scalable {role} architecture from scratch.",
        f"What security practices do you follow when building {role} applications?",
        f"How do you handle error handling and logging in {role} applications?",
        f"Describe your experience with CI/CD pipelines in {role} development.",
        f"What is your approach to API design in {role} projects?",
        f"How do you manage technical debt in long-running {role} projects?",
        f"Explain the concept of microservices and when you'd use them in {role}.",
        f"What tools and frameworks do you prefer for {role} development and why?",
        f"How do you approach writing documentation for {role} projects?",
    ]
    behav = [
        "Tell me about a time you had a conflict with a teammate and how you resolved it.",
        "Describe a situation where you had to meet a tight deadline. How did you handle it?",
        "Tell me about a project you are most proud of and your contribution to it.",
        "How do you handle constructive criticism from peers or managers?",
        "Describe a time you made a mistake in a project and how you fixed it.",
        "Tell me about a time you went above and beyond what was expected of you.",
        "How do you prioritize tasks when working on multiple projects?",
        "Describe a situation where you had to learn a new technology quickly.",
        "Tell me about a time you mentored or helped a teammate grow.",
        "Where do you see yourself in your career five years from now?",
        "Why are you interested in this role and what makes you a good fit?",
        "Describe a time you had to make a decision with incomplete information.",
        "How do you handle working under pressure or in high-stress situations?",
        "Tell me about a time you received difficult feedback and how you responded.",
        "What is your approach to collaborating with non-technical stakeholders?",
    ]
    pool = tech + behav
    random.shuffle(pool)
    return pool


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
        seen = set()
        unique = []
        for q in result:
            key = q.strip().lower() if isinstance(q, str) else str(q).strip().lower()
            if key not in seen:
                seen.add(key)
                unique.append(q)
        if len(unique) >= num_q:
            return unique[:num_q]
        pool = _FALLBACK_QUESTIONS(role)
        random.shuffle(pool)
        return (unique + pool)[:num_q]
    pool = _FALLBACK_QUESTIONS(role)
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
            "examples": [{"input": "[2, 7, 11, 15], target = 9", "output": "[0, 1]", "explanation": "nums[0] + nums[1] = 2 + 7 = 9, so we return [0, 1]."}],
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
            "starter_code": {
                "python": "def two_sum(nums, target):\n    # Write your code here\n    pass",
                "javascript": "function twoSum(nums, target) {\n  // Write your code here\n}",
                "java": "class Solution {\n  public int[] twoSum(int[] nums, int target) {\n    // Write your code here\n    return new int[]{};\n  }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n  // Write your code here\n  return {};\n}",
                "c": "#include<stdio.h>\nint* twoSum(int* nums, int n, int target) {\n  // Write your code here\n  return NULL;\n}"
            },
            "test_cases": [
                {"input": "[2,7,11,15]\n9", "expected": "[0, 1]"},
                {"input": "[3,2,4]\n6", "expected": "[1, 2]"},
                {"input": "[3,3]\n6", "expected": "[0, 1]"}
            ],
            "hints": ["Consider using a HashMap to store elements you have already seen.", "For each element, check if its complement (target - element) exists in the map."],
            "difficulty": difficulty,
            "topic": "arrays"
        },
        {
            "title": "Reverse a String",
            "description": "Write a function that reverses a string. The input string is given as an array of characters s. Do not allocate extra space for another array; you must do this by modifying the input array in-place with O(1) extra memory.",
            "examples": [{"input": "['h','e','l','l','o']", "output": "['o','l','l','e','h']", "explanation": "Reverse the character array in place."}],
            "constraints": ["1 <= s.length <= 10^5", "s[i] is a printable ascii character"],
            "starter_code": {
                "python": "def reverse_string(s):\n    # Write your code here\n    pass",
                "javascript": "function reverseString(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n  public void reverseString(char[] s) {\n    // Write your code here\n  }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nvoid reverseString(vector<char>& s) {\n  // Write your code here\n}",
                "c": "#include<stdio.h>\nvoid reverseString(char* s, int n) {\n  // Write your code here\n}"
            },
            "test_cases": [
                {"input": "['h','e','l','l','o']", "expected": "['o','l','l','e','h']"},
                {"input": "['H','a','n','n','a','h']", "expected": "['h','a','n','n','a','H']"},
                {"input": "['a']", "expected": "['a']"}
            ],
            "hints": ["Use two pointers — one at start, one at end.", "Swap characters and move pointers towards center."],
            "difficulty": difficulty,
            "topic": "strings"
        },
        {
            "title": "Valid Parentheses",
            "description": "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. A string is valid if open brackets are closed in the correct order and every close bracket has a corresponding open bracket of the same type.",
            "examples": [{"input": "'()[]{}'", "output": "true", "explanation": "All brackets are properly closed in order."}],
            "constraints": ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'"],
            "starter_code": {
                "python": "def is_valid(s):\n    # Write your code here\n    pass",
                "javascript": "function isValid(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n  public boolean isValid(String s) {\n    // Write your code here\n    return false;\n  }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool isValid(string s) {\n  // Write your code here\n  return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nbool isValid(char* s) {\n  // Write your code here\n  return false;\n}"
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
            "examples": [{"input": "'A man, a plan, a canal: Panama'", "output": "true", "explanation": "After removing non-alphanumeric characters and ignoring case, it reads 'amanaplanacanalpanama' which is a palindrome."}],
            "constraints": ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters"],
            "starter_code": {
                "python": "def is_palindrome(s):\n    # Write your code here\n    pass",
                "javascript": "function isPalindrome(s) {\n  // Write your code here\n}",
                "java": "class Solution {\n  public boolean isPalindrome(String s) {\n    // Write your code here\n    return false;\n  }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nbool isPalindrome(string s) {\n  // Write your code here\n  return false;\n}",
                "c": "#include<stdio.h>\n#include<stdbool.h>\nbool isPalindrome(char* s) {\n  // Write your code here\n  return false;\n}"
            },
            "test_cases": [
                {"input": "'A man, a plan, a canal: Panama'", "expected": "true"},
                {"input": "'race a car'", "expected": "false"},
                {"input": "' '", "expected": "true"}
            ],
            "hints": ["Filter out non-alphanumeric characters first.", "Use two pointers from both ends and compare."],
            "difficulty": difficulty,
            "topic": "strings"
        },
        {
            "title": "Find Maximum Subarray",
            "description": "Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum. This is Kadane's Algorithm.",
            "examples": [{"input": "[-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum of 6."}],
            "constraints": ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
            "starter_code": {
                "python": "def max_subarray(nums):\n    # Write your code here\n    pass",
                "javascript": "function maxSubArray(nums) {\n  // Write your code here\n}",
                "java": "class Solution {\n  public int maxSubArray(int[] nums) {\n    // Write your code here\n    return 0;\n  }\n}",
                "cpp": "#include<bits/stdc++.h>\nusing namespace std;\nint maxSubArray(vector<int>& nums) {\n  // Write your code here\n  return 0;\n}",
                "c": "#include<stdio.h>\nint maxSubArray(int* nums, int n) {\n  // Write your code here\n  return 0;\n}"
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