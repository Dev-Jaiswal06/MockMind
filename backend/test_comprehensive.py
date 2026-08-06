import sys, os, time, base64, requests
from dotenv import load_dotenv
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(__file__))
load_dotenv()
from driver_code import (
    _python_driver, _cpp_driver, _java_driver, _c_driver,
    _python_run_driver
)

JUDGE0_URL = "https://ce.judge0.com/submissions"
JUDGE0_HEADERS = {
    "Content-Type": "application/json",
    "X-Subscription-Token": os.getenv("JUDGE0_SUBSCRIPTION_TOKEN", "")
}
results = {}

def safe_decode(val):
    if not val:
        return ""
    try:
        decoded = base64.b64decode(val)
        if all(32 <= b < 127 or b in (9, 10, 13) for b in decoded):
            return decoded.decode("utf-8", errors="replace").strip()
    except:
        pass
    return val.strip()

def run_test(source_code, stdin_data, language_id, expected_output, description):
    submission = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin_data,
        "cpu_time_limit": 10,
        "wall_time_limit": 15,
    }
    try:
        resp = requests.post(JUDGE0_URL, json=submission, headers=JUDGE0_HEADERS, timeout=15)
        resp.raise_for_status()
        token = resp.json()["token"]
    except Exception as e:
        print(f"  FAIL: {description} | Submit error: {e}")
        results[description] = False
        return False

    time.sleep(5)
    for _ in range(30):
        try:
            check = requests.get(f"{JUDGE0_URL}/{token}", headers=JUDGE0_HEADERS, timeout=10)
            check.raise_for_status()
            data = check.json()
            sid = data.get("status", {}).get("id")
            if not sid or sid <= 2:
                time.sleep(2)
                continue
            status_desc = data.get("status", {}).get("description")

            stdout = safe_decode(data.get("stdout") or "")
            compile_output = safe_decode(data.get("compile_output") or "")

            if sid == 3:
                passed = stdout == expected_output
                mark = "PASS" if passed else "FAIL"
                print(f"  {mark}: {description} | got={repr(stdout)} expected={repr(expected_output)}")
                results[description] = passed
                return passed
            else:
                print(f"  FAIL: {description} | {status_desc}")
                if compile_output:
                    print(f"    Compile: {compile_output[:300]}")
                results[description] = False
                return False
        except Exception as e:
            print(f"  FAIL: {description} | {e}")
            results[description] = False
            return False

    print(f"  TIMEOUT: {description}")
    results[description] = False
    return False


# ═══════════════════════════════════════════════════════════════
# PROBLEM 1: Two Sum (int[] + int → int)
# ═══════════════════════════════════════════════════════════════
print("=" * 60)
print("PROBLEM 1: Two Sum (array, int -> int)")
print("=" * 60)

py_twoSum = '''def solution(nums, target):
    d = {}
    for i, n in enumerate(nums):
        if target - n in d:
            return [d[target - n], i]
        d[n] = i
    return []'''

cpp_twoSum = '''vector<int> solution(vector<int> nums, int target) {
    unordered_map<int,int> m;
    for (int i = 0; i < nums.size(); i++) {
        if (m.count(target - nums[i])) return {m[target - nums[i]], i};
        m[nums[i]] = i;
    }
    return {};
}'''

java_twoSum = '''int[] solution(int[] nums, int target) {
    java.util.HashMap<Integer,Integer> m = new java.util.HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        if (m.containsKey(target - nums[i])) return new int[]{m.get(target - nums[i]), i};
        m.put(nums[i], i);
    }
    return new int[]{};
}'''

c_twoSum = '''int* solution(int* nums, int n, int target, int* returnSize) {
    static int result[2];
    *returnSize = 2;
    for (int i = 0; i < n; i++) {
        for (int j = i+1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                result[0] = i; result[1] = j;
                return result;
            }
        }
    }
    result[0] = -1; result[1] = -1;
    return result;
}'''

stdin = "[2,7,11,15]\n9"

# Note: C Two Sum has different signature (int* nums, int n, int target, int* returnSize)
# which doesn't fit our simple stdin model. We'll test C with a simpler version.
c_twoSum_simple = '''int* solution(int* nums, int n, int target) {
    static int result[2];
    for (int i = 0; i < n; i++) {
        for (int j = i+1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                result[0] = i; result[1] = j;
                return result;
            }
        }
    }
    result[0] = -1; result[1] = -1;
    return result;
}'''

stdin_twoSum_c = "[2,7,11,15]\n4\n9"

run_test(_python_driver(py_twoSum, "solution"), stdin, 71, "[0,1]", "TwoSum-Python")
time.sleep(2)
run_test(_cpp_driver(cpp_twoSum, "solution"), stdin, 54, "[0,1]", "TwoSum-C++")
time.sleep(2)
run_test(_java_driver(java_twoSum, "solution"), stdin, 62, "[0,1]", "TwoSum-Java")
time.sleep(2)
run_test(_c_driver(c_twoSum, "solution"), stdin_twoSum_c, 50, "[0,1]", "TwoSum-C")


# ═══════════════════════════════════════════════════════════════
# PROBLEM 2: Palindrome (string -> bool)
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PROBLEM 2: Palindrome (string -> bool)")
print("=" * 60)

py_pal = '''def solution(s):
    cleaned = ''.join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]'''

cpp_pal = '''bool solution(string s) {
    string cleaned;
    for (char c : s) if (isalnum(c)) cleaned += tolower(c);
    string rev(cleaned.rbegin(), cleaned.rend());
    return cleaned == rev;
}'''

java_pal = '''boolean solution(String s) {
    String cleaned = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    return cleaned.equals(new StringBuilder(cleaned).reverse().toString());
}'''

c_pal = '''bool solution(char* s) {
    static char cleaned[10000];
    int j = 0;
    for (int i = 0; s[i]; i++) {
        if ((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= '0' && s[i] <= '9')) {
            if (s[i] >= 'A' && s[i] <= 'Z') cleaned[j++] = s[i] + 32;
            else cleaned[j++] = s[i];
        }
    }
    cleaned[j] = '\\0';
    for (int i = 0; i < j/2; i++) {
        if (cleaned[i] != cleaned[j-1-i]) return false;
    }
    return true;
}'''

run_test(_python_driver(py_pal, "solution"), "A man, a plan, a canal: Panama", 71, "true", "Palindrome-Python")
time.sleep(2)
run_test(_cpp_driver(cpp_pal, "solution"), "A man, a plan, a canal: Panama", 54, "true", "Palindrome-C++")
time.sleep(2)
run_test(_java_driver(java_pal, "solution"), "A man, a plan, a canal: Panama", 62, "true", "Palindrome-Java")
time.sleep(2)
run_test(_c_driver(c_pal, "solution"), "A man, a plan, a canal: Panama", 50, "true", "Palindrome-C")


# ═══════════════════════════════════════════════════════════════
# PROBLEM 3: Merge Sorted Arrays (array -> array)
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PROBLEM 3: Merge Two Sorted Arrays (array, array -> array)")
print("=" * 60)

py_merge = '''def solution(nums1, nums2):
    result = []
    i = j = 0
    while i < len(nums1) and j < len(nums2):
        if nums1[i] <= nums2[j]:
            result.append(nums1[i]); i += 1
        else:
            result.append(nums2[j]); j += 1
    result.extend(nums1[i:])
    result.extend(nums2[j:])
    return result'''

cpp_merge = '''vector<int> solution(vector<int> nums1, vector<int> nums2) {
    vector<int> result;
    int i = 0, j = 0;
    while (i < nums1.size() && j < nums2.size()) {
        if (nums1[i] <= nums2[j]) { result.push_back(nums1[i++]); }
        else { result.push_back(nums2[j++]); }
    }
    while (i < nums1.size()) result.push_back(nums1[i++]);
    while (j < nums2.size()) result.push_back(nums2[j++]);
    return result;
}'''

java_merge = '''ArrayList<Integer> solution(ArrayList<Integer> nums1, ArrayList<Integer> nums2) {
    ArrayList<Integer> result = new ArrayList<>();
    int i = 0, j = 0;
    while (i < nums1.size() && j < nums2.size()) {
        if (nums1.get(i) <= nums2.get(j)) { result.add(nums1.get(i)); i++; }
        else { result.add(nums2.get(j)); j++; }
    }
    while (i < nums1.size()) { result.add(nums1.get(i)); i++; }
    while (j < nums2.size()) { result.add(nums2.get(j)); j++; }
    return result;
}'''

c_merge = '''int* solution(int* nums1, int n1, int* nums2, int n2, int* returnSize) {
    static int result[2000];
    *returnSize = 0;
    int i = 0, j = 0;
    while (i < n1 && j < n2) {
        if (nums1[i] <= nums2[j]) result[(*returnSize)++] = nums1[i++];
        else result[(*returnSize)++] = nums2[j++];
    }
    while (i < n1) result[(*returnSize)++] = nums1[i++];
    while (j < n2) result[(*returnSize)++] = nums2[j++];
    return result;
}'''

stdin_merge = "[1,3,5]\n[2,4,6]"
stdin_merge_c = "[1,3,5]\n3\n[2,4,6]\n3"

run_test(_python_driver(py_merge, "solution"), stdin_merge, 71, "[1,2,3,4,5,6]", "Merge-Python")
time.sleep(2)
run_test(_cpp_driver(cpp_merge, "solution"), stdin_merge, 54, "[1,2,3,4,5,6]", "Merge-C++")
time.sleep(2)
run_test(_java_driver(java_merge, "solution"), stdin_merge, 62, "[1,2,3,4,5,6]", "Merge-Java")
time.sleep(2)
run_test(_c_driver(c_merge, "solution"), stdin_merge_c, 50, "[1,2,3,4,5,6]", "Merge-C")


# ═══════════════════════════════════════════════════════════════
# PROBLEM 4: Factorial (int -> int, no params beyond 1)
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PROBLEM 4: Factorial (int -> int)")
print("=" * 60)

py_fact = '''def solution(n):
    if n <= 1: return 1
    return n * solution(n-1)'''

cpp_fact = '''int solution(int n) {
    long long r = 1;
    for (int i = 2; i <= n; i++) r *= i;
    return (int)r;
}'''

java_fact = '''long solution(int n) {
    long r = 1;
    for (int i = 2; i <= n; i++) r *= i;
    return r;
}'''

c_fact = '''long long solution(int n) {
    long long r = 1;
    for (int i = 2; i <= n; i++) r *= i;
    return r;
}'''

run_test(_python_driver(py_fact, "solution"), "5", 71, "120", "Factorial-Python")
time.sleep(2)
run_test(_cpp_driver(cpp_fact, "solution"), "5", 54, "120", "Factorial-C++")
time.sleep(2)
run_test(_java_driver(java_fact, "solution"), "5", 62, "120", "Factorial-Java")
time.sleep(2)
run_test(_c_driver(c_fact, "solution"), "5", 50, "120", "Factorial-C")


# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("FULL SUMMARY")
print("=" * 60)
for test, passed in results.items():
    print(f"  {'PASS' if passed else 'FAIL'}: {test}")
total = sum(1 for v in results.values() if v)
print(f"\n  Total: {total}/{len(results)} passed")
print("=" * 60)
