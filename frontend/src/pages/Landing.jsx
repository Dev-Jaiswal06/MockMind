import { Link }       from "react-router-dom"
import { motion }     from "framer-motion"
import RobotAnimation from "../components/RobotAnimation"

const features = [
  {
    icon: "🤖",
    title: "100% AI-Generated Questions",
    desc:  "Google Gemini generates fresh, unique questions every session — no repetition!"
  },
  {
    icon: "📄",
    title: "Resume-Based Interview",
    desc:  "Upload your resume and receive personalized questions based on your skills and projects."
  },
  {
    icon: "💻",
    title: "Live Coding Assessment",
    desc:  "Real-time code editor with 5 programming languages and instant execution."
  },
  {
    icon: "📊",
    title: "AI-Powered Evaluation",
    desc:  "Hybrid TF-IDF and Gemini AI scoring system for accurate answer analysis."
  },
  {
    icon: "🏆",
    title: "Detailed Performance Reports",
    desc:  "Identify strengths, weaknesses, and receive personalized improvement suggestions."
  },
  {
    icon: "🎯",
    title: "9 Job Roles Supported",
    desc:  "From Frontend Development to Machine Learning — all major tech roles covered."
  },
]

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "hidden" }}>

      {/* Ambient gradient orbs */}
      <div className="orb orb-1"/>
      <div className="orb orb-2"/>

      {/* ── Navbar ── */}
      <nav style={{
        padding:         "18px 48px",
        display:         "flex",
        justifyContent:  "space-between",
        alignItems:      "center",
        borderBottom:    "1px solid var(--bdr)",
        backdropFilter:  "blur(12px)",
        position:        "sticky",
        top:             0,
        zIndex:          100,
        background:      "var(--card)"
      }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 900 }}>
          <span className="gt">Mock</span>
          <span style={{ color: "var(--t1)" }}>Mind</span>
          <span style={{ marginLeft: "4px" }}>🧠</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/login">
            <button className="btn btns">Sign In</button>
          </Link>
          <Link to="/signup">
            <button className="btn btnp">Get Started Free →</button>
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         "70px 48px",
        maxWidth:        "1200px",
        margin:          "0 auto",
        gap:             "40px",
        flexWrap:        "wrap"
      }}>
        <motion.div
          style={{ flex: 1, minWidth: 280 }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x:  0  }}
          transition={{ duration: .7 }}
        >
          <div style={{
            display:      "inline-block",
            background:   "rgba(37,99,235,.12)",
            border:       "1px solid rgba(37,99,235,.3)",
            borderRadius: "20px",
            padding:      "6px 16px",
            fontSize:     ".82rem",
            color:        "#2563eb",
            marginBottom: "22px"
          }}>
            ✨ Powered by Google Gemini AI — 100% Free
          </div>

          <h1 style={{
            fontSize:     "3.2rem",
            fontWeight:   900,
            lineHeight:   1.15,
            marginBottom: "18px"
          }}>
            <span className="gt">MockMind</span><br/>
            AI-Powered Mock<br/>Interview System
          </h1>

          <p style={{
            fontSize:     "1.05rem",
            color:        "var(--t2)",
            lineHeight:   1.8,
            marginBottom: "28px"
          }}>
            Prepare for technical and HR interviews with our intelligent
            AI system. Practice with resume-based or role-based questions,
            get instant feedback, and track your progress.
            <strong style={{ color: "var(--pl)" }}> Completely Free!</strong>
          </p>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <Link to="/signup">
              <motion.button
                className="btn btnp"
                style={{ fontSize: "1.05rem", padding: "14px 30px" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: .95 }}
              >
                🧠 Start Practicing Free
              </motion.button>
            </Link>
            <Link to="/login">
              <button className="btn btns" style={{ padding: "14px 24px" }}>
                Sign In →
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display:   "flex",
            gap:       "28px",
            marginTop: "40px",
            flexWrap:  "wrap"
          }}>
            {[
              ["9+",   "Job Roles"],
              ["100%", "AI Questions"],
              ["5",    "Languages"]
            ].map(([num, label], i) => (
              <div key={i}>
                <div style={{ fontSize: "1.9rem", fontWeight: 800 }} className="gt">
                  {num}
                </div>
                <div style={{ fontSize: ".8rem", color: "var(--t2)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Robot */}
        <motion.div
          style={{ flex: 1, minWidth: 280, display: "flex", justifyContent: "center" }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x:  0 }}
          transition={{ duration: .7, delay: .2 }}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              position:     "absolute",
              inset:        "-50px",
              background:   "radial-gradient(circle,rgba(37,99,235,.18) 0%,transparent 70%)",
              borderRadius: "50%",
              animation:    "glow 3s infinite"
            }}/>
            <RobotAnimation size={340}/>
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section style={{
        padding:   "60px 48px",
        maxWidth:  "1200px",
        margin:    "0 auto"
      }}>
        <motion.div
          style={{ textAlign: "center", marginBottom: "50px" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "12px" }}>
            Why Choose <span className="gt">MockMind?</span>
          </h2>
          <p style={{ color: "var(--t2)" }}>
            Everything you need to crack your internship interview — all free!
          </p>
        </motion.div>

        <div style={{
          display:               "grid",
          gridTemplateColumns:   "repeat(auto-fill, minmax(260px, 1fr))",
          gap:                   "20px"
        }}>
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="glass"
              style={{ padding: "26px" }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * .1 }}
              whileHover={{ y: -4, borderColor: "rgba(37,99,235,.4)" }}
            >
              <div style={{ fontSize: "2.2rem", marginBottom: "12px" }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>{f.title}</h3>
              <p style={{ color: "var(--t2)", fontSize: ".88rem", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Free Stack Section ── */}
      <section style={{ padding: "60px 48px", maxWidth: "1200px", margin: "0 auto" }}>
        <motion.div
          className="glass"
          style={{
            padding:    "50px 36px",
            background: "linear-gradient(135deg,rgba(37,99,235,.1),rgba(245,158,11,.1))",
            border:     "1px solid rgba(37,99,235,.3)"
          }}
          initial={{ opacity: 0, scale: .95 }}
          whileInView={{ opacity: 1, scale: 1 }}
        >
          <h2 style={{
            fontSize:     "2rem",
            fontWeight:   800,
            marginBottom: "10px",
            textAlign:    "center"
          }}>
            100% <span className="gt">Free Technology Stack</span>
          </h2>
          <p style={{
            color:        "var(--t2)",
            textAlign:    "center",
            marginBottom: "32px"
          }}>
            No hidden costs — built with entirely free services
          </p>

          <div style={{
            display:               "grid",
            gridTemplateColumns:   "repeat(auto-fill, minmax(220px, 1fr))",
            gap:                   "16px",
            marginBottom:          "36px"
          }}>
            {[
              ["🤖", "Google Gemini AI",  "Gemini 2.0 Flash — 1500 req/day free"],
              ["💻", "Judge0 API",         "Code execution — 50 req / 5 sec free"],
              ["🗄️", "MongoDB Atlas",      "Cloud database — 512MB free forever"],
              ["🚀", "Vercel / Render",    "Hosting — Free tier available"],
            ].map(([icon, name, desc], i) => (
              <div key={i} style={{
                padding:      "18px",
                borderRadius: "12px",
                background:   "var(--card2)",
                border:       "1px solid var(--bdr)"
              }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "6px" }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{name}</div>
                <div style={{ color: "var(--t2)", fontSize: ".8rem", marginTop: "4px" }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <Link to="/signup">
              <motion.button
                className="btn btnp"
                style={{ fontSize: "1.05rem", padding: "14px 36px" }}
                whileHover={{ scale: 1.05 }}
              >
                🧠 Get Started for Free
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding:    "32px 48px",
        borderTop:  "1px solid var(--bdr)",
        background: "var(--card)",
        position:   "relative",
        zIndex:     1
      }}>
        <div style={{
          maxWidth:  "1200px",
          margin:    "0 auto",
          display:   "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap:  "wrap",
          gap:       "16px"
        }}>
          <div>
            <span className="gt" style={{ fontWeight: 800, fontSize: "1.1rem" }}>MockMind</span>
            <p style={{ color: "var(--t3)", fontSize: ".8rem", marginTop: "4px" }}>
              AI-Powered Mock Interview System
            </p>
          </div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <span style={{ color: "var(--t3)", fontSize: ".8rem" }}>
              Final Year Project — {new Date().getFullYear()}
            </span>
            <span style={{ color: "var(--t3)", fontSize: ".8rem" }}>|</span>
            <span style={{ color: "var(--t3)", fontSize: ".8rem" }}>
              Built with 🧠 Gemini AI
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
