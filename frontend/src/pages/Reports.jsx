// frontend/src/pages/Reports.jsx
import { useState, useEffect, useCallback } from "react"
import { Link }                from "react-router-dom"
import { motion }              from "framer-motion"
import API                     from "../utils/api"
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts"

export default function Reports() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [activeTab, setActiveTab] = useState("overview")

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    API.get("/api/reports/performance")
      .then(r  => { setData(r.data); setLoading(false) })
      .catch(err => { 
        setError(err.message || "Failed to load performance data")
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    // This is the standard React pattern for fetching data in effects
    // eslint-disable-next-line react-hooks
    loadData()
  }, [loadData])  

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
      <p style={{ color: "var(--t2)" }}>Loading your performance data...</p>
    </div>
  )

  // Error state
  if (error) return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "center",
      alignItems:     "center",
      height:         "100vh",
      gap:            "20px",
      textAlign:      "center",
      padding:        "20px"
    }}>
      <div style={{ fontSize: "5rem" }}>⚠️</div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Error Loading Data</h2>
      <p style={{ color: "var(--t2)", maxWidth: "400px" }}>
        {error}
      </p>
      <button 
        className="btn btnp" 
        style={{ padding: "12px 28px" }}
        onClick={loadData}
      >
        🔄 Retry
      </button>
    </div>
  )

  // No data yet
  if (!data || data.all_sessions?.length === 0) return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "center",
      alignItems:     "center",
      height:         "100vh",
      gap:            "20px",
      textAlign:      "center",
      padding:        "20px"
    }}>
      <div style={{ fontSize: "5rem" }}>📊</div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>No Data Yet</h2>
      <p style={{ color: "var(--t2)", maxWidth: "400px" }}>
        Complete at least one interview session to see your
        performance analytics here.
      </p>
      <Link to="/interview">
        <button className="btn btnp" style={{ padding: "12px 28px" }}>
          Start Your First Interview →
        </button>
      </Link>
    </div>
  )

  // Chart data
  const lineData = (data.all_sessions || [])
    .slice().reverse()
    .map((s, i) => ({
      session:    `S${i + 1}`,
      score:      Math.round(s.percentage),
      role:       s.role,
      grade:      s.grade
    }))

  const barData = (data.role_performance || []).map(r => ({
    role:  r.role.replace(" Developer", "").replace(" Engineer", ""),
    best:  Math.round(r.best),
    avg:   Math.round(r.avg)
  }))

  const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899"]

  const getGradeColor = (grade) => {
    if (grade === "A+" || grade === "A") return "#10b981"
    if (grade === "B")                   return "#06b6d4"
    if (grade === "C")                   return "#f59e0b"
    return "#ef4444"
  }

  const getScoreColor = (score) => {
    if (score >= 70) return "#10b981"
    if (score >= 50) return "#f59e0b"
    return "#ef4444"
  }

  const tabs = [
    { id: "overview",  label: "📈 Overview"   },
    { id: "history",   label: "🕒 History"    },
    { id: "roles",     label: "🎯 By Role"    },
    { id: "analysis",  label: "🔍 Analysis"   },
  ]

  return (
    <div style={{
      padding:   "28px",
      maxWidth:  "1200px",
      margin:    "0 auto",
      minHeight: "100vh"
    }}>

      {/* ── Header ── */}
      <motion.div
        style={{ marginBottom: "28px" }}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y:  0  }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "1.9rem", fontWeight: 800 }}>
              Performance <span className="gt">Analytics</span>
            </h1>
            <p style={{ color: "var(--t2)", marginTop: "4px", fontSize: ".9rem" }}>
              Track your progress and identify areas for improvement
            </p>
          </div>
          <Link to="/dashboard">
            <button className="btn btns" style={{ padding: "9px 18px", fontSize: ".88rem" }}>
              ← Back to Dashboard
            </button>
          </Link>
        </div>

        {/* Quick Stats */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap:                 "14px",
          marginTop:           "20px"
        }}>
          {[
            {
              icon:  "🎯",
              label: "Total Sessions",
              value: data.all_sessions?.length || 0,
              color: "#8b5cf6"
            },
            {
              icon:  "📊",
              label: "Average Score",
              value: `${Math.round(
                (data.all_sessions || []).reduce((a, s) => a + s.percentage, 0) /
                (data.all_sessions?.length || 1)
              )}%`,
              color: "#06b6d4"
            },
            {
              icon:  "🏆",
              label: "Best Score",
              value: `${Math.round(
                Math.max(...(data.all_sessions || [{ percentage: 0 }]).map(s => s.percentage))
              )}%`,
              color: "#10b981"
            },
            {
              icon:  "📉",
              label: "Weak Areas",
              value: data.weak_roles?.length || 0,
              color: "#ef4444"
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="glass"
              style={{ padding: "18px" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y:  0 }}
              transition={{ delay: i * .1 }}
              whileHover={{ y: -3 }}
            >
              <div style={{ fontSize: "1.6rem", marginBottom: "6px" }}>{s.icon}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--t2)", marginTop: "3px" }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <div style={{
        display:      "flex",
        gap:          "4px",
        marginBottom: "24px",
        background:   "rgba(255,255,255,.03)",
        borderRadius: "12px",
        padding:      "5px",
        border:       "1px solid var(--bdr)",
        flexWrap:     "wrap"
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex:         1,
              padding:      "10px 16px",
              borderRadius: "8px",
              border:       "none",
              background:   activeTab === tab.id
                              ? "linear-gradient(135deg,#8b5cf6,#06b6d4)"
                              : "transparent",
              color:        activeTab === tab.id ? "#fff" : "var(--t2)",
              cursor:       "pointer",
              fontSize:     ".85rem",
              fontWeight:   600,
              transition:   "all .3s",
              minWidth:     "100px"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {activeTab === "overview" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          {/* Score History Line Chart */}
          <div className="glass" style={{ padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "20px", fontSize: "1rem" }}>
              📈 Score Progress Over Time
            </h3>
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                  <XAxis dataKey="session" stroke="var(--t3)" fontSize={12}/>
                  <YAxis stroke="var(--t3)" fontSize={12} domain={[0, 100]}/>
                  <Tooltip
                    contentStyle={{
                      background:   "#1a1a2e",
                      border:       "1px solid var(--bdr)",
                      borderRadius: "10px"
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", r: 5, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--t2)", textAlign: "center", padding: "40px 0" }}>
                Complete more sessions to see progress chart.
              </p>
            )}
          </div>

          {/* Role Performance Bar Chart */}
          {barData.length > 0 && (
            <div className="glass" style={{ padding: "24px" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "20px", fontSize: "1rem" }}>
                🎯 Performance by Role
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                  <XAxis dataKey="role" stroke="var(--t3)" fontSize={11}/>
                  <YAxis stroke="var(--t3)" fontSize={11} domain={[0, 100]}/>
                  <Tooltip
                    contentStyle={{
                      background:   "#1a1a2e",
                      border:       "1px solid var(--bdr)",
                      borderRadius: "10px"
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: "12px" }}
                    iconType="square"
                  />
                  <Bar dataKey="best" name="Best Score" fill="#8b5cf6" radius={[6,6,0,0]} />
                  <Bar dataKey="avg" name="Average Score" fill="rgba(139,92,246,.4)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}

      {/* ── TAB: History ── */}
      {activeTab === "history" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <div className="glass" style={{ padding: "24px" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "18px", fontSize: "1rem" }}>
              🕒 All Interview Sessions
            </h3>

            {/* Table Header */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              gap:                 "12px",
              padding:             "10px 14px",
              background:          "rgba(255,255,255,.04)",
              borderRadius:        "8px",
              marginBottom:        "8px",
              fontSize:            ".78rem",
              color:               "var(--t3)",
              fontWeight:          700,
              textTransform:       "uppercase",
              letterSpacing:       ".5px"
            }}>
              <div>Role</div>
              <div>Type</div>
              <div>Score</div>
              <div>Grade</div>
              <div>Date</div>
            </div>

            {/* Table Rows */}
            {(data.all_sessions || []).map((s, i) => (
              <motion.div
                key={i}
                style={{
                  display:             "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  gap:                 "12px",
                  padding:             "12px 14px",
                  borderRadius:        "10px",
                  background:          "rgba(255,255,255,.02)",
                  marginBottom:        "8px",
                  border:              "1px solid var(--bdr)",
                  alignItems:          "center"
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x:  0  }}
                transition={{ delay: i * .05 }}
                whileHover={{ borderColor: "rgba(139,92,246,.3)" }}
              >
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{s.role}</div>
                <div>
                  <span style={{
                    background:   "rgba(139,92,246,.15)",
                    border:       "1px solid rgba(139,92,246,.3)",
                    borderRadius: "6px",
                    padding:      "3px 8px",
                    fontSize:     ".75rem",
                    color:        "var(--pl)"
                  }}>
                    {s.interview_type || s.type || "Interview"}
                  </span>
                </div>
                <div style={{
                  fontWeight: 800,
                  fontSize:   ".95rem",
                  color:      getScoreColor(s.percentage)
                }}>
                  {Math.round(s.percentage)}%
                </div>
                <div>
                  <span style={{
                    background:   `${getGradeColor(s.grade)}22`,
                    border:       `1px solid ${getGradeColor(s.grade)}`,
                    borderRadius: "6px",
                    padding:      "3px 10px",
                    fontSize:     ".82rem",
                    fontWeight:   700,
                    color:        getGradeColor(s.grade)
                  }}>
                    {s.grade}
                  </span>
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--t2)" }}>
                  {new Date(s.created_at).toLocaleDateString("en-IN", {
                    day:   "numeric",
                    month: "short",
                    year:  "numeric"
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── TAB: By Role ── */}
      {activeTab === "roles" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          {(data.role_performance || []).length === 0 ? (
            <div className="glass" style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎯</div>
              <p style={{ color: "var(--t2)" }}>
                Complete interviews in different roles to see role-wise analytics.
              </p>
            </div>
          ) : (
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap:                 "16px"
            }}>
              {(data.role_performance || []).map((r, i) => {
                const color = COLORS[i % COLORS.length]
                return (
                  <motion.div
                    key={i}
                    className="glass"
                    style={{ padding: "22px" }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y:  0 }}
                    transition={{ delay: i * .1 }}
                    whileHover={{ y: -4 }}
                  >
                    <div style={{
                      display:        "flex",
                      justifyContent: "space-between",
                      alignItems:     "flex-start",
                      marginBottom:   "16px"
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{r.role}</div>
                        <div style={{ fontSize: ".78rem", color: "var(--t2)", marginTop: "2px" }}>
                          Performance Analysis
                        </div>
                      </div>
                      <div style={{
                        background:   `${color}22`,
                        border:       `1px solid ${color}`,
                        borderRadius: "8px",
                        padding:      "4px 10px",
                        fontSize:     ".75rem",
                        fontWeight:   700,
                        color:        color
                      }}>
                        {Math.round(r.best)}% Best
                      </div>
                    </div>

                    {/* Best Score Bar */}
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{
                        display:        "flex",
                        justifyContent: "space-between",
                        fontSize:       ".78rem",
                        color:          "var(--t2)",
                        marginBottom:   "5px"
                      }}>
                        <span>Best Score</span>
                        <span style={{ color }}>{Math.round(r.best)}%</span>
                      </div>
                      <div style={{
                        height:       "8px",
                        background:   "rgba(255,255,255,.08)",
                        borderRadius: "10px",
                        overflow:     "hidden"
                      }}>
                        <motion.div
                          style={{
                            height:       "100%",
                            background:   color,
                            borderRadius: "10px"
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${r.best}%` }}
                          transition={{ duration: .8, delay: i * .1 }}
                        />
                      </div>
                    </div>

                    {/* Avg Score Bar */}
                    <div>
                      <div style={{
                        display:        "flex",
                        justifyContent: "space-between",
                        fontSize:       ".78rem",
                        color:          "var(--t2)",
                        marginBottom:   "5px"
                      }}>
                        <span>Average Score</span>
                        <span>{Math.round(r.avg)}%</span>
                      </div>
                      <div style={{
                        height:       "8px",
                        background:   "rgba(255,255,255,.08)",
                        borderRadius: "10px",
                        overflow:     "hidden"
                      }}>
                        <motion.div
                          style={{
                            height:       "100%",
                            background:   "rgba(255,255,255,.25)",
                            borderRadius: "10px"
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${r.avg}%` }}
                          transition={{ duration: .8, delay: i * .1 + .2 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── TAB: Analysis ── */}
      {activeTab === "analysis" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap:                 "20px"
          }}>

            {/* Strengths */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(16,185,129,.05)",
              border:     "1px solid rgba(16,185,129,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#10b981" }}>
                ✅ Strong Areas
              </h3>
              {(data.role_performance || [])
                .filter(r => r.avg >= 70)
                .length === 0 ? (
                <p style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                  Keep practicing to identify your strong areas!
                </p>
              ) : (
                (data.role_performance || [])
                  .filter(r => r.avg >= 70)
                  .map((r, i) => (
                    <div key={i} style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          "10px",
                      padding:      "10px",
                      borderRadius: "8px",
                      background:   "rgba(16,185,129,.08)",
                      marginBottom: "8px"
                    }}>
                      <span style={{ color: "#10b981", fontSize: "1.2rem" }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{r.role}</div>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                          Avg: {Math.round(r.avg)}%
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Weak Areas */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(239,68,68,.05)",
              border:     "1px solid rgba(239,68,68,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#ef4444" }}>
                ⚠️ Areas to Improve
              </h3>
              {(data.weak_roles || []).length === 0 ? (
                <p style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                  No weak areas detected — great performance!
                </p>
              ) : (
                (data.weak_roles || []).map((r, i) => (
                  <div key={i} style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "10px",
                    padding:      "10px",
                    borderRadius: "8px",
                    background:   "rgba(239,68,68,.08)",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{r}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                        Needs more practice
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recommendations */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(139,92,246,.05)",
              border:     "1px solid rgba(139,92,246,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "var(--pl)" }}>
                💡 Recommendations
              </h3>
              {[
                "Practice weak role topics daily for 30 minutes",
                "Review AI feedback from previous sessions",
                "Focus on giving examples in your answers",
                "Build projects related to your target role",
                "Take at least 2-3 mock interviews per week",
              ].map((tip, i) => (
                <div key={i} style={{
                  display:      "flex",
                  gap:          "10px",
                  padding:      "8px 0",
                  borderBottom: i < 4 ? "1px solid rgba(255,255,255,.05)" : "none"
                }}>
                  <span style={{ color: "var(--pl)", fontWeight: 700, minWidth: "20px" }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: ".88rem", color: "var(--t2)", lineHeight: 1.5 }}>
                    {tip}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="glass" style={{ padding: "24px" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>
                🚀 Quick Actions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link to="/interview">
                  <button className="btn btnp" style={{ width: "100%", padding: "12px" }}>
                    🤖 Start New Interview
                  </button>
                </Link>
                <Link to="/coding">
                  <button className="btn" style={{
                    width:      "100%",
                    padding:    "12px",
                    background: "linear-gradient(135deg,#06b6d4,#0891b2)",
                    color:      "#fff",
                    fontWeight: 700
                  }}>
                    💻 Practice Coding
                  </button>
                </Link>
                <Link to="/dashboard">
                  <button className="btn btns" style={{ width: "100%", padding: "12px" }}>
                    📊 Go to Dashboard
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}