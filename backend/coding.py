# backend/coding.py — Coding judge with full debug logging
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import coding_col, update_user_stats
from ai_engine import generate_coding_problem
from code_runner import run_with_piston
from driver_code import wrap_with_driver, normalize_output
from datetime import datetime

logger = logging.getLogger("coding")

coding_bp = Blueprint("coding", __name__)


@coding_bp.route("/api/coding/health", methods=["GET"])
def health_check():
    """Quick check if Judge0 engine is reachable."""
    from code_runner import run_with_piston
    result = run_with_piston("print(42)", "python", "")
    return jsonify({
        "engine":        "Judge0",
        "engine_status": result.get("status"),
        "engine_stdout": result.get("stdout", "").strip(),
        "message":       "Judge0 OK" if result.get("status") == "Success" else "Judge0 ERROR: " + (result.get("stderr") or result.get("status", "unknown")),
    })


@coding_bp.route("/api/coding/problem", methods=["GET"])
@jwt_required()
def get_problem():
    diff = request.args.get("difficulty", "medium")
    return jsonify({"problem": generate_coding_problem(diff)})


@coding_bp.route("/api/coding/run-cases", methods=["POST"])
@jwt_required()
def run_cases():
    logger.info("=== /api/coding/run-cases ===")
    try:
        d    = request.get_json(force=True)
        code = d.get("code", "")
        lang = d.get("language", "python")
        tcs  = d.get("test_cases", [])

        logger.info(f"Lang: {lang}, Code ({len(code)} chars): {repr(code[:200])}")
        logger.info(f"Test cases: {len(tcs)}")

        if not code.strip():
            logger.warning("Empty code!")
            return jsonify({
                "results": [], "passed": 0, "total": 0,
                "all_passed": False,
                "error": "No code provided.",
            })

        if not tcs:
            logger.warning("No test cases provided!")
            return jsonify({
                "results": [], "passed": 0, "total": 0,
                "all_passed": False,
                "error": "No test cases to run.",
            })

        results, passed = [], 0
        compile_error = None

        for i, tc in enumerate(tcs):
            logger.info(f"\n--- Run Test Case {i+1}/{len(tcs)} ---")

            if compile_error:
                results.append({
                    "test_case": i + 1, "input": tc.get("input", ""),
                    "expected": tc.get("expected", "").strip(), "got": "",
                    "passed": False, "status": "Compilation Error",
                    "error_message": compile_error,
                })
                continue

            raw_input    = tc.get("input", "")
            expected_raw = tc.get("expected", "")

            logger.info(f"Input:    {repr(raw_input[:200])}")
            logger.info(f"Expected: {repr(expected_raw[:200])}")

            complete_code = wrap_with_driver(code, lang, raw_input)
            logger.info(f"Wrapped code ({len(complete_code)} chars): {repr(complete_code[:300])}")

            r = run_with_piston(complete_code, lang, raw_input)

            stdout_raw          = r.get("stdout", "")
            got_normalized      = normalize_output(stdout_raw)
            expected_normalized = normalize_output(expected_raw)

            logger.info(f"Result: status={r.get('status')}, exit={r.get('exit_code')}")
            logger.info(f"stdout raw:    {repr(stdout_raw[:200])}")
            logger.info(f"got normalized:{repr(got_normalized[:200])}")
            logger.info(f"expected norm: {repr(expected_normalized[:200])}")

            if r.get("status") == "Compilation Error":
                compile_error = r.get("stderr", "") or r.get("compile_stderr", "Compilation error")
                logger.info(f"COMPILATION ERROR: {compile_error[:200]}")
                results.append({
                    "test_case": i + 1, "input": raw_input,
                    "expected": expected_normalized, "got": got_normalized,
                    "passed": False, "status": "Compilation Error",
                    "error_message": compile_error,
                })
                continue

            if r.get("status") == "Error":
                error_msg = r.get("stderr", "") or "Execution engine error"
                logger.info(f"ENGINE ERROR: {error_msg[:200]}")
                results.append({
                    "test_case": i + 1, "input": raw_input,
                    "expected": expected_normalized, "got": got_normalized,
                    "passed": False, "status": "Runtime Error",
                    "error_message": error_msg,
                })
                continue

            if r.get("status") == "Time Limit Exceeded":
                tc_status = "Time Limit Exceeded"
                error_msg = r.get("stderr", "")
            elif r.get("exit_code", 0) != 0:
                tc_status = "Runtime Error"
                error_msg = r.get("stderr", "") or r.get("run_stderr", "")
            elif expected_normalized and got_normalized == expected_normalized:
                tc_status = "Passed"
                error_msg = ""
            elif expected_normalized and got_normalized != expected_normalized:
                tc_status = "Wrong Answer"
                error_msg = ""
            else:
                if got_normalized:
                    tc_status = "Passed"
                    error_msg = ""
                else:
                    tc_status = "No Output"
                    error_msg = "Function did not produce any output."

            ok = (got_normalized == expected_normalized) and bool(expected_normalized)
            if ok:
                passed += 1

            logger.info(f"→ {tc_status}" + (" ✓" if ok else " ✗"))

            results.append({
                "test_case": i + 1, "input": raw_input,
                "expected": expected_normalized, "got": got_normalized,
                "passed": ok, "status": tc_status, "error_message": error_msg,
            })

        logger.info(f"\n=== RUN RESULT: {passed}/{len(tcs)} passed ===")
        return jsonify({
            "results":    results,
            "passed":     passed,
            "total":      len(tcs),
            "all_passed": passed == len(tcs),
        })

    except Exception as e:
        logger.error(f"run_cases FAILED: {e}", exc_info=True)
        return jsonify({
            "results": [],
            "passed":  0,
            "total":   0,
            "all_passed": False,
            "error":   f"Server error during execution: {str(e)}",
        }), 500


@coding_bp.route("/api/coding/submit", methods=["POST"])
@jwt_required()
def submit_code():
    uid   = get_jwt_identity()
    d     = request.get_json()
    code  = d.get("code", "")
    lang  = d.get("language", "python")
    tcs   = d.get("test_cases", [])
    title = d.get("problem_title", "")

    logger.info(f"=== /api/coding/submit ===")
    logger.info(f"User: {uid}, Problem: {title}, Lang: {lang}")
    logger.info(f"Test cases: {len(tcs)}")
    logger.info(f"Code ({len(code)} chars): {repr(code[:300])}")

    if not code.strip():
        logger.warning("Empty code submitted!")
        return jsonify({
            "results": [], "passed": 0, "total": 0,
            "score": 0, "all_passed": False,
            "overall_status": "Error — No code provided",
        })

    if not tcs:
        logger.warning("No test cases provided!")
        return jsonify({
            "results": [], "passed": 0, "total": 0,
            "score": 0, "all_passed": False,
            "overall_status": "Error — No test cases",
        })

    results, passed = [], 0
    compile_error = None

    for i, tc in enumerate(tcs):
        logger.info(f"\n--- Test Case {i+1}/{len(tcs)} ---")

        if compile_error:
            logger.info("Skipping (compile error from earlier)")
            results.append({
                "test_case":     i + 1,
                "input":         tc.get("input", ""),
                "expected":      tc.get("expected", "").strip(),
                "got":           "",
                "passed":        False,
                "status":        "Compilation Error",
                "error_message": compile_error,
            })
            continue

        raw_input    = tc.get("input", "")
        expected_raw = tc.get("expected", "")

        logger.info(f"Input:    {repr(raw_input[:200])}")
        logger.info(f"Expected: {repr(expected_raw[:200])}")

        complete_code = wrap_with_driver(code, lang, raw_input)
        logger.info(f"Wrapped code ({len(complete_code)} chars)")

        r = run_with_piston(complete_code, lang, raw_input)

        stdout_raw         = r.get("stdout", "")
        got_normalized     = normalize_output(stdout_raw)
        expected_normalized = normalize_output(expected_raw)

        logger.info(f"Result: status={r.get('status')}, exit={r.get('exit_code')}")
        logger.info(f"stdout raw:    {repr(stdout_raw[:200])}")
        logger.info(f"got normalized:{repr(got_normalized[:200])}")
        logger.info(f"expected norm: {repr(expected_normalized[:200])}")

        # ── Check compile error ──
        if r.get("status") == "Compilation Error":
            compile_error = r.get("stderr", "") or r.get("compile_stderr", "Compilation error")
            logger.info(f"COMPILATION ERROR: {compile_error[:200]}")
            results.append({
                "test_case":     i + 1,
                "input":         raw_input,
                "expected":      expected_normalized,
                "got":           got_normalized,
                "passed":        False,
                "status":        "Compilation Error",
                "error_message": compile_error,
            })
            continue

        # ── Check for engine error ──
        if r.get("status") == "Error":
            error_msg = r.get("stderr", "") or "Execution engine error"
            logger.info(f"ENGINE ERROR: {error_msg[:200]}")
            results.append({
                "test_case":     i + 1,
                "input":         raw_input,
                "expected":      expected_normalized,
                "got":           got_normalized,
                "passed":        False,
                "status":        "Runtime Error",
                "error_message": error_msg,
            })
            continue

        # ── Determine per-test-case status ──
        if r.get("status") == "Time Limit Exceeded":
            tc_status = "Time Limit Exceeded"
            error_msg = r.get("stderr", "")
        elif r.get("exit_code", 0) != 0:
            tc_status = "Runtime Error"
            error_msg = r.get("stderr", "") or r.get("run_stderr", "")
        elif expected_normalized and got_normalized == expected_normalized:
            tc_status = "Passed"
            error_msg = ""
        elif expected_normalized and got_normalized != expected_normalized:
            tc_status = "Wrong Answer"
            error_msg = ""
        else:
            if got_normalized:
                tc_status = "Passed"
                error_msg = ""
            else:
                tc_status = "No Output"
                error_msg = "Function did not produce any output."

        ok = (got_normalized == expected_normalized) and bool(expected_normalized)
        if ok:
            passed += 1

        logger.info(f"→ {tc_status}" + (" ✓" if ok else " ✗"))

        results.append({
            "test_case":     i + 1,
            "input":         raw_input,
            "expected":      expected_normalized,
            "got":           got_normalized,
            "passed":        ok,
            "status":        tc_status,
            "error_message": error_msg,
        })

    score = round((passed / len(tcs) * 100), 1) if tcs else 0

    if compile_error:
        overall_status = "Compilation Error"
    elif all(r["status"] == "Passed" for r in results):
        overall_status = "Passed"
    elif any(r["status"] == "Runtime Error" for r in results):
        overall_status = "Runtime Error"
    elif any(r["status"] == "Time Limit Exceeded" for r in results):
        overall_status = "Time Limit Exceeded"
    else:
        overall_status = "Wrong Answer"

    logger.info(f"\n=== SUBMIT RESULT: {overall_status}, {score}%, {passed}/{len(tcs)} ===")

    coding_col.insert_one({
        "user_id":       uid,
        "problem_title": title,
        "language":      lang,
        "code_submitted": code,
        "test_passed":   passed,
        "test_total":    len(tcs),
        "score":         score,
        "status":        "passed" if passed == len(tcs) else "partial",
        "created_at":    datetime.utcnow().isoformat(),
    })
    update_user_stats(uid)
    return jsonify({
        "results":        results,
        "passed":         passed,
        "total":          len(tcs),
        "score":          score,
        "all_passed":     passed == len(tcs),
        "overall_status": overall_status,
    })
