// src/App.jsx — Sidebar + Navbar + Full Interview Features
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Toaster }        from "react-hot-toast"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect }      from "react"
import { AuthProvider }   from "./context/AuthContext"
import ProtectedRoute     from "./components/ProtectedRoute"
import AppLayout          from "./components/AppLayout"
import Landing            from "./pages/Landing"
import Login              from "./pages/Login"
import Signup             from "./pages/Signup"
import VerifyEmail        from "./pages/VerifyEmail"
import ForgotPassword     from "./pages/ForgotPassword"
import ResetPassword      from "./pages/ResetPassword"
import Dashboard          from "./pages/Dashboard"
import Interview          from "./pages/Interview"
import Coding             from "./pages/Coding"
import Reports            from "./pages/Reports"

function ThemeInit() {
  useEffect(() => {
    const saved = localStorage.getItem("mm-theme")
    if (saved === "dark") document.documentElement.classList.add("dark")
    else document.documentElement.classList.remove("dark")
  }, [])
  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: .25, ease: "easeInOut" }}
        style={{ minHeight: "100vh" }}
      >
        <Routes location={location}>
          {/* Public pages — NO sidebar */}
          <Route path="/"       element={<Landing/>}/>
          <Route path="/login"  element={<Login/>}/>
          <Route path="/signup"        element={<Signup/>}/>
          <Route path="/verify-email"  element={<VerifyEmail/>}/>
          <Route path="/forgot-password" element={<ForgotPassword/>}/>
          <Route path="/reset-password"  element={<ResetPassword/>}/>

          {/* Protected pages — WITH sidebar & navbar */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout><Dashboard/></AppLayout>
            </ProtectedRoute>
          }/>
          <Route path="/interview" element={
            <ProtectedRoute>
              <AppLayout><Interview/></AppLayout>
            </ProtectedRoute>
          }/>
          <Route path="/coding" element={
            <ProtectedRoute>
              <AppLayout><Coding/></AppLayout>
            </ProtectedRoute>
          }/>
          <Route path="/reports" element={
            <ProtectedRoute>
              <AppLayout><Reports/></AppLayout>
            </ProtectedRoute>
          }/>

          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ThemeInit/>
        <Toaster position="top-right" toastOptions={{
          style:{
            background:"var(--bg2)",
            color:"var(--t1)",
            border:"1px solid var(--bdr)",
            borderRadius:"12px",
            boxShadow:"var(--shadow-lg)",
            fontSize:".88rem"
          }
        }}/>
        <AnimatedRoutes/>
      </BrowserRouter>
    </AuthProvider>
  )
}
