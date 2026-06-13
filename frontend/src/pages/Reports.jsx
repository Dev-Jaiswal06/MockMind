import { motion } from "framer-motion"

export default function Reports() {
  return (
    <div style={{ padding: "32px", maxWidth: "1000px", margin: "0 auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 style={{ fontSize: "2rem", marginBottom: "16px" }}>Performance Reports</h1>
        <p style={{ color: "var(--t2)", lineHeight: 1.7 }}>
          View detailed interview and coding analytics, along with personalized insights.
        </p>
      </motion.div>
    </div>
  )
}
