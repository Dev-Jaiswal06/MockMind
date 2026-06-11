import { useState }          from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion }            from "framer-motion"
import { useAuth }           from "../context/AuthContext"
import toast                 from "react-hot-toast"
import RobotAnimation        from "../components/RobotAnimation"

export default function Signup() {
  const [form,    setForm]    = useState({ name:"", email:"", password:"", confirm:"" })
  const [loading, setLoading] = useState(false)
  const { signup }            = useAuth()
  const navigate              = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match!")
      return
    }
    setLoading(true)
    try {
      await signup(form.name, form.email, form.password)
      toast.success("Account created successfully!")
      navigate("/dashboard")
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key:"name",    label:"Full Name",        type:"text",     ph:"Enter your full name" },
    { key:"email",   label:"Email Address",    type:"email",    ph:"your@email.com" },
    { key:"password",label:"Password",         type:"password", ph:"Minimum 6 characters" },
    { key:"confirm", label:"Confirm Password", type:"password", ph:"Re-enter your password" },
  ]

  return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "var(--bg)",
      padding:        "20px",
      gap:            "50px"
    }}>
      {/* Robot — desktop only */}
      <motion.div
        className="hm"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x:  0  }}
        style={{ textAlign: "center" }}
      >
        <RobotAnimation size={260}/>
        <p style={{ color:"var(--t2)", marginTop:"16px", fontSize:".9rem" }}>
          "Hello! I am your AI Interview Coach.<br/>
          Let's prepare you for your dream internship!"
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        className="glass"
        style={{ padding:"38px", width:"100%", maxWidth:"400px" }}
        initial={{ opacity:0, y:30 }}
        animate={{ opacity:1, y:0 }}
      >
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <h1 style={{ fontSize:"1.8rem", fontWeight:800, marginBottom:"6px" }}>
            Create Account
          </h1>
          <p style={{ color:"var(--t2)", fontSize:".88rem" }}>
            Join <span className="gt">MockMind</span> — it's completely free
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{
                fontSize:".8rem", color:"var(--t2)",
                display:"block", marginBottom:"6px", fontWeight:600
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
              : "Create Free Account"}
          </motion.button>
        </form>

        <p style={{ textAlign:"center", marginTop:"18px", color:"var(--t2)", fontSize:".86rem" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:"var(--pl)", fontWeight:600, textDecoration:"none" }}>
            Sign In →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}