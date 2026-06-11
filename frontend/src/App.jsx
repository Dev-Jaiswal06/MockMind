import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster }        from "react-hot-toast"
import { AuthProvider }   from "./context/AuthContext"
import ProtectedRoute     from "./components/ProtectedRoute"
import Landing            from "./pages/Landing"
import Login              from "./pages/Login"
import Signup             from "./pages/Signup"
import Dashboard          from "./pages/Dashboard"
import { Suspense } from "react"

const Spin = ()=>(
  <div style={{display:"flex",justifyContent:"center",
    alignItems:"center",height:"100vh"}}>
    <div className="spinner" style={{width:48,height:48}}/>
  </div>
)

// Placeholder pages (team banayega)
const Coming = ({name})=>(
  <div style={{display:"flex",flexDirection:"column",
    justifyContent:"center",alignItems:"center",height:"100vh",gap:"16px"}}>
    <div style={{fontSize:"4rem"}}>🚧</div>
    <h2 style={{fontSize:"1.5rem"}}>{name} — Coming Soon</h2>
    <p style={{color:"var(--t2)"}}>Team member is building this...</p>
  </div>
)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style:{
            background:"#1a1a2e",color:"#f1f5f9",
            border:"1px solid rgba(255,255,255,.1)",borderRadius:"10px"
          }
        }}/>
        <Suspense fallback={<Spin/>}>
          <Routes>
            <Route path="/"          element={<Landing/>}/>
            <Route path="/login"     element={<Login/>}/>
            <Route path="/signup"    element={<Signup/>}/>
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard/></ProtectedRoute>
            }/>
            <Route path="/interview" element={
              <ProtectedRoute>
                <Coming name="Interview Module"/>
              </ProtectedRoute>
            }/>
            <Route path="/coding" element={
              <ProtectedRoute>
                <Coming name="Coding Module"/>
              </ProtectedRoute>
            }/>
            <Route path="/reports" element={
              <ProtectedRoute>
                <Coming name="Reports Module"/>
              </ProtectedRoute>
            }/>
            <Route path="*" element={<Navigate to="/"/>}/>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}