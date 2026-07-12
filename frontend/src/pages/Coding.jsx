// frontend/src/pages/Coding.jsx
import { useState, useEffect, useRef, useCallback } from "react"
import Editor                  from "@monaco-editor/react"
import API                     from "../utils/api"
import toast                   from "react-hot-toast"

// ── Languages supported ──
const LANGUAGES = [
  { id: "python",     label: "Python",     icon: "🐍" },
  { id: "java",       label: "Java",       icon: "☕" },
  { id: "cpp",        label: "C++",        icon: "⚡" },
  { id: "c",          label: "C",          icon: "🔵" },
]

const DIFFICULTIES = [
  { id: "easy",   label: "Easy",   color: "#10b981" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "hard",   label: "Hard",   color: "#ef4444" },
]

const ROLES = [
  "Frontend Developer", "Backend Developer",
  "Full Stack Developer", "Machine Learning",
  "Data Science", "Python Developer",
]

const STATUS_STYLES = {
  "Passed":              { bg: "rgba(16,185,129,.12)",  border: "#10b981",  color: "#10b981"  },
  "Success":             { bg: "rgba(16,185,129,.12)",  border: "#10b981",  color: "#10b981"  },
  "Compilation Error":   { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
  "Runtime Error":       { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
  "Wrong Answer":        { bg: "rgba(245,158,11,.12)",  border: "#f59e0b",  color: "#f59e0b"  },
  "Time Limit Exceeded": { bg: "rgba(168,85,247,.12)",  border: "#a855f7",  color: "#a855f7"  },
  "Error":               { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
}

function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES["Error"]
}

export default function Coding() {
  // ── State ──
  const [problem,    setProblem]    = useState(null)
  const [code,       setCode]       = useState("")
  const [language,   setLanguage]   = useState("python")
  const [difficulty, setDifficulty] = useState("medium")
  const [role,       setRole]       = useState("Full Stack Developer")
  const [output,     setOutput]     = useState(null)
  const [results,    setResults]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [running,    setRunning]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab,  setActiveTab]  = useState("problem")
  const fetched = useRef(false)

  // ── Fetch new problem ──
  const fetchProblem = useCallback(async () => {
    setLoading(true)
    setResults(null)
    setOutput(null)
    try {
      const res = await API.get("/api/coding/problem", {
        params: { role, difficulty }
      })
      const p = res.data.problem
      setProblem(p)
      setCode(p.starter_code?.[language] || "# Write your code here\n")
      toast.success("New problem loaded!")
    } catch {
      toast.error("Failed to load problem. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [role, difficulty, language])

  // ── Load problem on mount ──
  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    fetchProblem()
  }, [fetchProblem])
  
  // ── When language changes update starter code ──
  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    if (problem?.starter_code?.[lang]) {
      setCode(problem.starter_code[lang])
    }
  }

  // ── Run code ──
  const handleRun = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first!")
      return
    }
    setRunning(true)
    setOutput(null)
    setActiveTab("output")
    try {
      const res = await API.post("/api/coding/run", {
        code,
        language,
        stdin: ""
      })
      setOutput(res.data)
    } catch {
      toast.error("Code execution failed!")
    } finally {
      setRunning(false)
    }
  }

  // ── Submit code against test cases ──
  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first!")
      return
    }
    if (!problem) return
    setSubmitting(true)
    setResults(null)
    setActiveTab("results")
    try {
      const res = await API.post("/api/coding/submit", {
        code,
        language,
        test_cases:    problem.test_cases,
        problem_title: problem.title
      })
      setResults(res.data)
      if (res.data.all_passed) {
        toast.success("All test cases passed!")
      } else {
        toast.error(`${res.data.passed}/${res.data.total} test cases passed`)
      }
    } catch {
      toast.error("Submission failed!")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading screen ──
  if (loading) return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "center",
      alignItems:     "center",
      height:         "100vh",
      gap:            "16px"
    }}>
      <div className="spinner" style={{ width: 48, height: 48 }}/>
      <p style={{ color: "var(--t2)" }}>Generating coding problem with AI...</p>
    </div>
  )

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Top Bar ── */}
      <div style={{
        padding:        "12px 20px",
        borderBottom:   "1px solid var(--bdr)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        flexWrap:       "wrap",
        gap:            "10px",
        background:     "var(--bg2)"
      }}>
        {/* Left — Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.4rem" }}>💻</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>
              {problem?.title || "Coding Assessment"}
            </div>
            <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
              MockMind — AI Coding Challenge
            </div>
          </div>
          {/* Difficulty badge */}
          {problem && (
            <span style={{
              background:   `${DIFFICULTIES.find(d => d.id === problem.difficulty)?.color}22`,
              border:       `1px solid ${DIFFICULTIES.find(d => d.id === problem.difficulty)?.color}`,
              color:        DIFFICULTIES.find(d => d.id === problem.difficulty)?.color,
              borderRadius: "20px",
              padding:      "3px 10px",
              fontSize:     ".75rem",
              fontWeight:   700
            }}>
              {problem.difficulty?.toUpperCase()}
            </span>
          )}
        </div>

        {/* Right — Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

          {/* Role selector */}
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={{
              background:   "var(--bg)",
              border:       "1px solid var(--bdr)",
              color:        "var(--t1)",
              borderRadius: "8px",
              padding:      "6px 10px",
              fontSize:     ".82rem",
              cursor:       "pointer"
            }}
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Difficulty selector */}
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            style={{
              background:   "var(--bg)",
              border:       "1px solid var(--bdr)",
              color:        "var(--t1)",
              borderRadius: "8px",
              padding:      "6px 10px",
              fontSize:     ".82rem",
              cursor:       "pointer"
            }}
          >
            {DIFFICULTIES.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>

          {/* New Problem button */}
          <button
            onClick={fetchProblem}
            className="btn btns"
            style={{ padding: "7px 14px", fontSize: ".82rem" }}
          >
            🔄 New Problem
          </button>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running || submitting}
            className="btn"
            style={{
              background:   "rgba(16,185,129,.15)",
              border:       "1px solid rgba(16,185,129,.4)",
              color:        "#10b981",
              padding:      "7px 16px",
              fontSize:     ".82rem",
              fontWeight:   700,
              opacity:      (running || submitting) ? 0.5 : 1,
              cursor:       (running || submitting) ? "not-allowed" : "pointer"
            }}
          >
            {running ? "⏳ Running..." : "▶️ Run"}
          </button>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || running}
            className="btn btnp"
            style={{
              padding:  "7px 16px",
              fontSize: ".82rem",
              opacity:  (submitting || running) ? 0.5 : 1,
              cursor:   (submitting || running) ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "⏳ Submitting..." : "🚀 Submit"}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT PANEL — Problem / Output / Results ── */}
        <div style={{
          width:       "40%",
          borderRight: "1px solid var(--bdr)",
          display:     "flex",
          flexDirection: "column",
          overflow:    "hidden"
        }}>
          {/* Tabs */}
          <div style={{
            display:     "flex",
            borderBottom: "1px solid var(--bdr)",
            background:  "var(--bg2)"
          }}>
            {["problem", "output", "results"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding:     "10px 18px",
                  border:      "none",
                  background:  "transparent",
                  color:       activeTab === tab ? "var(--pl)" : "var(--t2)",
                  borderBottom: activeTab === tab ? "2px solid var(--p)" : "2px solid transparent",
                  cursor:      "pointer",
                  fontSize:    ".85rem",
                  fontWeight:  600,
                  textTransform: "capitalize",
                  position:    "relative"
                }}
              >
                {tab === "problem"  ? "📋 Problem"  : ""}
                {tab === "output"   ? "▶️ Output"    : ""}
                {tab === "results"  ? "🧪 Results"  : ""}
                {/* Badge showing result count */}
                {tab === "results" && results && (
                  <span style={{
                    position:    "absolute",
                    top:         "4px",
                    right:       "4px",
                    background:  results.all_passed ? "#10b981" : "#ef4444",
                    color:       "#fff",
                    fontSize:    ".6rem",
                    fontWeight:  700,
                    borderRadius: "50%",
                    width:       "16px",
                    height:      "16px",
                    display:     "flex",
                    alignItems:  "center",
                    justifyContent: "center"
                  }}>
                    {results.passed}/{results.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>

            {/* ── Problem Tab ── */}
            {activeTab === "problem" && problem && (
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "12px" }}>
                  {problem.title}
                </h2>

                <p style={{ color: "var(--t2)", lineHeight: 1.7, marginBottom: "20px", fontSize: ".9rem" }}>
                  {problem.description}
                </p>

                {/* Examples */}
                <h4 style={{ marginBottom: "10px", fontSize: ".9rem", color: "var(--pl)" }}>
                  Examples:
                </h4>
                {problem.examples?.map((ex, i) => (
                  <div key={i} style={{
                    background:   "rgba(255,255,255,.03)",
                    border:       "1px solid var(--bdr)",
                    borderRadius: "10px",
                    padding:      "14px",
                    marginBottom: "10px",
                    fontSize:     ".85rem"
                  }}>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "var(--t2)" }}>Input: </strong>
                      <code style={{ color: "#10b981" }}>{ex.input}</code>
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "var(--t2)" }}>Output: </strong>
                      <code style={{ color: "#f59e0b" }}>{ex.output}</code>
                    </div>
                    {ex.explanation && (
                      <div style={{ color: "var(--t2)", marginTop: "6px", fontStyle: "italic" }}>
                        {ex.explanation}
                      </div>
                    )}
                  </div>
                ))}

                {/* Constraints */}
                <h4 style={{ margin: "16px 0 8px", fontSize: ".9rem", color: "var(--pl)" }}>
                  Constraints:
                </h4>
                <ul style={{ paddingLeft: "18px" }}>
                  {problem.constraints?.map((c, i) => (
                    <li key={i} style={{ color: "var(--t2)", fontSize: ".85rem", marginBottom: "4px" }}>
                      {c}
                    </li>
                  ))}
                </ul>

                {/* Hints */}
                {problem.hints?.length > 0 && (
                  <details style={{ marginTop: "16px" }}>
                    <summary style={{
                      cursor:     "pointer",
                      color:      "var(--warn)",
                      fontSize:   ".85rem",
                      fontWeight: 600
                    }}>
                      💡 Show Hints
                    </summary>
                    <ul style={{ paddingLeft: "18px", marginTop: "8px" }}>
                      {problem.hints.map((h, i) => (
                        <li key={i} style={{ color: "var(--t2)", fontSize: ".85rem", marginBottom: "4px" }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* ── Output Tab ── */}
            {activeTab === "output" && (
              <div>
                <h3 style={{ marginBottom: "14px", fontSize: ".95rem" }}>▶️ Code Output</h3>
                {running ? (
                  <div style={{
                    display:       "flex",
                    flexDirection: "column",
                    alignItems:    "center",
                    justifyContent:"center",
                    gap:           "16px",
                    padding:       "40px 0",
                    color:         "var(--t2)"
                  }}>
                    <div className="spinner" style={{ width: 36, height: 36 }}/>
                    <div style={{ fontSize: ".9rem", fontWeight: 600 }}>Executing your code...</div>
                    <div style={{ fontSize: ".78rem", color: "var(--t2)", opacity: 0.7 }}>
                      This may take a few seconds
                    </div>
                  </div>
                ) : output ? (
                  <div>
                    {/* Status Badge */}
                    <div style={{
                      display:      "inline-flex",
                      alignItems:   "center",
                      gap:          "6px",
                      background:   getStatusStyle(output.status).bg,
                      border:       `1px solid ${getStatusStyle(output.status).border}`,
                      color:        getStatusStyle(output.status).color,
                      borderRadius: "8px",
                      padding:      "5px 14px",
                      fontSize:     ".8rem",
                      fontWeight:   700,
                      marginBottom: "16px"
                    }}>
                      {output.status === "Success" ? "✅" : output.status === "Compilation Error" ? "🔧" : output.status === "Time Limit Exceeded" ? "⏱️" : "❌"}
                      {output.status}
                    </div>

                    {/* Compilation Error — Compiler Logs */}
                    {output.compile_stderr && (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{
                          fontSize:     ".8rem",
                          fontWeight:   700,
                          color:        "#ef4444",
                          marginBottom: "6px",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          "6px"
                        }}>
                          🔧 Compiler Error
                        </div>
                        <pre style={{
                          background:   "rgba(239,68,68,.06)",
                          border:       "1px solid rgba(239,68,68,.3)",
                          borderRadius: "8px",
                          padding:      "12px",
                          fontSize:     ".82rem",
                          color:        "#fca5a5",
                          overflowX:    "auto",
                          whiteSpace:   "pre-wrap",
                          lineHeight:   1.6,
                          maxHeight:    "300px",
                          overflow:     "auto"
                        }}>
                          {output.compile_stderr}
                        </pre>
                      </div>
                    )}

                    {/* Stdout — Program Output */}
                    {output.stdout ? (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{
                          fontSize:     ".8rem",
                          fontWeight:   700,
                          color:        "#10b981",
                          marginBottom: "6px",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          "6px"
                        }}>
                          📤 Output
                        </div>
                        <pre style={{
                          background:   "rgba(0,0,0,.3)",
                          border:       "1px solid var(--bdr)",
                          borderRadius: "8px",
                          padding:      "12px",
                          fontSize:     ".85rem",
                          color:        "#10b981",
                          overflowX:    "auto",
                          whiteSpace:   "pre-wrap",
                          lineHeight:   1.6,
                          maxHeight:    "300px",
                          overflow:     "auto"
                        }}>
                          {output.stdout}
                        </pre>
                      </div>
                    ) : (
                      !output.compile_stderr && (
                        <div style={{
                          padding:       "12px 16px",
                          background:    "rgba(255,255,255,.03)",
                          border:        "1px solid var(--bdr)",
                          borderRadius:  "8px",
                          fontSize:      ".85rem",
                          color:         "var(--t2)",
                          marginBottom:  "14px"
                        }}>
                          Program produced no output.
                        </div>
                      )
                    )}

                    {/* Runtime Error — Runtime Logs */}
                    {output.run_stderr && !output.compile_stderr && (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{
                          fontSize:     ".8rem",
                          fontWeight:   700,
                          color:        "#ef4444",
                          marginBottom: "6px",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          "6px"
                        }}>
                          ❌ Runtime Error
                        </div>
                        <pre style={{
                          background:   "rgba(239,68,68,.06)",
                          border:       "1px solid rgba(239,68,68,.3)",
                          borderRadius: "8px",
                          padding:      "12px",
                          fontSize:     ".82rem",
                          color:        "#fca5a5",
                          overflowX:    "auto",
                          whiteSpace:   "pre-wrap",
                          lineHeight:   1.6,
                          maxHeight:    "300px",
                          overflow:     "auto"
                        }}>
                          {output.run_stderr}
                        </pre>
                      </div>
                    )}

                    {/* Exit Code */}
                    <div style={{
                      fontSize:     ".75rem",
                      color:        "var(--t2)",
                      opacity:      0.6,
                      borderTop:    "1px solid var(--bdr)",
                      paddingTop:   "10px",
                      marginTop:    "4px"
                    }}>
                      Exit Code: {output.exit_code}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    justifyContent: "center",
                    padding:        "40px 0",
                    color:          "var(--t2)",
                    gap:            "8px"
                  }}>
                    <span style={{ fontSize: "2rem", opacity: 0.3 }}>▶️</span>
                    <p style={{ fontSize: ".9rem" }}>
                      Click <strong>"▶️ Run"</strong> to execute your code.
                    </p>
                    <p style={{ fontSize: ".78rem", opacity: 0.6 }}>
                      Output, compiler logs and runtime errors will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Results Tab ── */}
            {activeTab === "results" && (
              <div>
                <h3 style={{ marginBottom: "14px", fontSize: ".95rem" }}>🧪 Test Results</h3>
                {submitting ? (
                  <div style={{
                    display:       "flex",
                    flexDirection: "column",
                    alignItems:    "center",
                    justifyContent:"center",
                    gap:           "16px",
                    padding:       "40px 0",
                    color:         "var(--t2)"
                  }}>
                    <div className="spinner" style={{ width: 36, height: 36 }}/>
                    <div style={{ fontSize: ".9rem", fontWeight: 600 }}>Running test cases...</div>
                    <div style={{ fontSize: ".78rem", color: "var(--t2)", opacity: 0.7 }}>
                      Executing against all test cases
                    </div>
                  </div>
                ) : results ? (
                  <div>
                    {/* Overall Score Card */}
                    <div style={{
                      display:       "flex",
                      alignItems:    "center",
                      gap:           "16px",
                      marginBottom:  "20px",
                      padding:       "18px",
                      borderRadius:  "12px",
                      background:    results.all_passed ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)",
                      border:        `1px solid ${results.all_passed ? "#10b981" : "#ef4444"}`
                    }}>
                      {/* Score circle */}
                      <div style={{
                        width:         "60px",
                        height:        "60px",
                        borderRadius:  "50%",
                        border:        `3px solid ${results.all_passed ? "#10b981" : "#ef4444"}`,
                        display:       "flex",
                        flexDirection: "column",
                        alignItems:    "center",
                        justifyContent:"center",
                        flexShrink:    0
                      }}>
                        <div style={{
                          fontWeight: 800,
                          fontSize:   "1.1rem",
                          lineHeight: 1,
                          color:      results.all_passed ? "#10b981" : "#ef4444"
                        }}>
                          {Math.round(results.score)}%
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 800,
                          fontSize:   "1rem",
                          color:      results.all_passed ? "#10b981" : "#ef4444"
                        }}>
                          {results.passed} / {results.total} Test Cases Passed
                        </div>
                        <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "2px" }}>
                          {results.overall_status || (results.all_passed ? "All Passed" : "Some Failed")}
                        </div>
                      </div>
                    </div>

                    {/* Individual test cases */}
                    {results.results?.map((tc, i) => {
                      const tcStyle = getStatusStyle(tc.status)
                      return (
                        <div key={i} style={{
                          padding:       "14px",
                          borderRadius:  "10px",
                          background:    tcStyle.bg,
                          border:        `1px solid ${tcStyle.border}33`,
                          marginBottom:  "10px"
                        }}>
                          {/* Header row */}
                          <div style={{
                            display:        "flex",
                            justifyContent: "space-between",
                            alignItems:     "center",
                            marginBottom:   "10px"
                          }}>
                            <span style={{ fontWeight: 700, fontSize: ".85rem", color: "var(--t1)" }}>
                              Test Case {tc.test_case}
                            </span>
                            <span style={{
                              color:      tcStyle.color,
                              fontWeight: 700,
                              fontSize:   ".78rem",
                              background: `${tcStyle.border}15`,
                              padding:    "3px 10px",
                              borderRadius: "20px",
                              border:     `1px solid ${tcStyle.border}44`
                            }}>
                              {tc.passed ? "✅ PASSED" : `❌ ${tc.status}`}
                            </span>
                          </div>

                          {/* Input */}
                          {tc.input && (
                            <div style={{ marginBottom: "6px" }}>
                              <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                                Input:
                              </div>
                              <code style={{
                                display:     "block",
                                background:  "rgba(0,0,0,.2)",
                                padding:     "8px 10px",
                                borderRadius: "6px",
                                fontSize:    ".8rem",
                                color:       "#93c5fd",
                                whiteSpace:  "pre-wrap",
                                wordBreak:   "break-all"
                              }}>
                                {tc.input || "(empty)"}
                              </code>
                            </div>
                          )}

                          {/* Expected */}
                          <div style={{ marginBottom: "6px" }}>
                            <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                              Expected Output:
                            </div>
                            <code style={{
                              display:     "block",
                              background:  "rgba(0,0,0,.2)",
                              padding:     "8px 10px",
                              borderRadius: "6px",
                              fontSize:    ".8rem",
                              color:       "#10b981",
                              whiteSpace:  "pre-wrap",
                              wordBreak:   "break-all"
                            }}>
                              {tc.expected || "(empty)"}
                            </code>
                          </div>

                          {/* Got */}
                          <div style={{ marginBottom: "6px" }}>
                            <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                              Your Output:
                            </div>
                            <code style={{
                              display:     "block",
                              background:  "rgba(0,0,0,.2)",
                              padding:     "8px 10px",
                              borderRadius: "6px",
                              fontSize:    ".8rem",
                              color:       tc.passed ? "#10b981" : "#ef4444",
                              whiteSpace:  "pre-wrap",
                              wordBreak:   "break-all"
                            }}>
                              {tc.got || "(no output)"}
                            </code>
                          </div>

                          {/* Error Message */}
                          {tc.error_message && (
                            <div style={{ marginTop: "8px" }}>
                              <div style={{ fontSize: ".75rem", color: "#ef4444", marginBottom: "3px", fontWeight: 600 }}>
                                Error Details:
                              </div>
                              <pre style={{
                                background:  "rgba(239,68,68,.06)",
                                border:      "1px solid rgba(239,68,68,.25)",
                                borderRadius:"6px",
                                padding:     "8px 10px",
                                fontSize:    ".78rem",
                                color:       "#fca5a5",
                                whiteSpace:  "pre-wrap",
                                wordBreak:   "break-word",
                                maxHeight:   "150px",
                                overflow:    "auto"
                              }}>
                                {tc.error_message}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    justifyContent: "center",
                    padding:        "40px 0",
                    color:          "var(--t2)",
                    gap:            "8px"
                  }}>
                    <span style={{ fontSize: "2rem", opacity: 0.3 }}>🧪</span>
                    <p style={{ fontSize: ".9rem" }}>
                      Click <strong>"🚀 Submit"</strong> to run against all test cases.
                    </p>
                    <p style={{ fontSize: ".78rem", opacity: 0.6 }}>
                      Detailed results with input, expected &amp; actual output will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Code Editor ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Language selector bar */}
          <div style={{
            display:     "flex",
            gap:         "6px",
            padding:     "10px 16px",
            borderBottom: "1px solid var(--bdr)",
            background:  "var(--bg2)"
          }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                style={{
                  padding:      "5px 14px",
                  borderRadius: "8px",
                  border:       language === lang.id
                                  ? "1px solid var(--p)"
                                  : "1px solid var(--bdr)",
                  background:   language === lang.id
                                  ? "rgba(139,92,246,.2)"
                                  : "transparent",
                  color:        language === lang.id ? "var(--pl)" : "var(--t2)",
                  cursor:       "pointer",
                  fontSize:     ".82rem",
                  fontWeight:   600,
                  transition:   "all .2s"
                }}
              >
                {lang.icon} {lang.label}
              </button>
            ))}
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={language === "cpp" ? "cpp" : language}
              value={code}
              onChange={value => setCode(value || "")}
              theme="vs-dark"
              options={{
                fontSize:           14,
                fontFamily:         "JetBrains Mono, Fira Code, monospace",
                minimap:            { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout:    true,
                tabSize:            2,
                wordWrap:           "on",
                lineNumbers:        "on",
                renderLineHighlight: "line",
                cursorBlinking:     "blink",
                smoothScrolling:    true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
