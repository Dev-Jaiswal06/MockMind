// frontend/src/pages/Reports.jsx
import { useState, useEffect, useCallback, useRef } from "react"
import { Link, useNavigate }  from "react-router-dom"
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
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [codingData, setCodingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [modalCode, setModalCode] = useState({ code: "", lang: "", title: "" })
  const [reviewSession, setReviewSession] = useState(null)
  const [reviewData,  setReviewData]     = useState(null)
  const [reviewLoad,  setReviewLoad]     = useState(false)
  const fetched = useRef(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      API.get("/api/reports/performance"),
      API.get("/api/coding/history").catch(() => ({ data: {} }))
    ])
      .then(([r, c]) => { 
        setData(r.data)
        setCodingData(c.data)
        setLoading(false) 
      })
      .catch(err => { 
        setError(err.message || "Failed to load performance data")
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    loadData()
  }, [loadData])  

  const openReview = async (sid) => {
    setReviewSession(sid)
    setReviewData(null)
    setReviewLoad(true)
    try {
      const r = await API.get(`/api/interview/session/${sid}`)
      setReviewData(r.data)
    } catch (err) {
      setReviewData({ error: err.message || "Failed to load session" })
    } finally {
      setReviewLoad(false)
    }
  }  

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

  // ── Derived metrics (client-side, 0 backend calls) ──
  const sessions  = data.all_sessions || []
  const lineScores = lineData.map(d => d.score)
  const lineMinY  = lineScores.length ? Math.max(0, Math.floor((Math.min(...lineScores) - 10) / 10) * 10) : 0
  const barScores = barData.flatMap(r => [r.avg, r.best])
  const barMinY   = barScores.length ? Math.max(0, Math.floor((Math.min(...barScores) - 10) / 10) * 10) : 0

  const avgPct   = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.percentage, 0) / sessions.length) : 0
  const bestPct  = sessions.length ? Math.round(Math.max(...sessions.map(s => s.percentage))) : 0
  const firstPct = sessions.length ? Math.round(sessions[sessions.length - 1].percentage) : 0
  const lastPct  = sessions.length ? Math.round(sessions[0].percentage) : 0
  const improv   = sessions.length >= 2 ? lastPct - firstPct : null
  const recent   = sessions.slice(0, 5)

  const COLORS = ["#2563eb","#0ea5e9","#16a34a","#f59e0b","#ef4444","#ec4899"]

  const getGradeColor = (grade) => {
    if (grade === "A+" || grade === "A") return "#16a34a"
    if (grade === "B")                   return "#f59e0b"
    if (grade === "C")                   return "#f59e0b"
    return "#ef4444"
  }

  const getScoreColor = (score) => {
    if (score >= 70) return "#16a34a"
    if (score >= 50) return "#f59e0b"
    return "#ef4444"
  }

  const timeAgo = (dateStr) => {
    if (!dateStr) return ""
    const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (seconds < 60)    return "few seconds ago"
    if (seconds < 3600)  return `${Math.floor(seconds / 60)} min ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const tabs = [
    { id: "overview",  label: "📈 Overview"         },
    { id: "interview", label: "🕒 Interview"        },
    { id: "coding",    label: "💻 Coding"           },
    { id: "roles",     label: "🎯 By Role Interviews" },
    { id: "analysis",  label: "🔍 Analysis"         },
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

        {/* Your Performance */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap:                 "14px",
          marginTop:           "20px"
        }}>
          {[
            { icon:  "🎯", label: "Total Sessions", value: sessions.length, color: "var(--pl)" },
            { icon:  "📊", label: "Average Score",  value: `${avgPct}%`,    color: "#f59e0b" },
            { icon:  "🏆", label: "Best Score",     value: `${bestPct}%`,   color: "var(--pl)" },
            {
              icon:  "📈",
              label: "Improvement",
              value: improv === null ? "—" : `${improv >= 0 ? "↑" : "↓"} ${Math.abs(improv)} pts`,
              color: improv === null ? "var(--t2)" : improv >= 0 ? "#16a34a" : "#ef4444",
              sub:   improv === null ? "Complete 2 sessions" : ""
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
              {s.sub && (
                <div style={{ fontSize: ".7rem", color: "var(--t3)", marginTop: "2px" }}>{s.sub}</div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Recent performance */}
        {recent.length > 1 && (
          <div className="glass" style={{
            marginTop: "14px", padding: "12px 18px",
            display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap"
          }}>
            <span style={{ fontSize: ".8rem", color: "var(--t2)", fontWeight: 700 }}>
              Recent:
            </span>
            {recent.map((s2, i) => (
              <span key={i} style={{
                fontSize: ".74rem", padding: "4px 12px", borderRadius: "20px",
                background: "var(--card2)", border: "1px solid var(--bdr)"
              }}>
                <span style={{ fontWeight: 700, color: getScoreColor(s2.percentage) }}>
                  {Math.round(s2.percentage)}%
                </span>
                {" "}· {s2.role?.replace(" Developer", "").replace(" Engineer", "")}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Tabs ── */}
      <div style={{
        display:      "flex",
        gap:          "4px",
        marginBottom: "24px",
        background:   "var(--card2)",
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
                              ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)"/>
                  <XAxis dataKey="session" stroke="var(--t3)" fontSize={12}/>
                  <YAxis stroke="var(--t3)" fontSize={12} domain={[lineMinY, 100]}/>
                  <Tooltip
                    contentStyle={{
                      background:   "var(--bg2)",
                      border:       "1px solid var(--bdr)",
                      borderRadius: "10px",
                      boxShadow:    "var(--shadow-lg)"
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ fill: "#2563eb", r: 5, strokeWidth: 2, stroke: "#fff" }}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)"/>
                  <XAxis dataKey="role" stroke="var(--t3)" fontSize={11}/>
                  <YAxis stroke="var(--t3)" fontSize={11} domain={[barMinY, 100]}/>
                  <Tooltip
                    contentStyle={{
                      background:   "var(--bg2)",
                      border:       "1px solid var(--bdr)",
                      borderRadius: "10px",
                      boxShadow:    "var(--shadow-lg)"
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: "12px" }}
                    iconType="square"
                  />
                  <Bar dataKey="best" name="Best Score" fill="#2563eb" radius={[6,6,0,0]} />
                  <Bar dataKey="avg" name="Average Score" fill="rgba(37,99,235,.4)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}

      {/* ── TAB: Interview ── */}
      {activeTab === "interview" && (
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
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto",
              gap:                 "12px",
              padding:             "10px 14px",
              background:          "var(--bg2)",
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
              <div>Time</div>
              <div>Date</div>
              <div>Action</div>
            </div>

            {/* Table Rows */}
            {(data.all_sessions || []).map((s, i) => (
              <motion.div
                key={i}
                style={{
                  display:             "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto",
                  gap:                 "12px",
                  padding:             "12px 14px",
                  borderRadius:        "10px",
                  background:          "var(--card2)",
                  marginBottom:        "8px",
                  border:              "1px solid var(--bdr)",
                  alignItems:          "center"
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x:  0  }}
                transition={{ delay: i * .05 }}
                whileHover={{ borderColor: "rgba(37,99,235,.3)" }}
              >
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{s.role}</div>
                <div>
                  <span style={{
                    background:   "rgba(37,99,235,.15)",
                    border:       "1px solid rgba(37,99,235,.3)",
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
                  {Math.floor((s.time_taken || 0) / 60)}m {(s.time_taken || 0) % 60}s
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--t2)" }}>
                  {new Date(s.created_at).toLocaleDateString("en-IN", {
                    day:   "numeric",
                    month: "short",
                    year:  "numeric"
                  })}
                </div>
                <button
                  onClick={() => openReview(s.id)}
                  style={{
                    background: "var(--acc)",
                    border:     "1px solid rgba(37,99,235,.25)",
                    color:      "var(--pl)",
                    borderRadius: "8px",
                    padding:    "6px 12px",
                    fontSize:   ".75rem",
                    fontWeight: 700,
                    cursor:     "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  📋 Review
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── TAB: Coding ── */}
      {activeTab === "coding" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <div className="glass" style={{ padding: "24px" }}>
            {/* Stats Row */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: ".78rem", color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Solved</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#16a34a" }}>
                  {codingData?.solved?.length || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: ".78rem", color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px" }}>Languages</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--pl)" }}>
                  {(() => {
                    const langs = {}
                    ;(codingData?.submissions || []).forEach(s => { langs[s.language] = (langs[s.language] || 0) + 1 })
                    return Object.entries(langs).map(([l, c]) => `${l.toUpperCase()}(${c})`).join(", ") || "N/A"
                  })()}
                </div>
              </div>
            </div>

            <h3 style={{ fontWeight: 700, marginBottom: "18px", fontSize: "1rem" }}>
              💻 Solved Problems ({codingData?.submissions?.length || 0})
            </h3>

            {/* Table Header */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              gap:                 "12px",
              padding:             "10px 14px",
              background:          "var(--bg2)",
              borderRadius:        "8px",
              marginBottom:        "8px",
              fontSize:            ".78rem",
              color:               "var(--t3)",
              fontWeight:          700,
              textTransform:       "uppercase",
              letterSpacing:       ".5px"
            }}>
              <div>Problem</div>
              <div>Language</div>
              <div>Score</div>
              <div>When</div>
              <div>Action</div>
            </div>

            {/* Rows */}
            {(codingData?.submissions || []).length === 0 ? (
              <p style={{ color: "var(--t2)", textAlign: "center", padding: "30px 0" }}>
                No solved problems yet. Start coding to see your history!
              </p>
            ) : (
              (codingData?.submissions || []).map((s, i) => (
                <motion.div
                  key={i}
                  style={{
                    display:             "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    gap:                 "12px",
                    padding:             "12px 14px",
                    borderRadius:        "10px",
                    background:          "var(--card2)",
                    marginBottom:        "8px",
                    border:              "1px solid var(--bdr)",
                    alignItems:          "center"
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x:  0  }}
                  transition={{ delay: i * .05 }}
                  whileHover={{ borderColor: "rgba(37,99,235,.3)" }}
                >
                  <div
                    style={{ fontWeight: 600, fontSize: ".88rem", color: "#16a34a", cursor: "pointer" }}
                    onClick={() => navigate("/coding?problem=" + encodeURIComponent(s.title))}
                  >
                    ✅ {s.title}
                  </div>
                  <div>
                    <span style={{
                      background:   "rgba(37,99,235,.15)",
                      border:       "1px solid rgba(37,99,235,.3)",
                      borderRadius: "6px",
                      padding:      "3px 8px",
                      fontSize:     ".75rem",
                      color:        "var(--pl)"
                    }}>
                      {s.language?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#16a34a" }}>
                    {s.test_passed}/{s.test_total}
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--t2)" }}>
                    {timeAgo(s.created_at)}
                  </div>
                  <div>
                    <button
                      onClick={() => { setModalCode({ code: s.code, lang: s.language, title: s.title }); setShowCodeModal(true) }}
                      style={{
                        background:   "rgba(129,140,248,.12)",
                        border:       "1px solid rgba(129,140,248,.3)",
                        borderRadius: "6px",
                        padding:      "4px 10px",
                        fontSize:     ".75rem",
                        fontWeight:   700,
                        color:        "#818cf8",
                        cursor:       "pointer"
                      }}
                    >
                      View Code
                    </button>
                  </div>
                </motion.div>
              ))
            )}
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
              background: "rgba(22,163,74,.05)",
              border:     "1px solid rgba(22,163,74,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#16a34a" }}>
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
                      background:   "rgba(22,163,74,.08)",
                      marginBottom: "8px"
                    }}>
                      <span style={{ color: "#16a34a", fontSize: "1.2rem" }}>✅</span>
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

            {/* Weak Topics */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(168,85,247,.05)",
              border:     "1px solid rgba(168,85,247,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#a855f7" }}>
                🎯 Weak Topics (Adaptive)
              </h3>
              {(data.weak_topics || []).length === 0 ? (
                <p style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                  No weak topics recorded yet. Complete an interview to build your profile.
                </p>
              ) : (
                (data.weak_topics || []).slice(0, 8).map((wt, i) => (
                  <div key={i} style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "10px",
                    padding:      "10px",
                    borderRadius: "8px",
                    background:   "rgba(168,85,247,.08)",
                    marginBottom: "8px"
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{wt.topic}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                        {wt.count} time{wt.count > 1 ? "s" : ""} below 4/10 · {wt.role}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <p style={{ fontSize: ".75rem", color: "var(--t3)", marginTop: "12px" }}>
                These topics are now prioritized in your next AI interview.
              </p>
            </div>

            {/* Coding Strengths */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(22,163,74,.05)",
              border:     "1px solid rgba(22,163,74,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#16a34a" }}>
                💻 Coding Strengths
              </h3>
              {(codingData?.solved?.length || 0) === 0 ? (
                <p style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                  Solve coding problems to see your strengths!
                </p>
              ) : (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px", borderRadius: "8px", background: "rgba(22,163,74,.08)", marginBottom: "8px"
                  }}>
                    <span style={{ color: "#16a34a", fontSize: "1.2rem" }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                        {codingData?.solved?.length || 0} Problems Solved
                      </div>
                      <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                        {(() => {
                          const langs = {}
                          ;(codingData?.submissions || []).forEach(s => { langs[s.language] = (langs[s.language] || 0) + 1 })
                          return "Languages: " + Object.entries(langs).map(([l]) => l.toUpperCase()).join(", ")
                        })()}
                      </div>
                    </div>
                  </div>
                  {(codingData?.submissions || []).length >= 5 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px", borderRadius: "8px", background: "rgba(22,163,74,.08)"
                    }}>
                      <span style={{ color: "#16a34a", fontSize: "1.2rem" }}>🏆</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".88rem" }}>100% Pass Rate</div>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                          All submissions passed all test cases
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Coding Areas to Improve */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(245,158,11,.05)",
              border:     "1px solid rgba(245,158,11,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#f59e0b" }}>
                ⚠️ Coding Areas to Improve
              </h3>
              {(codingData?.solved?.length || 0) === 0 ? (
                <p style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                  Start solving problems to track your progress!
                </p>
              ) : (
                <>
                  {(codingData?.solved?.length || 0) < 5 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px", borderRadius: "8px", background: "rgba(245,158,11,.08)", marginBottom: "8px"
                    }}>
                      <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".88rem" }}>More Practice Needed</div>
                        <div style={{ fontSize: ".75rem", color: "var(--t2)" }}>
                          Solved {codingData?.solved?.length || 0} problems — aim for at least 10
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Coding Recommendations */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(129,140,248,.05)",
              border:     "1px solid rgba(129,140,248,.2)"
            }}>
              <h3 style={{ fontWeight: 700, marginBottom: "16px", color: "#818cf8" }}>
                💡 Coding Recommendations
              </h3>
              {[
                "Practice at least 1-2 coding problems daily",
                "Try solving problems in multiple languages",
                "Focus on understanding time and space complexity",
                "Review and optimize your solutions after solving",
                "Gradually move from easy to medium difficulty",
              ].map((tip, i) => (
                <div key={i} style={{
                  display:      "flex",
                  gap:          "10px",
                  padding:      "8px 0",
                  borderBottom: i < 4 ? "1px solid rgba(255,255,255,.05)" : "none"
                }}>
                  <span style={{ color: "#818cf8", fontWeight: 700, minWidth: "20px" }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: ".88rem", color: "var(--t2)", lineHeight: 1.5 }}>
                    {tip}
                  </span>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="glass" style={{
              padding:    "24px",
              background: "rgba(37,99,235,.05)",
              border:     "1px solid rgba(37,99,235,.2)"
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
                    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
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

      {/* ── View Code Modal ── */}
      {showCodeModal && (
        <div style={{
          position:      "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background:    "rgba(0,0,0,.6)",
          zIndex:        1000,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          padding:       "20px"
        }} onClick={() => setShowCodeModal(false)}>
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
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "16px 20px",
              borderBottom:   "1px solid var(--bdr)",
              background:     "var(--bg2)"
            }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                👁️ {modalCode.title} — {modalCode.lang?.toUpperCase()}
              </span>
              <button
                onClick={() => setShowCodeModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--t2)", fontSize: "1.3rem", cursor: "pointer" }}
              >✕</button>
            </div>
            <pre style={{
              padding:        "20px",
              margin:         0,
              overflow:       "auto",
              fontSize:       ".85rem",
              fontFamily:     "JetBrains Mono, Fira Code, monospace",
              background:     "var(--bg)",
              color:          "var(--t1)",
              lineHeight:     1.6,
              whiteSpace:     "pre-wrap",
              wordBreak:      "break-word"
            }}>
              {modalCode.code}
            </pre>
          </div>
        </div>
      )}

      {/* ── Interview Session Review Modal ── */}
      {reviewSession && (
        <div style={{
          position:      "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background:    "rgba(0,0,0,.6)",
          zIndex:        1000,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          padding:       "20px"
        }} onClick={() => setReviewSession(null)}>
          <div
            style={{
              background:   "var(--card)",
              border:       "1px solid var(--bdr)",
              borderRadius: "16px",
              width:        "760px",
              maxWidth:     "95vw",
              maxHeight:    "88vh",
              display:      "flex",
              flexDirection:"column",
              overflow:     "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "16px 20px",
              borderBottom:   "1px solid var(--bdr)",
              background:     "var(--bg2)"
            }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                📋 {reviewData?.session?.role || "Interview"} — Review
              </span>
              <button
                onClick={() => setReviewSession(null)}
                style={{ background: "transparent", border: "none", color: "var(--t2)", fontSize: "1.3rem", cursor: "pointer" }}
              >✕</button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {reviewLoad && (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t2)" }}>
                  <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 12px" }}/>
                  Loading session report...
                </div>
              )}

              {!reviewLoad && reviewData?.error && (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--err)" }}>
                  Failed to load this session.
                </div>
              )}

              {!reviewLoad && reviewData?.session && (() => {
                const s  = reviewData.session
                const sc = Number(s.percentage || 0)
                const gc = s.grade === "A+" || s.grade === "A" ? "#16a34a"
                         : s.grade === "B" || s.grade === "C" ? "#f59e0b"
                         : "#ef4444"
                return (
                  <>
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: "10px",
                      padding: "14px", borderRadius: "10px",
                      background: "var(--bg2)", border: "1px solid var(--bdr)",
                      marginBottom: "16px", fontSize: ".85rem"
                    }}>
                      <span style={{ fontWeight: 800, color: getScoreColor(sc) }}>
                        Score: {Math.round(sc)}%
                      </span>
                      <span style={{
                        background: `${gc}22`, border: `1px solid ${gc}`,
                        borderRadius: "6px", padding: "2px 10px",
                        fontWeight: 700, color: gc
                      }}>
                        {s.grade}
                      </span>
                      <span style={{ color: "var(--t2)" }}>
                        {s.interview_type || s.type || "Interview"}
                        {s.round_type ? ` · ${s.round_type}` : ""}
                      </span>
                      <span style={{ color: "var(--t2)" }}>
                        {Math.floor((s.time_taken || 0) / 60)}m {(s.time_taken || 0) % 60}s
                      </span>
                      <span style={{ color: "var(--t2)" }}>
                        {s.total_questions || reviewData.qa_list?.length || 0} questions
                      </span>
                      <span style={{ color: "var(--t2)" }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </span>
                    </div>

                    {(s.skills_breakdown || []).length > 0 && (
                      <div style={{
                        padding: "14px 16px", borderRadius: "10px",
                        background: "var(--bg2)", border: "1px solid var(--bdr)",
                        marginBottom: "16px"
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: "12px", fontSize: ".9rem" }}>
                          🧩 Performance Breakdown
                        </div>
                        <div style={{
                          display:             "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap:                 "12px"
                        }}>
                          {(s.skills_breakdown || []).map((sk, i) => {
                            const p = Math.round(sk.percentage || 0)
                            const c = p >= 70 ? "#16a34a" : p >= 40 ? "#f59e0b" : "#ef4444"
                            return (
                              <div key={i}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: ".8rem" }}>
                                  <span style={{ fontWeight: 600, color: "var(--t1)" }}>{sk.skill}</span>
                                  <span style={{ fontWeight: 800, color: c }}>{p}%</span>
                                </div>
                                <div style={{ height: "7px", background: "rgba(255,255,255,.06)", borderRadius: "6px", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${p}%`, background: c, borderRadius: "6px" }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(reviewData.qa_list || []).map((qa, i) => {
                      const score   = Number(qa.score ?? 0)
                      const hasSug  = !!(qa.good_points || qa.improve || qa.hint)
                      const scoreColor = score >= 7 ? "#16a34a" : score >= 5 ? "#f59e0b" : "#ef4444"
                      const scoreBg    = score >= 7 ? "rgba(22,163,74,.15)" : score >= 5 ? "rgba(245,158,11,.15)" : "rgba(239,68,68,.15)"
                      return (
                        <div key={i} style={{
                          padding: "16px", borderRadius: "10px",
                          background: "rgba(255,255,255,.03)",
                          border: "1px solid var(--bdr)", marginBottom: "10px"
                        }}>
                          <div style={{ fontWeight: 600, color: "var(--pl)", marginBottom: "8px", fontSize: ".88rem" }}>
                            Q{i + 1}: {qa.question}
                          </div>
                          <div style={{
                            padding: "8px", borderRadius: "6px",
                            background: "rgba(255,255,255,.03)",
                            color: "var(--t2)", fontSize: ".84rem",
                            marginBottom: "8px", lineHeight: 1.5
                          }}>
                            {qa.answer || "No answer provided"}
                          </div>
                          {qa.example && (
                            <div style={{
                              padding: "8px", borderRadius: "6px",
                              background: "rgba(16,185,129,.05)",
                              border: "1px solid rgba(16,185,129,.2)",
                              color: "var(--t2)", fontSize: ".82rem",
                              marginBottom: "8px", lineHeight: 1.5,
                              fontFamily: "'JetBrains Mono','Fira Code',monospace",
                              whiteSpace: "pre-wrap", wordBreak: "break-word"
                            }}>
                              <span style={{ fontWeight: 700, color: "#10b981" }}>Example/Code:</span> {qa.example}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: hasSug ? 10 : 0 }}>
                            <span style={{
                              background: scoreBg, color: scoreColor,
                              border: `1px solid ${scoreColor}`,
                              borderRadius: "6px", padding: "3px 10px",
                              fontSize: ".78rem", fontWeight: 700, flexShrink: 0
                            }}>
                              {score}/10
                            </span>
                            {qa.feedback && (
                              <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>{qa.feedback}</span>
                            )}
                          </div>
                          {hasSug && (
                            <div style={{ marginTop: "6px", fontSize: ".82rem", lineHeight: 1.6 }}>
                              {qa.good_points && qa.good_points !== "—" && (
                                <div style={{ marginBottom: "6px" }}>
                                  <span style={{ fontWeight: 700, color: "#16a34a" }}>+ </span>
                                  <span style={{ color: "var(--t2)" }}>{qa.good_points}</span>
                                </div>
                              )}
                              {qa.improve && (
                                <div style={{ marginBottom: "6px" }}>
                                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>↗ </span>
                                  <span style={{ color: "var(--t2)" }}>{qa.improve}</span>
                                </div>
                              )}
                              {qa.hint && qa.hint !== qa.improve && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--pl)" }}>💡 </span>
                                  <span style={{ color: "var(--t2)" }}>{qa.hint}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {!(reviewData.qa_list || []).length && (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--t2)", fontSize: ".9rem" }}>
                        No answers were recorded for this session.
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}