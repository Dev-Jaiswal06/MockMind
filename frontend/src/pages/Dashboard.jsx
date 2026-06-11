import { useState, useEffect }  from "react"
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

  useEffect(() => {
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
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
      <div className="spinner" style={{ width:50, height:50 }}/>
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
    <div style={{ padding:"28px", maxWidth:"1200px", margin:"0 auto" }}>

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
          <h1 style={{ fontSize:"1.9rem", fontWeight:800 }}>
            Welcome, <span className="gt">{user?.name}!</span>
          </h1>
          <p style={{ color:"var(--t2)", marginTop:"4px", fontSize:".9rem" }}>
            Ready for your next practice session?
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            background:   "rgba(239,68,68,.1)",
            border:       "1px solid rgba(239,68,68,.3)",
            color:        "#ef4444",
            padding:      "9px 18px",
            borderRadius: "10px",
            cursor:       "pointer",
            fontWeight:   600,
            fontSize:     ".88rem"
          }}
        >
          Sign Out
        </button>
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
            style={{ padding: "22px" }}
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: i * .1 }}
            whileHover={{ y:-3 }}
          >
            <div style={{ fontSize:"1.8rem", marginBottom:"6px" }}>{c.icon}</div>
            <div style={{ fontSize:"1.7rem", fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:".8rem", color:"var(--t2)", marginTop:"3px" }}>{c.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div style={{
        display:               "grid",
        gridTemplateColumns:   "repeat(auto-fill, minmax(300px, 1fr))",
        gap:                   "20px",
        marginBottom:          "28px"
      }}>
        {modules.map((m, i) => (
          <motion.div
            key={i}
            className="glass"
            style={{ padding:"28px", background:m.bg, border:`1px solid ${m.bdr}` }}
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: .1 + i * .1 }}
            whileHover={{ y:-5 }}
          >
            <div style={{ fontSize:"2.8rem", marginBottom:"12px" }}>{m.icon}</div>
            <h2 style={{ fontSize:"1.3rem", fontWeight:700, marginBottom:"8px" }}>{m.title}</h2>
            <p style={{ color:"var(--t2)", fontSize:".88rem", marginBottom:"18px", lineHeight:1.6 }}>
              {m.desc}
            </p>
            <Link to={m.link}>
              <button className="btn" style={{
                background: m.btn,
                color:      "#fff",
                padding:    "11px 0",
                width:      "100%",
                fontSize:   ".9rem",
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
          <h3 style={{ fontWeight:700, marginBottom:"18px", fontSize:"1rem" }}>
            📈 Interview Score History
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
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
          <h3 style={{ fontWeight:700, marginBottom:"14px", fontSize:"1rem" }}>
            🕒 Recent Interview Sessions
          </h3>
          {data.recent_interviews.map((s, i) => (
            <div key={i} style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              padding:        "11px",
              borderRadius:   "10px",
              background:     "rgba(255,255,255,.02)",
              marginBottom:   "9px",
              border:         "1px solid var(--bdr)"
            }}>
              <div>
                <div style={{ fontWeight:600, fontSize:".9rem" }}>{s.role}</div>
                <div style={{ fontSize:".75rem", color:"var(--t2)" }}>
                  {new Date(s.created_at).toLocaleDateString("en-IN", {
                    day:"numeric", month:"short", year:"numeric"
                  })}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{
                  fontSize:   "1.2rem",
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