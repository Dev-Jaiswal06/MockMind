import { motion } from "framer-motion"

export default function Coding() {
  return (
    <div style={{ padding: "32px", maxWidth: "1000px", margin: "0 auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 style={{ fontSize: "2rem", marginBottom: "16px" }}>Coding Assessment</h1>
        <p style={{ color: "var(--t2)", lineHeight: 1.7 }}>
          Solve AI-generated coding problems and execute your code directly from the browser.
        </p>
      </motion.div>
    </div>
  )
}
