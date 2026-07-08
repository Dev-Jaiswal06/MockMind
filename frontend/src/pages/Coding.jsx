// frontend/src/pages/Coding.jsx
import { useState, useEffect } from "react"
import Editor                  from "@monaco-editor/react"
import { motion }              from "framer-motion"
import API                     from "../utils/api"
import toast                   from "react-hot-toast"

// ── Languages supported ──
const LANGUAGES = [
  { id: "python",     label: "Python",     icon: "🐍" },
  { id: "javascript", label: "JavaScript", icon: "🟨" },
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

  // ── Load problem on mount ──
  useEffect(() => {
    fetchProblem()
  }, [])

  // ── Fetch new problem ──
  const fetchProblem = async () => {
    setLoading(true)
    setResults(null)
    setOutput(null)
    try {
      const res = await API.get("/api/coding/problem", {
        params: { role, difficulty }
      })
      const p = res.data.problem
      setProblem(p)
      // Set starter code for selected language
      setCode(p.starter_code?.[language] || "# Write your code here\n")
      toast.success("New problem loaded!")
    } catch (err) {
      toast.error("Failed to load problem. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  
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
    setActiveTab("output")
    try {
      const res = await API.post("/api/coding/run", {
        code,
        language,
        stdin: ""
      })
      setOutput(res.data)
    } catch (err) {
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
        toast.success("All test cases passed! 🎉")
      } else {
        toast.error(`${res.data.passed}/${res.data.total} test cases passed`)
      }
    } catch (err) {
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
            disabled={running}
            className="btn"
            style={{
              background:   "rgba(16,185,129,.15)",
              border:       "1px solid rgba(16,185,129,.4)",
              color:        "#10b981",
              padding:      "7px 16px",
              fontSize:     ".82rem",
              fontWeight:   700
            }}
          >
            {running ? "Running..." : "▶️ Run"}
          </button>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btnp"
            style={{ padding: "7px 16px", fontSize: ".82rem" }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT PANEL — Problem ── */}
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
                  textTransform: "capitalize"
                }}
              >
                {tab === "problem"  ? "📋 Problem"  : ""}
                {tab === "output"   ? "▶️ Output"    : ""}
                {tab === "results"  ? "🧪 Results"  : ""}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>

            {/* Problem Tab */}
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

            {/* Output Tab */}
            {activeTab === "output" && (
              <div>
                <h3 style={{ marginBottom: "14px", fontSize: ".95rem" }}>▶️ Code Output</h3>
                {running ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--t2)" }}>
                    <div className="spinner" style={{ width: 24, height: 24 }}/>
                    Running your code...
                  </div>
                ) : output ? (
                  <div>
                    {/* Status */}
                    <div style={{
                      display:      "inline-block",
                      background:   output.exit_code === 0 ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
                      border:       `1px solid ${output.exit_code === 0 ? "#10b981" : "#ef4444"}`,
                      color:        output.exit_code === 0 ? "#10b981" : "#ef4444",
                      borderRadius: "8px",
                      padding:      "4px 12px",
                      fontSize:     ".8rem",
                      fontWeight:   700,
                      marginBottom: "12px"
                    }}>
                      {output.status}
                    </div>

                    {/* Stdout */}
                    {output.stdout && (
                      <div>
                        <div style={{ fontSize: ".8rem", color: "var(--t2)", marginBottom: "6px" }}>
                          Output:
                        </div>
                        <pre style={{
                          background:   "rgba(0,0,0,.3)",
                          border:       "1px solid var(--bdr)",
                          borderRadius: "8px",
                          padding:      "12px",
                          fontSize:     ".85rem",
                          color:        "#10b981",
                          overflowX:    "auto",
                          whiteSpace:   "pre-wrap"
                        }}>
                          {output.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Stderr */}
                    {output.stderr && (
                      <div style={{ marginTop: "10px" }}>
                        <div style={{ fontSize: ".8rem", color: "#ef4444", marginBottom: "6px" }}>
                          Error:
                        </div>
                        <pre style={{
                          background:   "rgba(239,68,68,.05)",
                          border:       "1px solid rgba(239,68,68,.3)",
                          borderRadius: "8px",
                          padding:      "12px",
                          fontSize:     ".85rem",
                          color:        "#ef4444",
                          overflowX:    "auto",
                          whiteSpace:   "pre-wrap"
                        }}>
                          {output.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: "var(--t2)", fontSize: ".9rem" }}>
                    Click "▶️ Run" to execute your code.
                  </p>
                )}
              </div>
            )}

            {/* Results Tab */}
            {activeTab === "results" && (
              <div>
                <h3 style={{ marginBottom: "14px", fontSize: ".95rem" }}>🧪 Test Results</h3>
                {submitting ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--t2)" }}>
                    <div className="spinner" style={{ width: 24, height: 24 }}/>
                    Running test cases...
                  </div>
                ) : results ? (
                  <div>
                    {/* Score */}
                    <div style={{
                      display:       "flex",
                      alignItems:    "center",
                      gap:           "12px",
                      marginBottom:  "16px",
                      padding:       "16px",
                      borderRadius:  "12px",
                      background:    results.all_passed ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
                      border:        `1px solid ${results.all_passed ? "#10b981" : "#ef4444"}`
                    }}>
                      <div style={{ fontSize: "2rem" }}>
                        {results.all_passed ? "🎉" : "❌"}
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 800,
                          fontSize:   "1.2rem",
                          color:      results.all_passed ? "#10b981" : "#ef4444"
                        }}>
                          {results.passed}/{results.total} Passed
                        </div>
                        <div style={{ fontSize: ".8rem", color: "var(--t2)" }}>
                          Score: {results.score}%
                        </div>
                      </div>
                    </div>

                    {/* Individual test cases */}
                    {results.results?.map((tc, i) => (
                      <div key={i} style={{
                        padding:      "12px",
                        borderRadius: "10px",
                        background:   "rgba(255,255,255,.02)",
                        border:       `1px solid ${tc.passed ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
                        marginBottom: "8px"
                      }}>
                        <div style={{
                          display:        "flex",
                          justifyContent: "space-between",
                          marginBottom:   "8px"
                        }}>
                          <span style={{ fontWeight: 600, fontSize: ".85rem" }}>
                            Test Case {tc.test_case}
                          </span>
                          <span style={{
                            color:      tc.passed ? "#10b981" : "#ef4444",
                            fontWeight: 700,
                            fontSize:   ".82rem"
                          }}>
                            {tc.passed ? "✅ PASSED" : "❌ FAILED"}
                          </span>
                        </div>
                        <div style={{ fontSize: ".8rem", color: "var(--t2)" }}>
                          <span>Expected: </span>
                          <code style={{ color: "#10b981" }}>{tc.expected}</code>
                        </div>
                        {!tc.passed && (
                          <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "4px" }}>
                            <span>Got: </span>
                            <code style={{ color: "#ef4444" }}>{tc.got || "No output"}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--t2)", fontSize: ".9rem" }}>
                    Click "Submit" to run against all test cases.
                  </p>
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