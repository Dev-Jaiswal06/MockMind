// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react"
import API from "../utils/api"

const Ctx = createContext()

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem("mm_user")
    const t = localStorage.getItem("mm_token")
    if (u && t) setUser(JSON.parse(u))
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await API.post("/api/auth/login", { email, password })
    localStorage.setItem("mm_token", data.token)
    localStorage.setItem("mm_user",  JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const signup = async (name, email, password) => {
    const { data } = await API.post("/api/auth/signup", { name, email, password })
    localStorage.setItem("mm_token", data.token)
    localStorage.setItem("mm_user",  JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const logout = () => {
    localStorage.removeItem("mm_token")
    localStorage.removeItem("mm_user")
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)