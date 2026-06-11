import { useState }          from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion }            from "framer-motion"
import { useAuth }           from "../context/AuthContext"
import toast                 from "react-hot-toast"
import RobotAnimation        from "../components/RobotAnimation"

export default function Login() {
  const [form,    setForm]    = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const { login }             = useAuth()
  const navigate              = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success("Welcome back!")
      navigate("/dashboard")
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Please try again.")
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
      gap:             "50px"
    }}>
      {/* Robot — desktop only */}
      <motion.div
        className="hm"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x:  0  }}
        style={{ textAlign: "center" }}
      >
        <RobotAnimation size={260}/>
        <p style={{ color: "var(--t2)", marginTop: "16px", fontSize: ".9rem" }}>
          "Your AI Interviewer is ready.<br/>
          Sign in to continue your practice."
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
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, marginBottom: "6px" }}>
            Welcome Back
          </h1>
          <p style={{ color: "var(--t2)", fontSize: ".9rem" }}>
            Sign in to your MockMind account
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {[
            { key: "email",    label: "Email Address", type: "email",    ph: "your@email.com" },
            { key: "password", label: "Password",      type: "password", ph: "Enter your password" },
          ].map(f => (
            <div key={f.key}>
              <label style={{
                fontSize:     ".82rem",
                color:        "var(--t2)",
                display:      "block",
                marginBottom: "7px",
                fontWeight:   600
              }}>
                {f.label}
              </label>
              <input
                className="inp"
                type={f.type}
                placeholder={f.ph}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                required
              />
            </div>
          ))}

          <motion.button
            type="submit"
            className="btn btnp"
            disabled={loading}
            style={{ marginTop: "6px", padding: "14px", fontSize: "1rem" }}
            whileHover={!loading ? { scale: 1.02 } : {}}
          >
            {loading
              ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                  <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                  Signing in...
                </span>
              )
              : "Sign In"}
          </motion.button>
        </form>

        <p style={{ textAlign:"center", marginTop:"20px", color:"var(--t2)", fontSize:".88rem" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color:"var(--pl)", fontWeight:600, textDecoration:"none" }}>
            Create Account →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}