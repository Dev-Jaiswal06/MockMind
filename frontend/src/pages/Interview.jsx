import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence }      from "framer-motion"
import API                              from "../utils/api"
import toast                            from "react-hot-toast"

// ── Job Roles ──
const ROLES = [
  { id:"frontend",    label:"Frontend Developer",   icon:"⚛️" },
  { id:"backend",     label:"Backend Developer",    icon:"🟩" },
  { id:"fullstack",   label:"Full Stack Developer", icon:"💻" },
  { id:"ml",          label:"Machine Learning",     icon:"🤖" },
  { id:"datascience", label:"Data Science",         icon:"📊" },
  { id:"analyst",     label:"Data Analyst",         icon:"📈" },
  { id:"python",      label:"Python Developer",     icon:"🐍" },
  { id:"uiux",        label:"UI/UX Designer",       icon:"🎨" },
  { id:"devops",      label:"DevOps Engineer",      icon:"⚙️" },
]

// ── Interview Types / Rounds ──
const TYPES = [
  {
    id:    "role",
    label: "Role Based",
    icon:  "🎯",
    desc:  "Questions based on selected job role."
  },
  {
    id:    "resume",
    label: "Resume Based",
    icon:  "📄",
    desc:  "Questions based on your resume skills"
  },
  {
    id:    "both",
    label: "Combined",
    icon:  "🔥",
    desc:  "Role + Resume based questions"
  },
]

const ROUNDS = [
  {
    id:    "hr",
    label: "HR Round",
    icon:  "💬",
    desc:  "Behavioral and HR-style questions"
  },
  {
    id:    "technical",
    label: "Technical Round",
    icon:  "🛠️",
    desc:  "Technical questions related to your selected role"
  },
]

// ── Screens ──
const SCREEN = {
  SETUP:      "setup",
  INTERVIEW:  "interview",
  RESULT:     "result",
}

export default function Interview() {
  // ── Screen state ──
  const [screen, setScreen] = useState(SCREEN.SETUP)

  // ── Setup state ──
  const [selectedRole, setRole]   = useState(null)
  const [selectedType, setType]   = useState("role")
  const [selectedRound, setRound] = useState("hr")
  const [resumeFile,   setResume] = useState(null)
  const [numQuestions, setNumQ]   = useState(8)
  const [starting,     setStart]  = useState(false)
  // User-side speech recognition (re-add)
  const [recordingAnswer, setRecordingAnswer] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef(null)
  const committedAnswerRef = useRef("")
  const intentionalStopRef = useRef(false)
  const wantRecordingRef = useRef(false)

  // ── Interview state ──
  const [sessionId,    setSessionId]  = useState(null)
  const [questions,    setQuestions]  = useState([])
  const [currentIndex, setIndex]      = useState(0)
  const [answer,       setAnswer]     = useState("")
  const [evaluation,   setEval]       = useState(null)
  const [submitting,   setSubmitting] = useState(false)
  const [showEval,     setShowEval]   = useState(false)
  const [timeElapsed,  setTime]       = useState(0)
  const [allEvals,     setAllEvals]   = useState([])

  // ── Result state ──
  const [finalResult,  setFinalResult] = useState(null)
  const [allQA,        setAllQA]       = useState([])
  const [showReview,   setShowReview]  = useState(false)

  // ── Timer ref ──
  const timerRef = useRef(null)

  // ── Start timer ──
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW) {
      timerRef.current = setInterval(() => {
        setTime(t => t + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [screen])

  

  const speakText = text => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && questions[currentIndex]) {
      speakText(questions[currentIndex])
    }
  }, [screen, currentIndex, questions])

  // Setup SpeechRecognition (created once)
  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    setSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setRecordingAnswer(true)
    }

    recognition.onresult = event => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        committedAnswerRef.current = `${committedAnswerRef.current}${committedAnswerRef.current && !committedAnswerRef.current.endsWith(" ") ? " " : ""}${final.trim()}`
        setAnswer(committedAnswerRef.current)
      } else {
        const combined = `${committedAnswerRef.current}${committedAnswerRef.current && interim && !committedAnswerRef.current.endsWith(" ") ? " " : ""}${interim}`
        setAnswer(combined)
      }
    }

    recognition.onerror = (e) => {
      if (intentionalStopRef.current) { intentionalStopRef.current = false; return }
      const err = e && e.error ? e.error : null
      if (err === "not-allowed" || err === "service-not-allowed") {
        toast.error("Microphone permission denied. Please allow access.")
        return
      }
      if (err === "no-speech") {
        // if user wants to keep speaking, restart recording automatically
        if (wantRecordingRef.current) {
          try { setTimeout(() => recognitionRef.current && recognitionRef.current.start(), 250) } catch(_) {}
          return
        }
        toast("No speech detected — speak clearly.")
        return
      }
      toast.error(err ? `Voice error: ${err}` : "Voice typing error")
    }

    recognition.onend = () => {
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false
        wantRecordingRef.current = false
        setRecordingAnswer(false)
        return
      }
      if (wantRecordingRef.current) {
        try { setTimeout(() => recognitionRef.current && recognitionRef.current.start(), 200) } catch(_) { setRecordingAnswer(false) }
        return
      }
      setRecordingAnswer(false)
    }

    recognitionRef.current = recognition
  }, [])
  

  // ── Format time ──
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0")
    const s = (sec % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // ── Progress % ──
  const progress = questions.length > 0
    ? Math.round((currentIndex / questions.length) * 100)
    : 0

  // ═══════════════════════════
  // START INTERVIEW
  // ═══════════════════════════
  const startInterview = async () => {
    if (!selectedRole) {
      toast.error("Please select a job role!")
      return
    }
    setStart(true)
    try {
      const formData = new FormData()
      formData.append("role",      selectedRole.label)
      formData.append("type",      selectedType)
      formData.append("questions", numQuestions)
      if (resumeFile) formData.append("resume", resumeFile)
      formData.append("round", selectedRound)

      const res = await API.post("/api/interview/start", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })

      setSessionId(res.data.session_id)
      setQuestions(res.data.questions)
      setIndex(0)
      setAnswer("")
      setEval(null)
      setShowEval(false)
      setAllEvals([])
      setAllQA([])
      setTime(0)
      setScreen(SCREEN.INTERVIEW)
      toast.success("Interview started! Good luck! 🎯")
    } catch (err) {
      toast.error("Failed to start interview. Please try again.")
    } finally {
      setStart(false)
    }
  }

  // ═══════════════════════════
  // SUBMIT ANSWER
  // ═══════════════════════════
  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please write your answer first!")
      return
    }
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    setSubmitting(true)
    try {
      const res = await API.post("/api/interview/submit-answer", {
        session_id:     sessionId,
        question:       questions[currentIndex],
        answer:         answer,
        role:           selectedRole.label,
        question_index: currentIndex
      })

      const ev = res.data.evaluation
      setEval(ev)
      setShowEval(true)
      setAllEvals(prev => [...prev, ev])
      setAllQA(prev => [...prev, {
        question:   questions[currentIndex],
        answer:     answer,
        evaluation: ev
      }])
    } catch (err) {
      toast.error("Failed to evaluate answer!")
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════
  // NEXT QUESTION
  // ═══════════════════════════
  const goNext = async (lastEval) => {
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    const nextIndex = currentIndex + 1
    const isLast    = nextIndex >= questions.length

    if (isLast) {
      // Complete interview
      await completeInterview([...allEvals, lastEval || evaluation])
    } else {
      setIndex(nextIndex)
      setAnswer("")
      setEval(null)
      setShowEval(false)
    }
  }

  // ═══════════════════════════
  // COMPLETE INTERVIEW
  // ═══════════════════════════
  const completeInterview = async (evals) => {
    clearInterval(timerRef.current)
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    try {
      const res = await API.post("/api/interview/complete", {
        session_id: sessionId,
        role:       selectedRole.label,
        time_taken: timeElapsed
      })
      setFinalResult(res.data)
      setScreen(SCREEN.RESULT)
    } catch (err) {
      toast.error("Failed to generate report!")
    }
  }

  // ═══════════════════════════
  // RESTART
  // ═══════════════════════════
  const restart = () => {
    clearInterval(timerRef.current)
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    setScreen(SCREEN.SETUP)
    setRole(null)
    setType("role")
    setResume(null)
    setNumQ(8)
    setSessionId(null)
    setQuestions([])
    setIndex(0)
    setAnswer("")
    setEval(null)
    setShowEval(false)
    setAllEvals([])
    setAllQA([])
    setFinalResult(null)
    setShowReview(false)
    setTime(0)
  }

  // ════════════════════════════════════════
  // SCREEN 1 — SETUP
  // ════════════════════════════════════════
  if (screen === SCREEN.SETUP) return (
    <div style={{ padding: "28px", maxWidth: "900px", margin: "0 auto" }}>

      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y:  0  }}
        style={{ marginBottom: "32px" }}
      >
        <h1 style={{ fontSize: "1.9rem", fontWeight: 800 }}>
          AI Mock <span className="gt">Interview</span>
        </h1>
        <p style={{ color: "var(--t2)", marginTop: "4px", fontSize: ".9rem" }}>
          Configure your interview session and practice with AI-generated questions
        </p>
      </motion.div>

      {/* ── Step 1: Select Role ── */}
      <motion.div
        className="glass"
        style={{ padding: "24px", marginBottom: "20px" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: .1 }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>
          Step 1 — Select Job Role
        </h3>
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap:                 "10px"
        }}>
          {ROLES.map(role => (
            <motion.div
              key={role.id}
              onClick={() => setRole(role)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: .97 }}
              style={{
                padding:      "14px",
                borderRadius: "12px",
                border:       selectedRole?.id === role.id
                                ? "2px solid #8b5cf6"
                                : "1px solid rgba(255,255,255,.08)",
                background:   selectedRole?.id === role.id
                                ? "rgba(139,92,246,.15)"
                                : "rgba(255,255,255,.03)",
                cursor:       "pointer",
                textAlign:    "center",
                transition:   "all .2s"
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>
                {role.icon}
              </div>
              <div style={{
                fontSize:   ".82rem",
                fontWeight: selectedRole?.id === role.id ? 700 : 500,
                color:      selectedRole?.id === role.id ? "#a78bfa" : "var(--t1)"
              }}>
                {role.label}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Step 2: Interview Type ── */}
      <motion.div
        className="glass"
        style={{ padding: "24px", marginBottom: "20px" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: .2 }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>
          Step 2 — Interview Type
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {TYPES.map(type => (
            <div
              key={type.id}
              onClick={() => setType(type.id)}
              style={{
                padding:      "16px",
                borderRadius: "12px",
                border:       selectedType === type.id
                                ? "2px solid #8b5cf6"
                                : "1px solid rgba(255,255,255,.08)",
                background:   selectedType === type.id
                                ? "rgba(139,92,246,.15)"
                                : "rgba(255,255,255,.03)",
                cursor:       "pointer",
                textAlign:    "center",
                transition:   "all .2s"
              }}
            >
              <div style={{ fontSize: "1.6rem", marginBottom: "6px" }}>{type.icon}</div>
              <div style={{
                fontWeight: 700,
                fontSize:   ".88rem",
                marginBottom: "4px",
                color: selectedType === type.id ? "#a78bfa" : "var(--t1)"
              }}>
                {type.label}
              </div>
              <div style={{ fontSize: ".76rem", color: "var(--t2)" }}>
                {type.desc}
              </div>
            </div>
          ))}
        </div>
        {(selectedType === "role" || selectedType === "resume" || selectedType === "both") && (
          <div style={{ marginTop: "20px" }}>
            <h4 style={{ fontWeight: 700, marginBottom: "12px" }}>Choose Round</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {ROUNDS.map(round => (
                <div
                  key={round.id}
                  onClick={() => setRound(round.id)}
                  style={{
                    padding:      "14px",
                    borderRadius: "12px",
                    border:       selectedRound === round.id
                                    ? "2px solid #8b5cf6"
                                    : "1px solid rgba(255,255,255,.08)",
                    background:   selectedRound === round.id
                                    ? "rgba(139,92,246,.15)"
                                    : "rgba(255,255,255,.03)",
                    cursor:       "pointer",
                    textAlign:    "center",
                    transition:   "all .2s"
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>{round.icon}</div>
                  <div style={{
                    fontWeight: 700,
                    fontSize:   ".88rem",
                    marginBottom: "4px",
                    color: selectedRound === round.id ? "#a78bfa" : "var(--t1)"
                  }}>
                    {round.label}
                  </div>
                  <div style={{ fontSize: ".76rem", color: "var(--t2)" }}>
                    {round.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Step 3: Resume Upload (conditional) ── */}
      {(selectedType === "resume" || selectedType === "both") && (
        <motion.div
          className="glass"
          style={{ padding: "24px", marginBottom: "20px" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>
            Step 3 — Upload Resume
          </h3>
          <p style={{ color: "var(--t2)", marginBottom: "16px", fontSize: ".86rem" }}>
            Resume upload is optional. If you don't have one, you can still start the interview and answer role-based questions.
          </p>
          <label style={{
            display:      "flex",
            flexDirection:"column",
            alignItems:   "center",
            justifyContent:"center",
            padding:      "30px",
            border:       `2px dashed ${resumeFile ? "#10b981" : "rgba(255,255,255,.15)"}`,
            borderRadius: "12px",
            cursor:       "pointer",
            background:   resumeFile ? "rgba(16,185,129,.05)" : "rgba(255,255,255,.02)",
            transition:   "all .3s"
          }}>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              style={{ display: "none" }}
              onChange={e => {
                if (e.target.files[0]) {
                  setResume(e.target.files[0])
                  toast.success("Resume uploaded!")
                }
              }}
            />
            {resumeFile ? (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>✅</div>
                <div style={{ fontWeight: 600, color: "#10b981" }}>{resumeFile.name}</div>
                <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "4px" }}>
                  Click to change file
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>📄</div>
                <div style={{ fontWeight: 600 }}>Click to upload resume</div>
                <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "4px" }}>
                  PDF, DOCX, or TXT — Max 5MB
                </div>
              </>
            )}
          </label>
        </motion.div>
      )}

      {/* ── Step 4: Number of Questions ── */}
      <motion.div
        className="glass"
        style={{ padding: "24px", marginBottom: "24px" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: .3 }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>
          {selectedType === "resume" || selectedType === "both" ? "Step 4" : "Step 3"} — Number of Questions: <span className="gt">{numQuestions}</span>
        </h3>
        <input
          type="range"
          min={5} max={15} step={1}
          value={numQuestions}
          onChange={e => setNumQ(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#8b5cf6" }}
        />
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          marginTop:      "8px",
          fontSize:       ".78rem",
          color:          "var(--t2)"
        }}>
          <span>5 (Quick)</span>
          <span>10 (Standard)</span>
          <span>15 (Thorough)</span>
        </div>
      </motion.div>

      {/* ── Start Button ── */}
      <motion.button
        className="btn btnp"
        onClick={startInterview}
        disabled={starting || !selectedRole}
        style={{
          width:     "100%",
          padding:   "16px",
          fontSize:  "1.05rem",
          fontWeight: 700
        }}
        whileHover={!starting ? { scale: 1.01 } : {}}
        whileTap={{ scale: .98 }}
      >
        {starting ? (
          <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px" }}>
            <div className="spinner" style={{ width:20, height:20, borderWidth:2 }}/>
            Generating questions with AI...
          </span>
        ) : (
          "🚀 Start Interview"
        )}
      </motion.button>
    </div>
  )

  // ════════════════════════════════════════
  // SCREEN 2 — INTERVIEW
  // ════════════════════════════════════════
  if (screen === SCREEN.INTERVIEW) return (
    <div style={{ padding: "28px", maxWidth: "860px", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        marginBottom:   "20px",
        flexWrap:       "wrap",
        gap:            "10px"
      }}>
        <div>
          <span style={{
            background:   "rgba(139,92,246,.15)",
            border:       "1px solid rgba(139,92,246,.3)",
            borderRadius: "20px",
            padding:      "5px 14px",
            fontSize:     ".82rem",
            color:        "#a78bfa",
            fontWeight:   600
          }}>
            💼 {selectedRole?.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Timer */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "6px",
            padding:      "6px 14px",
            background:   "rgba(255,255,255,.05)",
            borderRadius: "20px",
            fontSize:     ".85rem",
            fontWeight:   600
          }}>
            <div style={{
              width:        "7px",
              height:       "7px",
              borderRadius: "50%",
              background:   "#10b981",
              animation:    "blink 1s infinite"
            }}/>
            {formatTime(timeElapsed)}
          </div>

          {/* End button */}
          <button
            onClick={() => {
              if (window.confirm("End interview? Progress will be saved.")) {
                completeInterview(allEvals)
              }
            }}
            style={{
              background:   "rgba(239,68,68,.1)",
              border:       "1px solid rgba(239,68,68,.3)",
              color:        "#ef4444",
              padding:      "7px 14px",
              borderRadius: "8px",
              cursor:       "pointer",
              fontSize:     ".82rem",
              fontWeight:   600
            }}
          >
            End Interview
          </button>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          fontSize:       ".8rem",
          color:          "var(--t2)",
          marginBottom:   "8px"
        }}>
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{progress}% Complete</span>
        </div>
        <div style={{
          height:       "6px",
          background:   "rgba(255,255,255,.08)",
          borderRadius: "10px",
          overflow:     "hidden"
        }}>
          <motion.div
            style={{
              height:       "100%",
              background:   "linear-gradient(90deg,#8b5cf6,#06b6d4)",
              borderRadius: "10px"
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: .5 }}
          />
        </div>
      </div>

      {/* ── AI Avatar ── */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <motion.div
          style={{
            width:           "72px",
            height:          "72px",
            borderRadius:    "50%",
            background:      "linear-gradient(135deg,#8b5cf6,#06b6d4)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        "2rem",
            margin:          "0 auto",
            boxShadow:       "0 0 30px rgba(139,92,246,.4)"
          }}
          animate={{ boxShadow: ["0 0 30px rgba(139,92,246,.4)", "0 0 50px rgba(139,92,246,.7)", "0 0 30px rgba(139,92,246,.4)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🤖
        </motion.div>
        <p style={{ color: "var(--t2)", fontSize: ".82rem", marginTop: "8px" }}>
          AI Interviewer
        </p>
      </div>

      {/* ── Question Box ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass"
          style={{
            padding:    "24px",
            marginBottom: "16px",
            background: "rgba(139,92,246,.08)",
            border:     "1px solid rgba(139,92,246,.25)",
            position:   "relative"
          }}
        >
          {/* Q number badge */}
          <div style={{
            position:     "absolute",
            top:          "-12px",
            left:         "20px",
            background:   "linear-gradient(135deg,#8b5cf6,#06b6d4)",
            color:        "#fff",
            padding:      "3px 12px",
            borderRadius: "20px",
            fontSize:     ".75rem",
            fontWeight:   700
          }}>
            Q{currentIndex + 1}
          </div>

          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, marginTop: "8px" }}>
            {questions[currentIndex]}
          </p>
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => speakText(questions[currentIndex])}
              style={{
                background: "rgba(139,92,246,.12)",
                border: "1px solid rgba(139,92,246,.3)",
                color: "#8b5cf6",
                padding: "8px 14px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: ".85rem",
                fontWeight: 700
              }}
            >
              🔁 Replay Question
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Answer Box (hide after eval shown) ── */}
      {!showEval && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            <div style={{ color: "var(--t2)", fontSize: ".86rem" }}>
              🎤 Speak your answer (click mic) — words will appear automatically.
            </div>
            {speechSupported ? (
              <button
                type="button"
                onClick={async () => {
                  if (!recognitionRef.current) { toast.error("Speech not supported") ; return }
                  if (recordingAnswer) {
                    intentionalStopRef.current = true
                    wantRecordingRef.current = false
                    try { recognitionRef.current.stop() } catch(e) {}
                    setRecordingAnswer(false)
                    return
                  }

                  // start: preserve any typed text
                  committedAnswerRef.current = answer || ""
                  try {
                    wantRecordingRef.current = true
                    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                      await navigator.mediaDevices.getUserMedia({ audio: true })
                    }
                    recognitionRef.current.start()
                    toast.success("Recording... speak now")
                  } catch (err) {
                    wantRecordingRef.current = false
                    const name = err && err.name ? err.name : "error"
                    toast.error(`Microphone error: ${name}`)
                  }
                }}
                style={{
                  background: recordingAnswer ? "#ef4444" : "rgba(139,92,246,.12)",
                  border: "1px solid rgba(139,92,246,.3)",
                  color: recordingAnswer ? "#fff" : "#8b5cf6",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: ".85rem",
                  fontWeight: 700
                }}
              >
                {recordingAnswer ? "⏹ Stop mic" : "🎙️ Start mic"}
              </button>
            ) : (
              <span style={{ color: "var(--t2)", fontSize: ".82rem" }}>
                Voice typing not supported in this browser.
              </span>
            )}
          </div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer here... Be specific and provide examples where possible."
            rows={6}
            style={{
              width:        "100%",
              background:   "rgba(255,255,255,.05)",
              border:       "1px solid rgba(255,255,255,.1)",
              borderRadius: "12px",
              padding:      "16px",
              color:        "#f1f5f9",
              fontSize:     ".95rem",
              fontFamily:   "Inter, sans-serif",
              resize:       "vertical",
              outline:      "none",
              lineHeight:   1.6,
              marginBottom: "14px",
              transition:   "border .3s"
            }}
            onFocus={e => e.target.style.borderColor = "#8b5cf6"}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,.1)"}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <motion.button
              className="btn btnp"
              onClick={submitAnswer}
              disabled={submitting}
              style={{ flex: 1, padding: "13px", fontSize: ".95rem" }}
              whileHover={!submitting ? { scale: 1.01 } : {}}
            >
              {submitting ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                  <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                  AI is evaluating...
                </span>
              ) : "✅ Submit Answer"}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ── Evaluation Card ── */}
      {showEval && evaluation && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            className="glass"
            style={{ padding: "22px", marginTop: "4px" }}
          >
            {/* Score */}
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "12px",
              marginBottom: "16px"
            }}>
              <div style={{
                background:   evaluation.score >= 7 ? "rgba(16,185,129,.15)"
                            : evaluation.score >= 5 ? "rgba(245,158,11,.15)"
                            : "rgba(239,68,68,.15)",
                border:       `2px solid ${
                              evaluation.score >= 7 ? "#10b981"
                            : evaluation.score >= 5 ? "#f59e0b"
                            : "#ef4444"}`,
                borderRadius: "12px",
                padding:      "10px 18px",
                textAlign:    "center",
                minWidth:     "80px"
              }}>
                <div style={{
                  fontSize:  "1.5rem",
                  fontWeight: 900,
                  color:     evaluation.score >= 7 ? "#10b981"
                           : evaluation.score >= 5 ? "#f59e0b"
                           : "#ef4444"
                }}>
                  {evaluation.score}/10
                </div>
                <div style={{ fontSize: ".7rem", color: "var(--t2)" }}>Score</div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: ".9rem" }}>
                  AI Feedback
                </div>
                <div style={{ color: "var(--t2)", fontSize: ".85rem", lineHeight: 1.5 }}>
                  {evaluation.feedback}
                </div>
              </div>
            </div>

            {/* Good Points */}
            <div style={{
              padding:      "12px",
              borderRadius: "8px",
              background:   "rgba(16,185,129,.08)",
              borderLeft:   "3px solid #10b981",
              marginBottom: "8px"
            }}>
              <div style={{ fontSize: ".72rem", color: "#10b981", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase" }}>
                ✅ What you got right
              </div>
              <div style={{ fontSize: ".85rem", color: "var(--t2)" }}>
                {evaluation.good_points}
              </div>
            </div>

            {/* Improve */}
            <div style={{
              padding:      "12px",
              borderRadius: "8px",
              background:   "rgba(245,158,11,.08)",
              borderLeft:   "3px solid #f59e0b",
              marginBottom: "8px"
            }}>
              <div style={{ fontSize: ".72rem", color: "#f59e0b", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase" }}>
                ⚠️ What was missing
              </div>
              <div style={{ fontSize: ".85rem", color: "var(--t2)" }}>
                {evaluation.improve}
              </div>
            </div>

            {/* Hint */}
            <div style={{
              padding:      "12px",
              borderRadius: "8px",
              background:   "rgba(139,92,246,.08)",
              borderLeft:   "3px solid #8b5cf6",
              marginBottom: "16px"
            }}>
              <div style={{ fontSize: ".72rem", color: "#a78bfa", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase" }}>
                💡 Better answer hint
              </div>
              <div style={{ fontSize: ".85rem", color: "var(--t2)" }}>
                {evaluation.hint}
              </div>
            </div>

            {/* Next Button */}
            <motion.button
              className="btn btnp"
              onClick={() => goNext(evaluation)}
              style={{ width: "100%", padding: "13px", fontSize: ".95rem" }}
              whileHover={{ scale: 1.01 }}
            >
              {currentIndex + 1 >= questions.length
                ? "📊 View Final Results"
                : "➡️ Next Question"}
            </motion.button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )

  // ════════════════════════════════════════
  // SCREEN 3 — RESULT
  // ════════════════════════════════════════
  if (screen === SCREEN.RESULT) {
    const r      = finalResult || {}
    const report = r.report || {}

    const gradeColor = r.grade === "A+" || r.grade === "A" ? "#10b981"
                     : r.grade === "B"                     ? "#06b6d4"
                     : r.grade === "C"                     ? "#f59e0b"
                     : "#ef4444"

    return (
      <div style={{ padding: "28px", maxWidth: "860px", margin: "0 auto" }}>

        {/* Header */}
        <motion.div
          style={{ textAlign: "center", marginBottom: "32px" }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>
            Interview <span className="gt">Complete!</span>
          </h1>
          <p style={{ color: "var(--t2)", marginTop: "6px" }}>
            Here is your detailed performance report
          </p>
        </motion.div>

        {/* Score Circle + Stats */}
        <motion.div
          className="glass"
          style={{ padding: "32px", textAlign: "center", marginBottom: "20px" }}
          initial={{ opacity: 0, scale: .95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {/* Score Circle */}
          <div style={{
            width:           "140px",
            height:          "140px",
            borderRadius:    "50%",
            border:          `4px solid ${gradeColor}`,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexDirection:   "column",
            margin:          "0 auto 20px",
            boxShadow:       `0 0 40px ${gradeColor}40`
          }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: gradeColor }}>
              {Math.round(r.percentage || 0)}%
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: gradeColor }}>
              {r.grade}
            </div>
          </div>

          {/* Verdict */}
          <div style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>
            {r.percentage >= 85 ? "🏆 Excellent Performance!"
           : r.percentage >= 70 ? "✅ Very Good!"
           : r.percentage >= 55 ? "👍 Good Effort!"
           : r.percentage >= 40 ? "⚡ Keep Practicing!"
           : "📚 Needs More Preparation"}
          </div>

          <div style={{ color: "var(--t2)", marginBottom: "24px", fontSize: ".9rem" }}>
            {report.motivational_message}
          </div>

          {/* Stats Row */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 "16px"
          }}>
            {[
              { label:"Total Score",      value:`${r.total_score || 0}/${r.max_score || 0}` },
              { label:"Questions",        value: r.max_score ? r.max_score / 10 : 0 },
              { label:"Time Taken",       value:`${Math.floor((timeElapsed || 0)/60)}m ${(timeElapsed || 0)%60}s` },
            ].map((s, i) => (
              <div key={i} style={{
                padding:      "14px",
                borderRadius: "10px",
                background:   "rgba(255,255,255,.04)"
              }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{s.value}</div>
                <div style={{ fontSize: ".75rem", color: "var(--t2)", marginTop: "3px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Report Cards */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap:                 "16px",
          marginBottom:        "20px"
        }}>

          {/* Strengths */}
          <motion.div
            className="glass"
            style={{ padding: "20px", background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.2)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ delay: .2 }}
          >
            <h3 style={{ color: "#10b981", marginBottom: "12px", fontWeight: 700 }}>
              ✅ Strengths
            </h3>
            {(report.strengths || []).map((s, i) => (
              <div key={i} style={{
                padding:      "8px 10px",
                borderRadius: "8px",
                background:   "rgba(16,185,129,.08)",
                marginBottom: "6px",
                fontSize:     ".85rem",
                color:        "var(--t2)"
              }}>
                • {s}
              </div>
            ))}
          </motion.div>

          {/* Weaknesses */}
          <motion.div
            className="glass"
            style={{ padding: "20px", background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.2)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ delay: .3 }}
          >
            <h3 style={{ color: "#ef4444", marginBottom: "12px", fontWeight: 700 }}>
              ⚠️ Areas to Improve
            </h3>
            {(report.weaknesses || []).map((w, i) => (
              <div key={i} style={{
                padding:      "8px 10px",
                borderRadius: "8px",
                background:   "rgba(239,68,68,.08)",
                marginBottom: "6px",
                fontSize:     ".85rem",
                color:        "var(--t2)"
              }}>
                • {w}
              </div>
            ))}
          </motion.div>

          {/* Recommendations */}
          <motion.div
            className="glass"
            style={{ padding: "20px", background: "rgba(139,92,246,.05)", border: "1px solid rgba(139,92,246,.2)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ delay: .4 }}
          >
            <h3 style={{ color: "var(--pl)", marginBottom: "12px", fontWeight: 700 }}>
              💡 Recommendations
            </h3>
            {(report.recommendations || []).map((rec, i) => (
              <div key={i} style={{
                padding:      "8px 10px",
                borderRadius: "8px",
                background:   "rgba(139,92,246,.08)",
                marginBottom: "6px",
                fontSize:     ".85rem",
                color:        "var(--t2)"
              }}>
                {i + 1}. {rec}
              </div>
            ))}
          </motion.div>

          {/* Readiness */}
          <motion.div
            className="glass"
            style={{ padding: "20px" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ delay: .5 }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: "12px" }}>
              🎯 Readiness Score
            </h3>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: gradeColor, marginBottom: "8px" }}>
              {report.readiness_score || 0}%
            </div>
            <div style={{
              background:   `${gradeColor}22`,
              border:       `1px solid ${gradeColor}`,
              borderRadius: "8px",
              padding:      "6px 12px",
              display:      "inline-block",
              fontSize:     ".82rem",
              fontWeight:   700,
              color:        gradeColor,
              marginBottom: "12px"
            }}>
              {report.readiness_level}
            </div>
            <div>
              {(report.next_steps || []).map((step, i) => (
                <div key={i} style={{
                  fontSize:     ".82rem",
                  color:        "var(--t2)",
                  padding:      "4px 0",
                  borderBottom: i < 2 ? "1px solid rgba(255,255,255,.05)" : "none"
                }}>
                  {i + 1}. {step}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Q&A Review Toggle */}
        <motion.div
          className="glass"
          style={{ padding: "20px", marginBottom: "20px" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
          transition={{ delay: .6 }}
        >
          <button
            onClick={() => setShowReview(!showReview)}
            style={{
              width:      "100%",
              padding:    "12px",
              background: "transparent",
              border:     "none",
              color:      "var(--t1)",
              cursor:     "pointer",
              fontWeight: 700,
              fontSize:   ".95rem",
              display:    "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>📋 Review All Questions & Answers</span>
            <span>{showReview ? "▲" : "▼"}</span>
          </button>

          {showReview && (
            <div style={{ marginTop: "16px" }}>
              {allQA.map((qa, i) => (
                <div key={i} style={{
                  padding:      "16px",
                  borderRadius: "10px",
                  background:   "rgba(255,255,255,.03)",
                  border:       "1px solid var(--bdr)",
                  marginBottom: "10px"
                }}>
                  <div style={{ fontWeight: 600, color: "#a78bfa", marginBottom: "8px", fontSize: ".88rem" }}>
                    Q{i + 1}: {qa.question}
                  </div>
                  <div style={{
                    padding:      "8px",
                    borderRadius: "6px",
                    background:   "rgba(255,255,255,.03)",
                    color:        "var(--t2)",
                    fontSize:     ".84rem",
                    marginBottom: "8px",
                    lineHeight:   1.5
                  }}>
                    {qa.answer}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      background:   qa.evaluation.score >= 7
                                      ? "rgba(16,185,129,.15)"
                                      : qa.evaluation.score >= 5
                                      ? "rgba(245,158,11,.15)"
                                      : "rgba(239,68,68,.15)",
                      color:        qa.evaluation.score >= 7 ? "#10b981"
                                  : qa.evaluation.score >= 5 ? "#f59e0b"
                                  : "#ef4444",
                      border:       `1px solid ${
                                    qa.evaluation.score >= 7 ? "#10b981"
                                  : qa.evaluation.score >= 5 ? "#f59e0b"
                                  : "#ef4444"}`,
                      borderRadius: "6px",
                      padding:      "3px 10px",
                      fontSize:     ".78rem",
                      fontWeight:   700
                    }}>
                      {qa.evaluation.score}/10
                    </span>
                    <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>
                      {qa.evaluation.feedback}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <motion.button
            className="btn btnp"
            onClick={restart}
            style={{ flex: 1, padding: "14px", fontSize: ".95rem" }}
            whileHover={{ scale: 1.01 }}
          >
            🔄 Start New Interview
          </motion.button>
          <a href="/reports" style={{ flex: 1 }}>
            <button className="btn btns" style={{ width: "100%", padding: "14px", fontSize: ".95rem" }}>
              📊 View All Reports
            </button>
          </a>
        </div>
      </div>
    )
  }
}