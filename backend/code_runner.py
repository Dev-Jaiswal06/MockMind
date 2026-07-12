# backend/code_runner.py — Judge0 CE API executor with full validation
import requests
import logging
import base64

logger = logging.getLogger("code_runner")

JUDGE0_BASE = "https://ce.judge0.com"
JUDGE0_SUBMIT = f"{JUDGE0_BASE}/submissions"

# Judge0 language IDs (latest GCC/versions)
LANGS = {
    "python":     {"id": 92,  "name": "Python 3.11.2"},
    "javascript": {"id": 93,  "name": "Node.js 18.15.0"},
    "java":       {"id": 62,  "name": "Java OpenJDK 13.0.1"},
    "cpp":        {"id": 54,  "name": "C++ GCC 9.4.0"},
    "c":          {"id": 50,  "name": "C GCC 9.2.0"},
}

# Judge0 status.id values
STATUS_ACCEPTED      = 3
STATUS_WRONG_ANSWER  = 4
STATUS_TLE           = 5
STATUS_COMPILE_ERR   = 6
STATUS_RUNTIME_ERR   = 11


def run_with_piston(code, language, stdin=""):
    lang = LANGS.get(language.lower(), LANGS["python"])

    logger.info(f"=== JUDGE0 REQUEST ===")
    logger.info(f"Language: {lang['name']} (id={lang['id']})")
    logger.info(f"Code ({len(code)} chars):\n{code[:800]}")
    logger.info(f"Stdin ({len(stdin)} chars): {repr(stdin[:300])}")

    try:
        # Use base64 encoding to avoid UTF-8 issues
        code_b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
        stdin_b64 = base64.b64encode((stdin or "").encode("utf-8")).decode("ascii")

        payload = {
            "source_code":  code_b64,
            "language_id":  lang["id"],
            "stdin":        stdin_b64,
        }

        logger.info(f"POST {JUDGE0_SUBMIT}")
        res = requests.post(
            JUDGE0_SUBMIT,
            params={"base64_encoded": "true", "wait": "true"},
            json=payload,
            timeout=30,
        )
        logger.info(f"HTTP {res.status_code}")

        try:
            data = res.json()
        except Exception:
            logger.error(f"Judge0 non-JSON response: {res.text[:500]}")
            return _error_result(f"Judge0 returned non-JSON (HTTP {res.status_code})")

        logger.info(f"Full response: {str(data)[:1500]}")

        # ── Validate response structure ──
        if "status" not in data or data["status"] is None:
            logger.error(f"Judge0 response MISSING status! Response: {data}")
            err_msg = data.get("message", data.get("error", ""))
            if err_msg:
                return _error_result(f"Judge0 error: {err_msg}")
            return _error_result(
                f"Judge0 returned unexpected response (missing status). "
                f"Response keys: {list(data.keys())}"
            )

        status_id   = data["status"].get("id", 0)
        status_desc = data["status"].get("description", "Unknown")

        stdout         = _decode_b64(data.get("stdout"))
        stderr         = _decode_b64(data.get("stderr"))
        compile_output = _decode_b64(data.get("compile_output"))

        logger.info(f"--- PARSED RESULT ---")
        logger.info(f"status.id={status_id}, status.description={status_desc}")
        logger.info(f"compile_output={repr(compile_output[:300])}")
        logger.info(f"stderr={repr(stderr[:300])}")
        logger.info(f"stdout={repr(stdout[:300])}")

        # ── Map Judge0 status to our internal status ──
        if status_id == STATUS_COMPILE_ERR:
            # Compilation error (C, C++, Java)
            error_msg = compile_output or stderr or status_desc
            logger.info(f"-> STATUS: Compilation Error")
            return {
                "stdout":         stdout,
                "stderr":         error_msg,
                "exit_code":      1,
                "status":         "Compilation Error",
                "compile_stderr": compile_output,
                "run_stderr":     stderr,
                "compile_code":   status_id,
            }

        elif status_id == STATUS_RUNTIME_ERR:
            # Runtime error (NZEC) — for Python, this also covers syntax errors
            error_msg = stderr or compile_output or status_desc
            logger.info(f"-> STATUS: Runtime Error")
            return {
                "stdout":         stdout,
                "stderr":         error_msg,
                "exit_code":      1,
                "status":         "Runtime Error",
                "compile_stderr": compile_output,
                "run_stderr":     stderr,
                "compile_code":   0,
            }

        elif status_id == STATUS_TLE:
            logger.info(f"-> STATUS: Time Limit Exceeded")
            return {
                "stdout":         "",
                "stderr":         "Time Limit Exceeded",
                "exit_code":      -1,
                "status":         "Time Limit Exceeded",
                "compile_stderr": "",
                "run_stderr":     "",
                "compile_code":   0,
            }

        elif status_id == STATUS_ACCEPTED:
            logger.info(f"-> STATUS: Success")
            return {
                "stdout":         stdout,
                "stderr":         "",
                "exit_code":      0,
                "status":         "Success",
                "compile_stderr": "",
                "run_stderr":     stderr,
                "compile_code":   0,
            }

        else:
            # Other statuses (Internal Error, etc.)
            error_msg = stderr or compile_output or status_desc
            logger.info(f"-> STATUS: Error (Judge0 status {status_id}: {status_desc})")
            return {
                "stdout":         stdout,
                "stderr":         error_msg,
                "exit_code":      1,
                "status":         "Error",
                "compile_stderr": compile_output,
                "run_stderr":     stderr,
                "compile_code":   0,
            }

    except requests.Timeout:
        logger.error("Judge0 TIMEOUT (30s)")
        return _error_result("Time Limit Exceeded — Execution timed out after 30 seconds.")
    except requests.ConnectionError as e:
        logger.error(f"Judge0 CONNECTION ERROR: {e}")
        return _error_result(f"Cannot connect to Judge0 API: {e}")
    except Exception as e:
        logger.error(f"Judge0 EXCEPTION: {e}", exc_info=True)
        return _error_result(str(e))


def _error_result(msg):
    """Standard error response."""
    return {
        "stdout":         "",
        "stderr":         msg,
        "exit_code":      1,
        "status":         "Error",
        "compile_stderr": "",
        "run_stderr":     msg,
        "compile_code":   0,
    }


def _decode_b64(val):
    """Decode a base64 value from Judge0, or return empty string."""
    if not val:
        return ""
    try:
        return base64.b64decode(val).decode("utf-8", errors="replace")
    except Exception:
        return str(val)
