// frontend/src/pages/Coding.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams }                          from "react-router-dom"
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
  { id: "easy",   label: "Easy",   color: "#16a34a" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "hard",   label: "Hard",   color: "#ef4444" },
]



const STATUS_STYLES = {
  "Passed":              { bg: "rgba(22,163,74,.12)",  border: "#16a34a",  color: "#16a34a"  },
  "Success":             { bg: "rgba(22,163,74,.12)",  border: "#16a34a",  color: "#16a34a"  },
  "Compilation Error":   { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
  "Runtime Error":       { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
  "Wrong Answer":        { bg: "rgba(245,158,11,.12)",  border: "#f59e0b",  color: "#f59e0b"  },
  "Time Limit Exceeded": { bg: "rgba(168,85,247,.12)",  border: "#a855f7",  color: "#a855f7"  },
  "Error":               { bg: "rgba(239,68,68,.12)",   border: "#ef4444",  color: "#ef4444"  },
}

function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES["Error"]
}

function stripFunctionSignature(description, functionSignature) {
  if (!description) return ""

  let result = description
  if (functionSignature) {
    const signatures = Array.isArray(functionSignature)
      ? functionSignature
      : Object.values(functionSignature)
    signatures.forEach(sig => {
      if (!sig) return
      result = result.split(sig).join("")
    })
  }

  const pattern = /^\s*(def\s+solution\(|function\s+solution\(|public\s+.*\s+solution\(|vector<.*\s+solution\(|int\*\s+solution\(|bool\s+solution\(|string\s+solution\(|char\*\s+solution\(|int\s+solution\(|class\s+Solution|function_signature|function signature|`{3}|<code>|<pre>)/i

  const lines = result.split("\n")
  const cleaned = []
  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed === "") {
      cleaned.push("")
      return
    }
    if (pattern.test(trimmed)) {
      return
    }
    cleaned.push(line)
  })

  return cleaned
    .join("\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}

export default function Coding() {
  // ── State ──
  const [problems,      setProblems]      = useState([])
  const [currentIndex,   setCurrentIndex]   = useState(0)
  const [problem,        setProblem]        = useState(null)
  const [code,           setCode]           = useState("")
  const [language,       setLanguage]       = useState("java")
  const [difficulty,     setDifficulty]     = useState("easy")
  const [runResults,     setRunResults]     = useState(null)
  const [results,        setResults]        = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [running,        setRunning]        = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [solvedMap,      setSolvedMap]      = useState({})
  const [savedCodeMap,   setSavedCodeMap]   = useState({})
  const savedCodeRef     = useRef({})
  const [historyStack,   setHistoryStack]   = useState([])
  const [historyIdx,     setHistoryIdx]     = useState(-1)
  const [showSolution,   setShowSolution]   = useState(false)
  const [solutionLang,   setSolutionLang]   = useState("java")
  const [searchParams,     setSearchParams]   = useSearchParams()

  // ── Resolve code for a problem + language (saved > starter > empty) ──
  const resolveCode = (prob, lang) => {
    if (!prob) return ""
    const title = prob.title
    if (title && savedCodeRef.current[title]?.[lang]) return savedCodeRef.current[title][lang]
    if (prob.starter_code?.[lang]) return prob.starter_code[lang]
    return ""
  }

  // ── Fetch coding history (solved + saved code) ──
  useEffect(() => {
    API.get("/api/coding/history")
      .then(r => {
        const solved = {}
        ;(r.data.solved || []).forEach(t => { solved[t] = true })
        setSolvedMap(solved)
        const sc = r.data.saved_code || {}
        savedCodeRef.current = sc
        setSavedCodeMap(sc)
      })
      .catch(() => {})
  }, [])

  // ── Fetch new problem ──
  const fetchProblems = useCallback(async () => {
    setLoading(true)
    setResults(null)
    setRunResults(null)
    try {
      const res = await API.get("/api/coding/problem", {
        params: { difficulty, count: 20 }
      })
      const loaded = res.data.problems || (res.data.problem ? [res.data.problem] : [])
      if (!loaded.length) {
        toast.error("No problems were returned. Please try again.")
        return
      }

      // Fisher-Yates shuffle
      const shuffled = [...loaded]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      // If URL has ?problem= param, find and put it first
      const targetTitle = searchParams.get("problem")
      if (targetTitle) {
        const idx = shuffled.findIndex(p => p.title === targetTitle)
        if (idx > 0) {
          const [match] = shuffled.splice(idx, 1)
          shuffled.unshift(match)
        }
        setSearchParams({})
      }

      setProblems(shuffled)
      setCurrentIndex(0)
      setProblem(shuffled[0])
      setCode(resolveCode(shuffled[0], language))
      setHistoryStack([shuffled[0]])
      setHistoryIdx(0)
      setResults(null)
      setRunResults(null)
      toast.success("Loaded coding problems")
    } catch {
      toast.error("Failed to load problems. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [difficulty, language, searchParams, setSearchParams])

  useEffect(() => {
    fetchProblems()
  }, [difficulty])
  
  // ── When language changes, load saved code or starter code ──
  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    setCode(resolveCode(problem, lang))
  }

  const handlePreviousProblem = () => {
    if (historyIdx <= 0) return
    const prevIdx = historyIdx - 1
    setHistoryIdx(prevIdx)
    const p = historyStack[prevIdx]
    setProblem(p)
    setCode(resolveCode(p, language))
    setCurrentIndex(problems.indexOf(p))
    setRunResults(null)
    setResults(null)
  }

  const handleNextProblem = () => {
    if (currentIndex >= problems.length - 1) return
    const nextIdx = currentIndex + 1
    const next = problems[nextIdx]
    const newStack = historyStack.slice(0, historyIdx + 1)
    newStack.push(next)
    setHistoryStack(newStack)
    setHistoryIdx(newStack.length - 1)
    setCurrentIndex(nextIdx)
    setProblem(next)
    setCode(resolveCode(next, language))
    setRunResults(null)
    setResults(null)
  }

  // ── Run code against example test cases ──
  const handleRun = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first!")
      return
    }
    if (!problem) return
    setRunning(true)
    setRunResults(null)
    setResults(null)
    try {
      const res = await API.post("/api/coding/run-cases", {
        code,
        language,
        test_cases: problem.examples?.map(ex => ({
          input:    ex.input,
          expected: ex.output
        })) || []
      })
      setRunResults(res.data)
      if (res.data.all_passed) {
        toast.success("All example cases passed!")
      } else {
        toast.error(`${res.data.passed}/${res.data.total} example cases passed`)
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Code execution failed!"
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  // ── Submit code against hidden test cases ──
  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first!")
      return
    }
    if (!problem) return
    setSubmitting(true)
    setResults(null)
    setRunResults(null)
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
        setSolvedMap(prev => ({ ...prev, [problem.title]: true }))
        setSavedCodeMap(prev => {
          const next = { ...prev, [problem.title]: { ...(prev[problem.title] || {}), [language]: code } }
          savedCodeRef.current = next
          return next
        })
      } else {
        toast.error(`${res.data.passed}/${res.data.total} test cases passed`)
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Submission failed!"
      toast.error(msg)
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
      <p style={{ color: "var(--t2)" }}>Generating coding problems...</p>
    </div>
  )

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "transparent" }}>

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
              {problems.length > 0 && (
                <span style={{ marginLeft: "10px", opacity: 0.8 }}>
                  ({currentIndex + 1}/{problems.length})
                </span>
              )}
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

          {/* Difficulty selector */}
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            className="inp"
            style={{
              width:     "auto",
              padding:   "6px 10px",
              fontSize:  ".82rem",
              cursor:    "pointer",
              borderRadius: "8px"
            }}
          >
            {DIFFICULTIES.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>

          {/* Language selector */}
          <select
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            className="inp"
            style={{
              width:     "auto",
              padding:   "6px 10px",
              fontSize:  ".82rem",
              cursor:    "pointer",
              borderRadius: "8px"
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.id} value={lang.id}>{lang.label}</option>
            ))}
          </select>

          {historyIdx > 0 && (
            <button
              onClick={handlePreviousProblem}
              className="btn btns"
              style={{ padding: "7px 14px", fontSize: ".82rem" }}
            >
              ◀️ Prev
            </button>
          )}

          {currentIndex < problems.length - 1 && (
            <button
              onClick={handleNextProblem}
              className="btn btns"
              style={{ padding: "7px 14px", fontSize: ".82rem" }}
            >
              Next ▶️
            </button>
          )}

          <button
            onClick={fetchProblems}
            className="btn btns"
            style={{ padding: "7px 14px", fontSize: ".82rem" }}
          >
            🔄 Refresh Batch
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
          overflow:    "hidden",
          background:  "var(--card)",
          borderRadius: "0 16px 16px 0"
        }}>
          {/* Problem header */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            borderBottom:   "1px solid var(--bdr)",
            background:     "var(--bg2)",
            padding:        "12px 20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1rem", fontWeight: 700 }}>📋 Problem</span>
              {solvedMap[problem?.title] && (
                <span style={{
                  fontSize: ".75rem",
                  color: "#16a34a",
                  background: "rgba(22,163,74,.12)",
                  border: "1px solid rgba(22,163,74,.3)",
                  borderRadius: "12px",
                  padding: "3px 10px",
                  fontWeight: 700
                }}>
                  ✅ Solved
                </span>
              )}
              {solvedMap[problem?.title] && (
                <button
                  onClick={() => {
                    const langs = Object.keys(savedCodeMap[problem?.title] || {})
                    setSolutionLang(langs[0] || language)
                    setShowSolution(true)
                  }}
                  style={{
                    fontSize:     ".75rem",
                    color:        "var(--pl)",
                    background:   "rgba(129,140,248,.12)",
                    border:       "1px solid rgba(129,140,248,.3)",
                    borderRadius: "12px",
                    padding:      "3px 10px",
                    fontWeight:   700,
                    cursor:       "pointer"
                  }}
                >
                  👁️ View Solution
                </button>
              )}
              {results?.all_passed && (
                <span style={{
                  fontSize: ".8rem",
                  color: "#16a34a",
                  background: "rgba(22,163,74,.12)",
                  border: "1px solid rgba(22,163,74,.25)",
                  borderRadius: "12px",
                  padding: "4px 10px"
                }}>
                  Last submit passed {results.passed}/{results.total}
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
            {problem && (
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "12px" }}>
                  {problem.title}
                </h2>

                <p style={{ color: "var(--t2)", lineHeight: 1.7, marginBottom: "20px", fontSize: ".9rem" }}>
                  {stripFunctionSignature(problem.description, problem.function_signature)}
                </p>

                {/* Examples */}
                {problem.examples?.map((ex, i) => (
                  <div key={i} className="glass" style={{
                    padding:      "14px",
                    marginBottom: "10px",
                    fontSize:     ".85rem"
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: "8px", fontSize: ".88rem" }}>
                      Example {i + 1}:
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "var(--t2)" }}>Input: </strong>
                      <code style={{ color: "#16a34a" }}>{ex.input}</code>
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "var(--t2)" }}>Output: </strong>
                      <code style={{ color: "#f59e0b" }}>{ex.output}</code>
                    </div>
                    {ex.explanation && (
                      <div style={{ color: "var(--t2)", marginTop: "6px" }}>
                        <strong>Explanation: </strong>{ex.explanation}
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

                {/* Time & Space Complexity */}
                {(problem.time_complexity || problem.space_complexity) && (
                  <div style={{
                    marginTop:     "16px",
                    padding:       "12px 14px",
                    background:    "rgba(99,102,241,.06)",
                    border:        "1px solid rgba(99,102,241,.2)",
                    borderRadius:  "10px",
                    display:       "flex",
                    flexDirection: "column",
                    gap:           "8px"
                  }}>
                    <div style={{
                      fontSize:     ".75rem",
                      color:        "var(--t2)",
                      fontWeight:   600,
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                      marginBottom: "2px"
                    }}>
                      Complexity Analysis
                    </div>
                    {problem.time_complexity && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{
                          fontSize:     ".78rem",
                          fontWeight:   700,
                          color:        "var(--pl)",
                          flexShrink:   0,
                          minWidth:     "100px"
                        }}>
                          Time:
                        </span>
                        <span style={{ fontSize: ".82rem", color: "var(--t1)", lineHeight: 1.5 }}>
                          {problem.time_complexity}
                        </span>
                      </div>
                    )}
                    {problem.space_complexity && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{
                          fontSize:     ".78rem",
                          fontWeight:   700,
                          color:        "var(--pl)",
                          flexShrink:   0,
                          minWidth:     "100px"
                        }}>
                          Space:
                        </span>
                        <span style={{ fontSize: ".82rem", color: "var(--t1)", lineHeight: 1.5 }}>
                          {problem.space_complexity}
                        </span>
                      </div>
                    )}
                  </div>
                )}

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
                <div style={{ fontSize: ".9rem", fontWeight: 600 }}>Running example cases...</div>
                <div style={{ fontSize: ".78rem", color: "var(--t2)", opacity: 0.7 }}>
                  Testing against visible examples
                </div>
              </div>
            ) : runResults ? (
              <div>
                <div style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          "6px",
                  background:   runResults.all_passed ? "rgba(22,163,74,.12)" : "rgba(239,68,68,.12)",
                  border:       `1px solid ${runResults.all_passed ? "#16a34a" : "#ef4444"}`,
                  color:        runResults.all_passed ? "#16a34a" : "#ef4444",
                  borderRadius: "8px",
                  padding:      "5px 14px",
                  fontSize:     ".8rem",
                  fontWeight:   700,
                  marginBottom: "16px"
                }}>
                  {runResults.all_passed ? "✅" : "❌"}
                  {runResults.passed}/{runResults.total} Example Cases Passed
                </div>

                {runResults.results?.map((tc, i) => {
                  const tcStyle = getStatusStyle(tc.status)
                  return (
                    <div key={i} style={{
                      padding:       "14px",
                      borderRadius:  "10px",
                      background:    tcStyle.bg,
                      border:        `1px solid ${tcStyle.border}33`,
                      marginBottom:  "10px"
                    }}>
                      <div style={{
                        display:        "flex",
                        justifyContent: "space-between",
                        alignItems:     "center",
                        marginBottom:   "10px"
                      }}>
                        <span style={{ fontWeight: 700, fontSize: ".85rem", color: "var(--t1)" }}>
                          Example {tc.test_case}
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

                      {tc.input && (
                        <div style={{ marginBottom: "6px" }}>
                          <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                            Input:
                          </div>
                          <code style={{
                            display: "block", background: "rgba(0,0,0,.2)",
                            padding: "8px 10px", borderRadius: "6px",
                            fontSize: ".8rem", color: "var(--t1)",
                            whiteSpace: "pre-wrap", wordBreak: "break-all"
                          }}>
                            {tc.input || "(empty)"}
                          </code>
                        </div>
                      )}

                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                          Expected:
                        </div>
                        <code style={{
                          display: "block", background: "rgba(0,0,0,.2)",
                          padding: "8px 10px", borderRadius: "6px",
                          fontSize: ".8rem", color: "#16a34a",
                          whiteSpace: "pre-wrap", wordBreak: "break-all"
                        }}>
                          {tc.expected || "(empty)"}
                        </code>
                      </div>

                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                          Your Output:
                        </div>
                        <code style={{
                          display: "block", background: "rgba(0,0,0,.2)",
                          padding: "8px 10px", borderRadius: "6px",
                          fontSize: ".8rem",
                          color: tc.passed ? "#16a34a" : "#ef4444",
                          whiteSpace: "pre-wrap", wordBreak: "break-all"
                        }}>
                          {tc.got || "(no output)"}
                        </code>
                      </div>

                      {tc.error_message && (
                        <div style={{ marginTop: "8px" }}>
                          <div style={{ fontSize: ".75rem", color: "#ef4444", marginBottom: "3px", fontWeight: 600 }}>
                            Error:
                          </div>
                          <pre style={{
                            background: "rgba(239,68,68,.06)",
                            border: "1px solid rgba(239,68,68,.25)",
                            borderRadius: "6px", padding: "8px 10px",
                            fontSize: ".78rem", color: "#ef4444",
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                            maxHeight: "150px", overflow: "auto"
                          }}>
                            {tc.error_message}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

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
                <div style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          "6px",
                  background:   results.all_passed ? "rgba(22,163,74,.12)" : "rgba(239,68,68,.12)",
                  border:       `1px solid ${results.all_passed ? "#16a34a" : "#ef4444"}`,
                  color:        results.all_passed ? "#16a34a" : "#ef4444",
                  borderRadius: "8px",
                  padding:      "5px 14px",
                  fontSize:     ".8rem",
                  fontWeight:   700,
                  marginBottom: "16px"
                }}>
                  {results.all_passed ? "✅" : "❌"}
                  {results.passed}/{results.total} Test Cases Passed
                </div>

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

                      {tc.input && (
                        <div style={{ marginBottom: "6px" }}>
                          <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                            Input:
                          </div>
                          <code style={{
                            display: "block", background: "rgba(0,0,0,.2)",
                            padding: "8px 10px", borderRadius: "6px",
                            fontSize: ".8rem", color: "var(--t1)",
                            whiteSpace: "pre-wrap", wordBreak: "break-all"
                          }}>
                            {tc.input || "(empty)"}
                          </code>
                        </div>
                      )}

                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                          Expected:
                        </div>
                        <code style={{
                          display: "block", background: "rgba(0,0,0,.2)",
                          padding: "8px 10px", borderRadius: "6px",
                          fontSize: ".8rem", color: "#16a34a",
                          whiteSpace: "pre-wrap", wordBreak: "break-all"
                        }}>
                          {tc.expected || "(empty)"}
                        </code>
                      </div>

                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)", marginBottom: "3px", fontWeight: 600 }}>
                          Your Output:
                        </div>
                        <code style={{
                          display: "block", background: "rgba(0,0,0,.2)",
                          padding: "8px 10px", borderRadius: "6px",
                          fontSize: ".8rem",
                          color: tc.passed ? "#16a34a" : "#ef4444",
                          whiteSpace: "pre-wrap", wordBreak: "break-all"
                        }}>
                          {tc.got || "(no output)"}
                        </code>
                      </div>

                      {tc.error_message && (
                        <div style={{ marginTop: "8px" }}>
                          <div style={{ fontSize: ".75rem", color: "#ef4444", marginBottom: "3px", fontWeight: 600 }}>
                            Error:
                          </div>
                          <pre style={{
                            background: "rgba(239,68,68,.06)",
                            border: "1px solid rgba(239,68,68,.25)",
                            borderRadius: "6px", padding: "8px 10px",
                            fontSize: ".78rem", color: "#ef4444",
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                            maxHeight: "150px", overflow: "auto"
                          }}>
                            {tc.error_message}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── RIGHT PANEL — Code Editor ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Actions bar */}
          <div style={{
            display:        "flex",
            flexWrap:       "wrap",
            gap:            "8px",
            padding:        "10px 16px",
            borderBottom:   "1px solid var(--bdr)",
            background:     "var(--bg2)",
            alignItems:     "center",
            justifyContent: "space-between"
          }}>
            <div style={{ color: "var(--t2)", fontSize: ".9rem", fontWeight: 600 }}>
              Language: {LANGUAGES.find(lang => lang.id === language)?.label}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={handleRun}
                disabled={running || submitting}
                className="btn"
                style={{
                  background:   "rgba(22,163,74,.15)",
                  border:       "1px solid rgba(22,163,74,.4)",
                  color:        "#16a34a",
                  padding:      "7px 16px",
                  fontSize:     ".82rem",
                  fontWeight:   700,
                  opacity:      (running || submitting) ? 0.5 : 1,
                  cursor:       (running || submitting) ? "not-allowed" : "pointer"
                }}
              >
                {running ? "⏳ Running..." : "▶️ Run"}
              </button>

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

      {/* ── View Solution Modal ── */}
      {showSolution && (
        <div style={{
          position:      "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background:    "rgba(0,0,0,.6)",
          zIndex:        1000,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          padding:       "20px"
        }} onClick={() => setShowSolution(false)}>
          <div
            style={{
              background:   "var(--card)",
              border:       "1px solid var(--bdr)",
              borderRadius: "16px",
              width:        "700px",
              maxWidth:     "95vw",
              maxHeight:    "85vh",
              display:      "flex",
              flexDirection:"column",
              overflow:     "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "16px 20px",
              borderBottom:   "1px solid var(--bdr)",
              background:     "var(--bg2)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>👁️ Your Solution</span>
                <span style={{ fontSize: ".82rem", color: "var(--t2)" }}>{problem?.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <select
                  value={solutionLang}
                  onChange={e => setSolutionLang(e.target.value)}
                  className="inp"
                  style={{ width: "auto", padding: "5px 10px", fontSize: ".8rem", borderRadius: "8px" }}
                >
                  {Object.keys(savedCodeMap[problem?.title] || {}).map(l => (
                    <option key={l} value={l}>{LANGUAGES.find(x => x.id === l)?.label || l}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSolution(false)}
                  style={{
                    background:   "transparent",
                    border:       "none",
                    color:        "var(--t2)",
                    fontSize:     "1.3rem",
                    cursor:       "pointer",
                    padding:      "4px"
                  }}
                >✕</button>
              </div>
            </div>
            {/* Modal Body — Read-only editor */}
            <div style={{ flex: 1, minHeight: "400px" }}>
              <Editor
                height="100%"
                language={solutionLang === "cpp" ? "cpp" : solutionLang}
                value={savedCodeMap[problem?.title]?.[solutionLang] || ""}
                theme="vs-dark"
                options={{
                  readOnly:           true,
                  fontSize:           14,
                  fontFamily:         "JetBrains Mono, Fira Code, monospace",
                  minimap:            { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout:    true,
                  tabSize:            2,
                  wordWrap:           "on",
                  lineNumbers:        "on",
                  renderLineHighlight: "none",
                  cursorBlinking:     "solid",
                  contextmenu:        false
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
