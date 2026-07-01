// frontend/src/components/AppLayout.jsx
import Sidebar from "./Sidebar"

export default function AppLayout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar/>
      <main style={{
        flex:       1,
        overflow:   "auto",
        background: "var(--bg)"
      }}>
        {children}
      </main>
    </div>
  )
}