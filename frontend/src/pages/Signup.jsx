import { useState }          from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion }            from "framer-motion"
import { FiEye, FiEyeOff }   from "react-icons/fi"
import { LuCheck }           from "react-icons/lu"
import { useAuth }           from "../context/AuthContext"
import toast                 from "react-hot-toast"
import RobotAnimation        from "../components/RobotAnimation"

const getPasswordStrength = (pw) => {
  if (!pw) return { score: 0, label: "", color: "var(--t3)" }
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1)   return { score: s, label: "Weak",   color: "var(--err)" }
  if (s === 2)  return { score: s, label: "Medium", color: "var(--s)" }
  return { score: s, label: "Strong", color: "var(--ok)" }
}

export default function Signup() {
  const [form,    setForm]    = useState({ name:"", email:"", password:"", confirm:"" })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const isPasswordValid = form.password.length >= 8
  const strength        = getPasswordStrength(form.password)
  const strengthBars    = strength.score === 0 ? 1 : Math.min(strength.score, 3)
  const { signup }            = useAuth()
  const navigate              = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!isPasswordValid) {
      setPasswordTouched(true)
      toast.error("Password must be at least 8 characters.")
      return
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match!")
      return
    }
    setLoading(true)
    try {
      await signup(form.name, form.email, form.password)
      toast.success("Verification code sent! Check your email.")
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key:"name",    label:"Full Name",        type:"text",     ph:"Enter your full name" },
    { key:"email",   label:"Email Address",    type:"email",    ph:"your@email.com" },
    { key:"password",label:"Password",         type:"password", ph:"Minimum 8 characters" },
    { key:"confirm", label:"Confirm Password", type:"password", ph:"Re-enter your password" },
  ]

  return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "radial-gradient(circle at 25% 40%,rgba(37,99,235,.08),transparent 55%),var(--bg)",
      padding:        "20px",
      position:       "relative",
      overflow:        "hidden"
    }}>
      {/* Ambient gradient orbs */}
      <div className="orb orb-1"/>
      <div className="orb orb-2"/>

      {/* ── Balanced two-column layout ── */}
      <div style={{
        width:            "100%",
        maxWidth:         "1100px",
        margin:           "0 auto",
        display:          "flex",
        alignItems:       "center",
        justifyContent:   "space-evenly",
        flexWrap:         "wrap",
        gap:              "40px",
        padding:          "20px 0"
      }}>
        {/* Robot — desktop only */}
        <motion.div
          className="hm"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x:  0  }}
          style={{ textAlign: "center", maxWidth: "430px", width: "100%" }}
        >
        <div style={{ position: "relative" }}>
          <div style={{
            position:   "absolute",
            inset:      "-40px",
            background: "radial-gradient(circle,rgba(37,99,235,.18),transparent 70%)",
            borderRadius: "50%"
          }}/>
          <RobotAnimation size={260}/>
        </div>
        <div style={{
          marginTop:        "22px",
          display:          "flex",
          flexDirection:    "column",
          gap:              "12px",
          alignItems:       "flex-start",
          maxWidth:         "400px",
          marginLeft:       "auto",
          marginRight:      "auto"
        }}>
          {[
            "AI-powered mock interviews",
            "Resume-based questions",
            "Instant feedback & scoring",
            "Practice unlimited interviews — free",
          ].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                width:"22px", height:"22px", borderRadius:"50%",
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                background:"rgba(37,99,235,.15)", color:"var(--p)", flexShrink:0
              }}><LuCheck size={13}/></span>
              <span style={{ fontSize: ".9rem", color: "var(--t2)", textAlign: "left" }}>{t}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        className="glass"
        style={{ padding:"40px", width:"100%", maxWidth:"420px" }}
        initial={{ opacity:0, y:30 }}
        animate={{ opacity:1, y:0 }}
      >
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div className="mm" style={{ fontSize: "2rem", marginBottom: "8px" }}>
            <span className="gt" style={{ fontWeight: 900 }}>Mock</span>
            <span style={{ fontWeight: 900 }}>Mind</span>
            <span style={{ marginLeft: "4px" }}>🧠</span>
          </div>
          <h1 style={{ fontSize:"1.8rem", fontWeight:800, marginBottom:"6px" }}>
            Create Account
          </h1>
          <p style={{ color:"var(--t2)", fontSize:".82rem", opacity:.8 }}>
            Join <span className="gt">MockMind</span> — it's{" "}
            <span style={{ color:"var(--pl)", fontWeight:600 }}>completely free</span>
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{
                fontSize:".8rem", color:"var(--t2)",
                display:"block", marginBottom:"6px", fontWeight:600
              }}>
                {f.label}
              </label>
              <div style={f.key === "password" || f.key === "confirm" ? { position: "relative" } : {}}>
                <input
                  className={`inp ${f.key === "password" && passwordTouched ? (isPasswordValid ? "valid-input" : "invalid-input") : ""}`}
                  type={
                    f.key === "password"
                      ? (showPassword ? "text" : "password")
                      : f.key === "confirm"
                        ? (showConfirm ? "text" : "password")
                        : f.type
                  }
                  placeholder={f.ph}
                  value={form[f.key]}
                  onChange={e => {
                    setForm({ ...form, [f.key]: e.target.value })
                    if (f.key === "password") setPasswordTouched(true)
                  }}
                  required
                  style={f.key === "password" || f.key === "confirm" ? { paddingRight: "48px" } : {}}
                />
                {(f.key === "password" || f.key === "confirm") && (
                  <button
                    type="button"
                    onClick={() => f.key === "password" ? setShowPassword(prev => !prev) : setShowConfirm(prev => !prev)}
                    className="password-toggle"
                    aria-label={f.key === "password" ? (showPassword ? "Hide password" : "Show password") : (showConfirm ? "Hide password" : "Show password")}
                  >
                    {f.key === "password"
                      ? (showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />)
                      : (showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />)}
                  </button>
                )}
              </div>
              {f.key === "password" && (
                <div style={{ marginTop:"6px" }}>
                  {form.password.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ display:"flex", gap:"4px", flex:1, maxWidth:"120px" }}>
                        {[0,1,2].map(i => (
                          <div key={i} style={{
                            flex:1, height:"4px", borderRadius:"2px",
                            background: i < strengthBars ? strength.color : "var(--bg3)",
                            transition:"background .3s"
                          }}/>
                        ))}
                      </div>
                      <span style={{ fontSize:".8rem", fontWeight:700, color:strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                  <div style={{
                    fontSize:".8rem", color:"var(--t3)",
                    marginTop: form.password.length > 0 ? "5px" : 0
                  }}>
                    Use 8+ chars, mix letters &amp; numbers
                  </div>
                  {passwordTouched && !isPasswordValid && (
                    <div className="validation-message error">
                      Password must be at least 8 characters.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <motion.button
            type="submit"
            className="btn btnp"
            disabled={loading}
            style={{ marginTop:"8px", padding:"14px", fontSize:".98rem" }}
            whileHover={!loading ? { scale:1.02 } : {}}
          >
            {loading
              ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                  <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                  Creating Account...
                </span>
              )
              : "Start Practicing Free"}
          </motion.button>
        </form>

        <p style={{ textAlign:"center", marginTop:"24px", color:"var(--t2)", fontSize:".86rem" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:"var(--pl)", fontWeight:600, textDecoration:"none" }}>
            Sign In →
          </Link>
        </p>
      </motion.div>
      </div>
    </div>
  )
}
