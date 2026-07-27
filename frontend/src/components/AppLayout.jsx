// frontend/src/components/AppLayout.jsx
import Sidebar from "./Sidebar"

export default function AppLayout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      {/* Ambient gradient orbs */}
      <div className="orb orb-1"/>
      <div className="orb orb-2"/>
      <div className="orb orb-3"/>

      <Sidebar/>
      <main style={{
        flex:       1,
        overflow:   "auto",
        background: "transparent",
        position:   "relative",
        zIndex:     1
      }}>
        {children}
      </main>
    </div>
  )
}
