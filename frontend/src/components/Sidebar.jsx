// frontend/src/components/Sidebar.jsx
import { useState }              from "react"
import { Link, useLocation }     from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth }               from "../context/AuthContext"

const NAV_ITEMS = [
  { path: "/dashboard", icon: "🏠", label: "Dashboard"   },
  { path: "/interview", icon: "🤖", label: "Interview"   },
  { path: "/coding",    icon: "💻", label: "Coding"      },
  { path: "/reports",   icon: "📊", label: "Reports"     },
]

export default function Sidebar() {
  const { user, logout }    = useAuth()
  const location            = useLocation()
  const [collapsed, setCol] = useState(false)

  return (
    <motion.div
      animate={{ width: collapsed ? 70 : 220 }}
      transition={{ duration: .3, ease: "easeInOut" }}
      style={{
        height:        "100vh",
        background:    "#0e0e1c",
        borderRight:   "1px solid rgba(255,255,255,.08)",
        display:       "flex",
        flexDirection: "column",
        position:      "sticky",
        top:           0,
        flexShrink:    0,
        overflow:      "hidden",
        zIndex:        50
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        padding:        "20px 16px",
        borderBottom:   "1px solid rgba(255,255,255,.06)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between"
      }}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontWeight: 900, fontSize: "1.2rem" }}
            >
              <span style={{
                background:              "linear-gradient(135deg,#8b5cf6,#06b6d4)",
                WebkitBackgroundClip:    "text",
                WebkitTextFillColor:     "transparent"
              }}>
                Mock
              </span>
              <span style={{ color: "#f1f5f9" }}>Mind</span>
              <span style={{ marginLeft: "4px" }}>🧠</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={() => setCol(!collapsed)}
          style={{
            background:   "rgba(255,255,255,.06)",
            border:       "1px solid rgba(255,255,255,.1)",
            borderRadius: "8px",
            color:        "#94a3b8",
            cursor:       "pointer",
            padding:      "6px 8px",
            fontSize:     ".8rem",
            lineHeight:   1,
            flexShrink:   0
          }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* ── Nav Items ── */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{ textDecoration: "none" }}
            >
              <motion.div
                whileHover={{ x: 3 }}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "12px",
                  padding:      collapsed ? "12px" : "11px 14px",
                  borderRadius: "10px",
                  background:   isActive
                                  ? "rgba(139,92,246,.2)"
                                  : "transparent",
                  border:       isActive
                                  ? "1px solid rgba(139,92,246,.4)"
                                  : "1px solid transparent",
                  cursor:       "pointer",
                  transition:   "all .2s",
                  justifyContent: collapsed ? "center" : "flex-start"
                }}
              >
                <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>
                  {item.icon}
                </span>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      style={{
                        color:      isActive ? "#a78bfa" : "#94a3b8",
                        fontWeight: isActive ? 700 : 500,
                        fontSize:   ".9rem",
                        whiteSpace: "nowrap",
                        overflow:   "hidden"
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active dot */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    style={{
                      width:        "6px",
                      height:       "6px",
                      borderRadius: "50%",
                      background:   "#8b5cf6",
                      marginLeft:   "auto",
                      flexShrink:   0,
                      display:      collapsed ? "none" : "block"
                    }}
                  />
                )}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* ── User Profile at Bottom ── */}
      <div style={{
        padding:     "12px 10px",
        borderTop:   "1px solid rgba(255,255,255,.06)"
      }}>
        {/* User info */}
        <div style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "10px",
          padding:      "8px 10px",
          borderRadius: "10px",
          background:   "rgba(255,255,255,.04)",
          marginBottom: "8px",
          minWidth:     0
        }}>
          {/* Avatar */}
          <div style={{
            width:           "36px",
            height:          "36px",
            borderRadius:    "50%",
            background:      "linear-gradient(135deg,#8b5cf6,#06b6d4)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontWeight:      800,
            fontSize:        ".95rem",
            color:           "#fff",
            flexShrink:      0
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  overflow: "hidden",
                  minWidth: 0,
                  width: "100%",
                  flexGrow: 1
                }}
              >
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  width: "100%"
                }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: ".85rem",
                    color: "#f1f5f9",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    overflow: "hidden"
                  }}>
                    {user?.name}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            width:        "100%",
            padding:      collapsed ? "10px" : "9px 14px",
            borderRadius: "10px",
            border:       "1px solid rgba(239,68,68,.25)",
            background:   "rgba(239,68,68,.08)",
            color:        "#ef4444",
            cursor:       "pointer",
            fontSize:     ".82rem",
            fontWeight:   600,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            gap:          "8px",
            transition:   "all .2s"
          }}
        >
          <span>🚪</span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  )
}