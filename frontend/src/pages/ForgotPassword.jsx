import { useState }       from "react"
import { Link }           from "react-router-dom"
import { motion }         from "framer-motion"
import API                from "../utils/api"
import toast              from "react-hot-toast"
import RobotAnimation     from "../components/RobotAnimation"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent]   = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await API.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() })
      setSent(true)
      toast.success("Reset link sent! Check your email.")
    } catch (err) {
      toast.error(err.response?.data?.error || "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:       "100vh",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      background:      "var(--bg)",
      padding:         "20px",
      gap:             "50px",
      position:        "relative",
      overflow:         "hidden"
    }}>
      <div className="orb orb-1"/>
      <div className="orb orb-2"/>

      {/* Robot — desktop */}
      <motion.div
        className="hm"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x:  0  }}
        style={{ textAlign: "center" }}
      >
        <RobotAnimation size={260}/>
        <p style={{ color: "var(--t2)", marginTop: "16px", fontSize: ".9rem" }}>
          "No worries! Happens to the best of us."
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        className="glass"
        style={{ padding: "40px", width: "100%", maxWidth: "400px" }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y:  0 }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div className="mm" style={{ fontSize: "2rem", marginBottom: "8px" }}>
            <span className="gt" style={{ fontWeight: 900 }}>Mock</span>
            <span style={{ fontWeight: 900 }}>Mind</span>
            <span style={{ marginLeft: "4px" }}>🧠</span>
          </div>
          <h1 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "6px" }}>
            Forgot Password?
          </h1>
          <p style={{ color: "var(--t2)", fontSize: ".9rem" }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {sent ? (
          <div style={{
            textAlign:   "center",
            padding:     "20px",
            background:  "rgba(16,185,129,.08)",
            border:      "1px solid rgba(16,185,129,.3)",
            borderRadius:"12px"
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📧</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px", color: "#10b981" }}>
              Check your inbox
            </h3>
            <p style={{ color: "var(--t2)", fontSize: ".88rem", lineHeight: 1.6 }}>
              We sent a password reset link to<br/>
              <strong>{email}</strong>
            </p>
            <p style={{ color: "var(--t3)", fontSize: ".8rem", marginTop: "12px" }}>
              Didn't receive it? Check spam folder or try again.
            </p>
            <button
              className="btn btns"
              style={{ marginTop: "16px", padding: "10px 20px", fontSize: ".85rem" }}
              onClick={() => { setSent(false); setEmail("") }}
            >
              Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{
                fontSize: ".82rem", color: "var(--t2)",
                display: "block", marginBottom: "7px", fontWeight: 600
              }}>
                Email Address
              </label>
              <input
                className="inp"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <motion.button
              type="submit"
              className="btn btnp"
              disabled={loading || !email.trim()}
              style={{ marginTop: "4px", padding: "14px", fontSize: "1rem" }}
              whileHover={!loading ? { scale: 1.02 } : {}}
            >
              {loading
                ? (
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                    <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                    Sending link...
                  </span>
                )
                : "Send Reset Link"}
            </motion.button>
          </form>
        )}

        <p style={{ textAlign:"center", marginTop:"20px", fontSize:".88rem" }}>
          <Link to="/login" style={{ color:"var(--pl)", fontWeight:600, textDecoration:"none" }}>
            ← Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
