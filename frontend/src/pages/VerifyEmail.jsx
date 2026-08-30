import { useEffect, useState } from "react"
import { Link, useSearchParams, useNavigate } from "react-router-dom"
import { motion }              from "framer-motion"
import API                     from "../utils/api"
import toast                   from "react-hot-toast"
import RobotAnimation          from "../components/RobotAnimation"
import { useAuth }             from "../context/AuthContext"

const RESEND_SECONDS = 45

const maskEmail = (email) => {
  if (!email) return ""
  const idx = email.indexOf("@")
  if (idx <= 0) return email
  return email.slice(0, Math.min(idx, 7)) + "******" + email.slice(idx)
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const email          = searchParams.get("email") || ""
  const { verify }     = useAuth()

  const [code,    setCode]    = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error,   setError]   = useState("")
  const [countdown, setCountdown] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const { data } = await verify(email, code)
      toast.success(data.message || "Email verified successfully!")
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (!email) return
    setResending(true)
    setError("")
    try {
      const { data } = await API.post("/api/auth/resend-verification", { email })
      toast.success(data.message || "A new code has been sent!")
      setCode("")
      setCountdown(RESEND_SECONDS)
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend code. Please try again.")
    } finally {
      setResending(false)
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
          "Almost there! Enter the code to activate your account."
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        className="glass"
        style={{ padding: "40px", width: "100%", maxWidth: "400px" }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y:  0 }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div className="mm" style={{ fontSize: "2rem", marginBottom: "8px" }}>
            <span className="gt" style={{ fontWeight: 900 }}>Mock</span>
            <span style={{ fontWeight: 900 }}>Mind</span>
            <span style={{ marginLeft: "4px" }}>🧠</span>
          </div>
          <h1 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "6px" }}>
            Enter Verification Code
          </h1>
          <p style={{ color: "var(--t2)", fontSize: ".88rem", lineHeight: 1.6 }}>
            We sent a 6-digit code to<br/>
            <span style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--t2)", opacity: .85 }}>
              {maskEmail(email)}
            </span>
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{
              fontSize: ".82rem", color: "var(--t2)",
              display: "block", marginBottom: "7px", fontWeight: 600
            }}>
              Verification Code
            </label>
            <input
              className={`inp ${error ? "invalid-input" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength="6"
              placeholder="6-digit code"
              value={code}
              onChange={e => {
                setCode(e.target.value.replace(/\D/g, ""))
                setError("")
              }}
              autoFocus
            />
          </div>

          {error && (
            <div className="validation-message error">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            className="btn btnp"
            disabled={loading || code.length !== 6}
            style={{ marginTop: "4px", padding: "14px", fontSize: "1rem" }}
            whileHover={!loading ? { scale: 1.02 } : {}}
          >
            {loading
              ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                  <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                  Verifying...
                </span>
              )
              : "Verify Code"}
          </motion.button>
        </form>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button
            type="button"
            className="btn btns"
            disabled={resending || countdown > 0}
            style={{ padding: "10px 20px", fontSize: ".85rem" }}
            onClick={onResend}
          >
            {resending
              ? "Resending..."
              : countdown > 0
                ? `Resend Code (0:${String(countdown).padStart(2, "0")})`
                : "Resend Verification Code"}
          </button>
        </div>

        <p style={{ color: "var(--t3)", fontSize: ".8rem", textAlign: "center", marginTop: "16px" }}>
          If you didn't receive the code, check whether your email address is valid or not.
        </p>

        <p style={{ textAlign: "center", marginTop: "14px", fontSize: ".88rem" }}>
          <Link to="/signup" style={{ color: "var(--pl)", fontWeight: 600, textDecoration: "none" }}>
            ← Back to Sign Up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
