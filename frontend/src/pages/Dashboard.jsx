import { useState, useEffect, useRef }  from "react"
import { Link }                  from "react-router-dom"
import { motion }                from "framer-motion"
import { useAuth }               from "../context/AuthContext"
import API                       from "../utils/api"
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [data, setData]  = useState(null)
  const [load, setLoad]  = useState(true)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    API.get("/api/reports/dashboard")
      .then(r => { setData(r.data); setLoad(false) })
      .catch(()  => setLoad(false))
  }, [])

  const st        = data?.stats || {}
  const chartData = (data?.chart_data || []).map((d, i) => ({
    session: `S${i + 1}`,
    score:   Math.round(d.percentage),
    role:    d.role
  }))

  if (load) return (
    <div style={{ padding:"28px", maxWidth:"1400px", margin:"0 auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"16px", marginBottom:"28px" }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height:"120px", borderRadius:"16px" }}/>
        ))}
      </div>
      <div className="skeleton" style={{ height:"280px", borderRadius:"16px", marginBottom:"20px" }}/>
      <div className="skeleton" style={{ height:"200px", borderRadius:"16px" }}/>
    </div>
  )

  const statCards = [
    { icon:"🎯", label:"Total Interviews",    value: st.total_interviews   || 0,        color:"#8b5cf6" },
    { icon:"📊", label:"Average Score",       value: `${Math.round(st.avg_interview_score || 0)}%`, color:"#06b6d4" },
    { icon:"💻", label:"Coding Attempts",     value: st.total_coding       || 0,        color:"#10b981" },
    { icon:"🏆", label:"Best Performing Role",value: st.best_role          || "N/A",    color:"#f59e0b" },
  ]

  const modules = [
    {
      icon:  "🤖",
      title: "AI Mock Interview",
      desc:  "Practice with 100% AI-generated questions. Choose role-based or resume-based interview mode.",
      link:  "/interview",
      bg:    "rgba(139,92,246,.12)",
      bdr:   "rgba(139,92,246,.3)",
      btn:   "var(--grad)",
      label: "Start Interview"
    },
    {
      icon:  "💻",
      title: "Coding Assessment",
      desc:  "Solve AI-generated coding problems in 5 languages with real-time code execution.",
      link:  "/coding",
      bg:    "rgba(6,182,212,.12)",
      bdr:   "rgba(6,182,212,.3)",
      btn:   "linear-gradient(135deg,#06b6d4,#0891b2)",
      label: "Start Coding"
    },
    {
      icon:  "📊",
      title: "Performance Analytics",
      desc:  "View detailed reports — strengths, weaknesses, and personalized recommendations.",
      link:  "/reports",
      bg:    "rgba(245,158,11,.12)",
      bdr:   "rgba(245,158,11,.3)",
      btn:   "linear-gradient(135deg,#f59e0b,#d97706)",
      label: "View Reports"
    },
  ]

  return (
    <div style={{ padding:"28px", maxWidth:"1400px", margin:"0 auto" }}>

      {/* Header */}
      <motion.div
        style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          marginBottom:   "28px",
          flexWrap:       "wrap",
          gap:            "14px"
        }}
        initial={{ opacity:0, y:-15 }}
        animate={{ opacity:1, y:0 }}
      >
        <div>
          <h1 style={{ fontSize:"2.1rem", fontWeight:800 }}>
            Welcome, <span className="gt">{user?.name}!</span>
          </h1>
          <p style={{ color:"var(--t2)", marginTop:"4px", fontSize:".95rem" }}>
            Ready for your next practice session?
          </p>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div style={{
        display:               "grid",
        gridTemplateColumns:   "repeat(auto-fill, minmax(200px, 1fr))",
        gap:                   "16px",
        marginBottom:          "28px"
      }}>
        {statCards.map((c, i) => (
          <motion.div
            key={i}
            className="glass"
            style={{ padding: "26px" }}
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: i * .1 }}
            whileHover={{ y:-3 }}
          >
            <div style={{
              width:"52px",height:"52px",borderRadius:"14px",
              background:`${c.color}18`,
              border:`1px solid ${c.color}33`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"1.5rem",marginBottom:"12px"
            }}>{c.icon}</div>
            <div style={{ fontSize:"2rem", fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:".9rem", color:"var(--t2)", marginTop:"4px" }}>{c.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div style={{
        display:               "grid",
        gridTemplateColumns:   "repeat(auto-fit, minmax(280px, 1fr))",
        gap:                   "20px",
        alignItems:            "stretch",
        marginBottom:          "28px"
      }}>
        {modules.map((m, i) => (
          <motion.div
            key={i}
            className="glass"
            style={{
              display:       "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight:     "300px",
              padding:       "32px",
              background:    m.bg,
              border:        `1px solid ${m.bdr}`
            }}
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: .1 + i * .1 }}
            whileHover={{ y:-5 }}
          >
            <div style={{ fontSize:"3.2rem", marginBottom:"14px" }}>{m.icon}</div>
            <h2 style={{ fontSize:"1.5rem", fontWeight:700, marginBottom:"10px" }}>{m.title}</h2>
            <p style={{ color:"var(--t2)", fontSize:".95rem", marginBottom:"20px", lineHeight:1.6 }}>
              {m.desc}
            </p>
            <Link to={m.link}>
              <button className="btn" style={{
                background: m.btn,
                color:      "#fff",
                padding:    "13px 0",
                width:      "100%",
                fontSize:   ".95rem",
                fontWeight: 700
              }}>
                {m.label} →
              </button>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <motion.div
          className="glass"
          style={{ padding:"24px", marginBottom:"20px" }}
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:.4 }}
        >
          <h3 style={{ fontWeight:700, marginBottom:"18px", fontSize:"1.1rem" }}>
            📈 Interview Score History
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)"/>
              <XAxis dataKey="session" stroke="var(--t3)" fontSize={11}/>
              <YAxis stroke="var(--t3)" fontSize={11} domain={[0, 100]}/>
              <Tooltip contentStyle={{
                background:   "var(--bg2)",
                border:       "1px solid var(--bdr)",
                borderRadius: "8px"
              }}/>
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ fill:"#8b5cf6", r:4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Recent Interviews */}
      {data?.recent_interviews?.length > 0 && (
        <motion.div
          className="glass"
          style={{ padding:"24px" }}
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:.5 }}
        >
          <h3 style={{ fontWeight:700, marginBottom:"14px", fontSize:"1.1rem" }}>
            🕒 Recent Interview Sessions
          </h3>
          {data.recent_interviews.map((s, i) => (
            <div key={i} style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              padding:        "14px",
              borderRadius:   "10px",
              background:     "var(--card2)",
              marginBottom:   "9px",
              border:         "1px solid var(--bdr)"
            }}>
              <div>
                <div style={{ fontWeight:600, fontSize:".95rem" }}>{s.role}</div>
                <div style={{ fontSize:".8rem", color:"var(--t2)" }}>
                  {new Date(s.created_at).toLocaleDateString("en-IN", {
                    day:"numeric", month:"short", year:"numeric"
                  })}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{
                  fontSize:   "1.35rem",
                  fontWeight: 800,
                  color:      s.percentage >= 70 ? "#10b981"
                            : s.percentage >= 50 ? "#f59e0b"
                            : "#ef4444"
                }}>
                  {Math.round(s.percentage)}%
                </div>
                <span style={{
                  background:   "rgba(139,92,246,.2)",
                  border:       "1px solid rgba(139,92,246,.3)",
                  borderRadius: "7px",
                  padding:      "3px 9px",
                  fontSize:     ".75rem",
                  fontWeight:   700,
                  color:        "#a78bfa"
                }}>
                  {s.grade}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}