# backend/code_runner.py — Piston API (FREE!)
import requests

PISTON = "https://emkc.org/api/v2/piston/execute"

LANGS = {
    "python":     {"language":"python",     "version":"3.10.0"},
    "javascript": {"language":"javascript", "version":"18.15.0"},
    "java":       {"language":"java",       "version":"15.0.2"},
    "cpp":        {"language":"c++",        "version":"10.2.0"},
    "c":          {"language":"c",          "version":"10.2.0"},
}


def run_with_piston(code, language, stdin=""):
    lang = LANGS.get(language.lower(), LANGS["python"])
    try:
        res  = requests.post(PISTON, json={
            "language": lang["language"],
            "version":  lang["version"],
            "files":    [{"name":"main","content":code}],
            "stdin":    stdin, "args":[],
            "compile_timeout":10000, "run_timeout":5000
        }, timeout=15)
        data   = res.json()
        run    = data.get("run",{})
        stdout = run.get("stdout","")
        stderr = run.get("stderr","") or data.get("compile",{}).get("stderr","")
        return {
            "stdout":    stdout,
            "stderr":    stderr,
            "exit_code": run.get("code",0),
            "status":    "Success" if run.get("code",0)==0 else "Error"
        }
    except requests.Timeout:
        return {"stdout":"","stderr":"Timeout!","exit_code":1,"status":"Timeout"}
    except Exception as e:
        return {"stdout":"","stderr":str(e),"exit_code":1,"status":"Error"}