import { useState }          from "react"
import { Link, useSearchParams, useNavigate } from "react-router-dom"
import { motion }            from "framer-motion"
import { FiEye, FiEyeOff }   from "react-icons/fi"
import API                   from "../utils/api"
import toast                 from "react-hot-toast"
import RobotAnimation        from "../components/RobotAnimation"

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const token          = searchParams.get("token") || ""

  const [password, setPassword]       = useState("")
  const [confirm,  setConfirm]        = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)

  const isValid = password.length >= 8 && password === confirm

  const onSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords do not match!")
      return
    }
    setLoading(true)
    try {
      await API.post("/api/auth/reset-password", { token, password })
      setDone(true)
      toast.success("Password updated!")
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reset password.")
    } finally {
      setLoading(false)
    }
  }

  // Invalid token
  if (!token) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)", padding: "20px"
      }}>
        <div className="glass" style={{ padding: "40px", maxWidth: "400px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔗</div>
          <h2 style={{ fontWeight: 800, marginBottom: "8px" }}>Invalid Link</h2>
          <p style={{ color: "var(--t2)", marginBottom: "20px" }}>
            This password reset link is invalid. Please request a new one.
          </p>
          <Link to="/forgot-password">
            <button className="btn btnp" style={{ padding: "12px 24px" }}>
              Request New Link
            </button>
          </Link>
        </div>
      </div>
    )
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
          "Almost there! Set a strong new password."
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
            {done ? "All Done!" : "Set New Password"}
          </h1>
          <p style={{ color: "var(--t2)", fontSize: ".9rem" }}>
            {done
              ? "Your password has been updated successfully."
              : "Choose a strong password — minimum 8 characters."
            }
          </p>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>✅</div>
            <Link to="/login">
              <button className="btn btnp" style={{ padding: "14px 28px", fontSize: "1rem" }}>
                Sign In with New Password
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* New Password */}
            <div>
              <label style={{
                fontSize: ".82rem", color: "var(--t2)",
                display: "block", marginBottom: "7px", fontWeight: 600
              }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className={`inp ${password.length > 0 ? (password.length >= 8 ? "valid-input" : "invalid-input") : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{
                fontSize: ".82rem", color: "var(--t2)",
                display: "block", marginBottom: "7px", fontWeight: 600
              }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className={`inp ${confirm.length > 0 ? (confirm === password ? "valid-input" : "invalid-input") : ""}`}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(prev => !prev)}
                  className="password-toggle"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {confirm.length > 0 && confirm !== password && (
                <div className="validation-message error">Passwords do not match</div>
              )}
            </div>

            <motion.button
              type="submit"
              className="btn btnp"
              disabled={loading || !isValid}
              style={{ marginTop: "6px", padding: "14px", fontSize: "1rem" }}
              whileHover={!loading ? { scale: 1.02 } : {}}
            >
              {loading
                ? (
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                    <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                    Updating password...
                  </span>
                )
                : "Reset Password"}
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
