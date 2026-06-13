// src/App.jsx — Sidebar + Navbar + Full Interview Features
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster }        from "react-hot-toast"
import { AuthProvider }   from "./context/AuthContext"
import ProtectedRoute     from "./components/ProtectedRoute"
import AppLayout          from "./components/AppLayout"
import Landing            from "./pages/Landing"
import Login              from "./pages/Login"
import Signup             from "./pages/Signup"
import Dashboard          from "./pages/Dashboard"
import Interview          from "./pages/Interview"
import Coding             from "./pages/Coding"
import Reports            from "./pages/Reports"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style:{
            background:"#1a1a2e",
            color:"#f1f5f9",
            border:"1px solid rgba(255,255,255,.1)",
            borderRadius:"10px"
          }
        }}/>
        <Routes>
          {/* Public pages — NO sidebar */}
          <Route path="/"       element={<Landing/>}/>
          <Route path="/login"  element={<Login/>}/>
          <Route path="/signup" element={<Signup/>}/>

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
      </BrowserRouter>
    </AuthProvider>
  )
}