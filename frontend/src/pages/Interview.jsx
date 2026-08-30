import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence }      from "framer-motion"
import API                              from "../utils/api"
import toast                            from "react-hot-toast"
import {
  LuBadgeCheck, LuBrain, LuChartColumn, LuChartLine, LuCheck, LuCode,
  LuFileText, LuLayers, LuMessageSquare, LuPalette, LuPlus, LuRocket, LuServer,
  LuTarget, LuTerminal, LuWorkflow, LuWrench
} from "react-icons/lu"

// ── Job Roles ──
const ROLES = [
  { id:"frontend",    label:"Frontend Developer",   icon:<LuCode size={20}/> },
  { id:"backend",     label:"Backend Developer",    icon:<LuServer size={20}/> },
  { id:"fullstack",   label:"Full Stack Developer", icon:<LuLayers size={20}/> },
  { id:"ml",          label:"Machine Learning",     icon:<LuBrain size={20}/> },
  { id:"datascience", label:"Data Science",         icon:<LuChartColumn size={20}/> },
  { id:"analyst",     label:"Data Analyst",         icon:<LuChartLine size={20}/> },
  { id:"python",      label:"Python Developer",     icon:<LuTerminal size={20}/> },
  { id:"uiux",        label:"UI/UX Designer",       icon:<LuPalette size={20}/> },
  { id:"devops",      label:"DevOps Engineer",      icon:<LuWorkflow size={20}/> },
]

// ── Interview Types / Rounds ──
const TYPES = [
  {
    id:    "role",
    label: "Role Based",
    icon:  <LuTarget size={20}/>,
    desc:  "Questions based on selected job role."
  },
  {
    id:    "resume",
    label: "Resume Based",
    icon:  <LuFileText size={20}/>,
    desc:  "Questions based on your resume skills"
  },
  {
    id:    "both",
    label: "Combined",
    icon:  <LuLayers size={20}/>,
    desc:  "Role + Resume based questions"
  },
]

const ROUNDS = [
  {
    id:    "hr",
    label: "HR Round",
    icon:  <LuMessageSquare size={20}/>,
    desc:  "Behavioral and HR-style questions"
  },
  {
    id:    "technical",
    label: "Technical Round",
    icon:  <LuWrench size={20}/>,
    desc:  "Technical questions related to your selected role"
  },
  {
    id:    "mixed",
    label: "Mixed Round",
    icon:  <LuLayers size={20}/>,
    desc:  "HR + Technical combined (fixed 15 questions)"
  },
]

// ── Screens ──
const SCREEN = {
  SETUP:      "setup",
  INTERVIEW:  "interview",
  RESULT:     "result",
}

const QUESTION_TIME_LIMIT = 120

// ── AI Interviewer names — har session par random pick ──
const INTERVIEWER_NAMES = ["Nova", "Atlas", "Vega", "Iris", "Luna", "Echo", "Aura", "Zephyr"]

export default function Interview() {
  // ── Screen state ──
  const [screen, setScreen] = useState(SCREEN.SETUP)

  // ── Setup state ──
  const [selectedRole, setRole]   = useState(ROLES[0])
  const [selectedType, setType]   = useState("role")
  const [selectedRound, setRound] = useState("hr")
  const [resumeFile,   setResume] = useState(null)
  const [numQuestions, setNumQ]   = useState(10)
  const [example,      setExample] = useState("")
  const [showExample,  setShowExample] = useState(false)
  const [starting,     setStart]  = useState(false)
  // User-side speech recognition (re-add)
  const [recordingAnswer, setRecordingAnswer] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const recognitionRef = useRef(null)
  const committedAnswerRef = useRef("")
  const intentionalStopRef = useRef(false)
  const wantRecordingRef = useRef(false)

  // ── Interview state ──
  const [sessionId,    setSessionId]  = useState(null)
  const [questions,    setQuestions]  = useState([])
  const [currentIndex, setIndex]      = useState(0)
  const [answer,       setAnswer]     = useState("")
  const [submitting,   setSubmitting] = useState(false)
  const [completing,   setCompleting] = useState(false)
  const [timeElapsed,  setTime]       = useState(0)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME_LIMIT)

  // ── Interviewer intro state ──
  const [interviewerName, setInterviewerName] = useState("Mira")
  const [introDone,       setIntroDone]       = useState(false)

  // ── Result state ──
  const [finalResult,  setFinalResult] = useState(null)
  const [allQA,        setAllQA]       = useState([])
  const [reviewQA,     setReviewQA]    = useState(null)
  const [reviewLoading,setReviewLoad]  = useState(false)
  const [showReview,   setShowReview]  = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // ── Timer ref ──
  const timerRef = useRef(null)
  const questionStartRef = useRef(0)
  const timeoutFiredIndexRef = useRef(-1)

  // ── Mixed Round = fixed 15 questions ──
  useEffect(() => {
    if (selectedRound === "mixed" && numQuestions !== 15) {
      setNumQ(15)
    }
  }, [selectedRound])

  // ── Start timer (intro ke baad hi) ──
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && introDone) {
      timerRef.current = setInterval(() => {
        setTime(t => t + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [screen, introDone])

  // ── Per-question countdown: naye question par reset (intro ke baad) ──
  useEffect(() => {
    if (screen !== SCREEN.INTERVIEW || !introDone) return
    questionStartRef.current = timeElapsed
    setQuestionTimeLeft(QUESTION_TIME_LIMIT)
    timeoutFiredIndexRef.current = -1
  }, [currentIndex, screen, introDone])

  // ── Countdown update har tick par (intro ke baad) ──
  useEffect(() => {
    if (screen !== SCREEN.INTERVIEW || !introDone) return
    const left = QUESTION_TIME_LIMIT - (timeElapsed - questionStartRef.current)
    setQuestionTimeLeft(left > 0 ? left : 0)
  }, [timeElapsed, screen, introDone])

  // ── Interviewer intro text ──
  const buildIntro = () => {
    const roundWord = selectedRound === "hr"
      ? "HR"
      : selectedRound === "mixed" ? "HR & Technical" : "Technical"
    let roleLine = "a resume-based"
    if (selectedType === "role") roleLine = `a ${selectedRole?.label || "role"}`
    else if (selectedType === "both") roleLine = `a ${selectedRole?.label || "role"} + resume-based`
    return [
      `Hi! I'm ${interviewerName}, your AI ${roundWord} Interviewer.`,
      `Today we'll complete ${roleLine} interview consisting of ${numQuestions} questions. Answer each one naturally, and I'll evaluate your communication and technical skills.`,
      "When you're ready, click Start Interview.",
    ].join("\n\n")
  }
  const introText = buildIntro()

  const speakText = text => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend   = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  // ── Intro auto-play when interview screen appears ──
  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && !introDone) {
      speakText(introText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, introDone])

  useEffect(() => {
    if (screen === SCREEN.INTERVIEW && introDone && questions[currentIndex]) {
      speakText(questions[currentIndex])
    }
  }, [screen, currentIndex, questions, introDone])

  // ── InvalidStateError-safe start: stuck state me stop karke delayed retry ──
  const safeStartRecognition = () => {
    const rec = recognitionRef.current
    if (!rec) return false
    try {
      rec.start()
      return true
    } catch (err) {
      if (err && err.name === "InvalidStateError") {
        // pehle se started/stuck hai — stop karo, phir thodi der baad restart
        try { rec.stop() } catch(_) {}
        setTimeout(() => {
          if (!wantRecordingRef.current || !recognitionRef.current) return
          try { recognitionRef.current.start() } catch(_) {}
        }, 300)
        return true
      }
      throw err
    }
  }

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
      }
      const combined = `${committedAnswerRef.current}${committedAnswerRef.current && interim && !committedAnswerRef.current.endsWith(" ") ? " " : ""}${interim}`
      setAnswer(combined)
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
          setTimeout(() => {
            if (!wantRecordingRef.current || !recognitionRef.current) return
            safeStartRecognition()
          }, 250)
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
        setTimeout(() => {
          if (!wantRecordingRef.current || !recognitionRef.current) return
          safeStartRecognition()
        }, 200)
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

  // ── Question countdown colors ──
  const qColor = questionTimeLeft > 60 ? "#16a34a" : questionTimeLeft > 30 ? "#f59e0b" : "#ef4444"
  const qBlink = questionTimeLeft <= 30

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
      setExample("")
      setShowExample(false)
      setAllQA([])
      setTime(0)
      setQuestionTimeLeft(QUESTION_TIME_LIMIT)
      questionStartRef.current = 0
      timeoutFiredIndexRef.current = -1
      setInterviewerName(INTERVIEWER_NAMES[Math.floor(Math.random() * INTERVIEWER_NAMES.length)])
      setIntroDone(false)
      setScreen(SCREEN.INTERVIEW)
      toast.success("Interview started! Good luck! 🎯")
    } catch (err) {
      toast.error("Failed to start interview. Please try again.")
    } finally {
      setStart(false)
    }
  }

  // ═══════════════════════════
  // MIC TOGGLE
  // ═══════════════════════════
  const toggleMic = async () => {
    if (!recognitionRef.current) { toast.error("Speech not supported") ; return }
    if (recordingAnswer) {
      intentionalStopRef.current = true
      wantRecordingRef.current = false
      try { recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
      return
    }

    // start: preserve any already-transcribed text
    committedAnswerRef.current = answer || ""
    try {
      wantRecordingRef.current = true
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      if (safeStartRecognition()) {
        toast.success("Recording... speak now")
      } else {
        wantRecordingRef.current = false
        toast.error("Speech not supported")
      }
    } catch (err) {
      wantRecordingRef.current = false
      const name = err && err.name ? err.name : "error"
      toast.error(`Microphone error: ${name}`)
    }
  }

  // Mic ne galat suna ho toh answer clear karke dobara bol sakte ho
  const resetAnswer = () => {
    committedAnswerRef.current = ""
    setAnswer("")
    toast("Answer cleared — speak again")
  }

  // ═══════════════════════════
  // SAVE CURRENT ANSWER (no advance)
  // ═══════════════════════════
  const saveCurrentAnswer = async (qi = currentIndex) => {
    await API.post("/api/interview/submit-answer", {
      session_id:     sessionId,
      question:       questions[qi],
      answer:         answer,
      role:           selectedRole.label,
      question_index: qi,
      example:        example
    })
    setAllQA(prev => [...prev, {
      question:   questions[qi],
      answer:     answer,
      example:    example.trim() ? example : null,
      evaluation: null
    }])
  }

  // ═══════════════════════════
  // SUBMIT ANSWER
  // ═══════════════════════════
  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please speak your answer first!")
      return
    }
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    setSubmitting(true)
    try {
      await saveCurrentAnswer()

      const isLast = currentIndex + 1 >= questions.length
      if (isLast) {
        await completeInterview()
      } else {
        setIndex(currentIndex + 1)
        setAnswer("")
        setExample("")
        setShowExample(false)
      }
      toast.success("Answer saved! ✅")
    } catch (err) {
      toast.error("Failed to save answer!")
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════
  // COMPLETE INTERVIEW
  // ═══════════════════════════
  const completeInterview = async () => {
    clearInterval(timerRef.current)
    // stop recording if active
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    setSubmitting(true)
    setCompleting(true)
    try {
      const res = await API.post("/api/interview/complete", {
        session_id: sessionId,
        role:       selectedRole.label,
        time_taken: timeElapsed
      })
      const evals = res.data.evaluations || []
      setAllQA(prev => prev.map((qa, i) => ({ ...qa, evaluation: evals[i] || null })))
      setFinalResult(res.data)
      setScreen(SCREEN.RESULT)
    } catch (err) {
      toast.error("Failed to generate report!")
    } finally {
      setSubmitting(false)
      setCompleting(false)
    }
  }

  // ═══════════════════════════
  // TIME'S UP — auto-save + next / complete
  // ═══════════════════════════
  const handleTimeUp = async (idx = currentIndex) => {
    const isLast = idx + 1 >= questions.length
    toast(isLast
      ? "⏰ Time's up — generating your report!"
      : "⏰ Time's up — answer saved, moving to next question",
      { duration: 4000 })
    if (recordingAnswer && recognitionRef.current) {
      try { intentionalStopRef.current = true; recognitionRef.current.stop() } catch(e) {}
      setRecordingAnswer(false)
    }
    setSubmitting(true)
    try {
      await saveCurrentAnswer(idx)
      if (isLast) {
        await completeInterview()
      } else {
        setIndex(idx + 1)
        setAnswer("")
        setExample("")
        setShowExample(false)
        toast.success("Time's up — answer saved ✅")
      }
    } catch (err) {
      toast.error("Failed to save answer!")
    } finally {
      setSubmitting(false)
    }
  }

  // Countdown 0 par auto-advance (modal/busy ho toh ruk jao, phir fire karo)
  // Har question apni alag guard rakhta hai taaki purani time-out dobara na fire ho.
  // Extra check: transition ke waqt questionTimeLeft stale 0 rah sakta hai — tabhi
  // current question ka asli limit elapse check bhi lagaya hai taaki naaya question
  // turant skip na ho.
  useEffect(() => {
    if (screen !== SCREEN.INTERVIEW) return
    if (questionTimeLeft > 0) return
    if (timeElapsed - questionStartRef.current < QUESTION_TIME_LIMIT) return
    if (timeoutFiredIndexRef.current === currentIndex) return
    if (showConfirmModal || submitting || completing) return
    timeoutFiredIndexRef.current = currentIndex
    handleTimeUp(currentIndex)
  }, [questionTimeLeft, screen, currentIndex, timeElapsed, showConfirmModal, submitting, completing])

  // ── RESULT screen: review ko DB se load karo (source of truth) ──
  useEffect(() => {
    if (screen !== SCREEN.RESULT || !sessionId) return
    setShowReview(true)
    setReviewLoad(true)
    API.get(`/api/interview/session/${sessionId}`)
      .then(res => setReviewQA(res.data?.qa_list || []))
      .catch(() => setReviewQA(null))
      .finally(() => setReviewLoad(false))
  }, [screen, sessionId])

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
    setRole(ROLES[0])
    setType("role")
    setRound("hr")
    setResume(null)
    setNumQ(10)
    setSessionId(null)
    setQuestions([])
    setIndex(0)
    setAnswer("")
    setExample("")
    setShowExample(false)
    setAllQA([])
    setReviewQA(null)
    setReviewLoad(false)
    setFinalResult(null)
    setShowReview(false)
    setTime(0)
    setQuestionTimeLeft(QUESTION_TIME_LIMIT)
    questionStartRef.current = 0
    timeoutFiredIndexRef.current = -1
    setIntroDone(false)
  }

  // ════════════════════════════════════════
  // SCREEN 1 — SETUP
  // ════════════════════════════════════════
  if (screen === SCREEN.SETUP) return (
    <div style={{ padding: "28px", maxWidth: "1200px", margin: "0 auto" }}>

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

      {/* ── Progress Stepper ── */}
      {(() => {
        const steps = []
        steps.push({ id: "type",  label: "Type" })
        if (selectedType === "role")   steps.push({ id: "role",   label: "Role" })
        if (selectedType === "resume") steps.push({ id: "resume", label: "Resume" })
        if (selectedType === "both")   steps.push({ id: "role", label: "Role" }, { id: "resume", label: "Resume" })
        steps.push({ id: "round",      label: "Round" })
        steps.push({ id: "questions",  label: "Questions" })

        const isDone = s => s.id === "type"      ? true :
                           s.id === "role"       ? !!selectedRole :
                           s.id === "resume"     ? !!resumeFile :
                           s.id === "round"      ? !!selectedRound :
                           true

        const current = steps.find(st => !isDone(st)) || { id: "questions" }
        return (
          <motion.div
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              flexWrap: "wrap", marginBottom: "20px",
              padding: "12px 16px", background: "var(--card2)",
              border: "1px solid var(--bdr)", borderRadius: "10px"
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {steps.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".76rem", fontWeight: 800, flexShrink: 0,
                  background: isDone(s) && current.id !== s.id ? "var(--p)"
                             : current.id === s.id ? "var(--acc)"
                             : "var(--bg3)",
                  border: current.id === s.id ? "1.5px solid var(--p)" : "1px solid var(--bdr)",
                  color:   isDone(s) && current.id !== s.id ? "#fff"
                          : current.id === s.id ? "var(--p)"
                          : "var(--t3)"
                }}>
                  {isDone(s) ? <LuCheck size={13}/> : i + 1}
                </div>
                <span style={{
                  fontSize: ".8rem", whiteSpace: "nowrap",
                  fontWeight: current.id === s.id ? 700 : 500,
                  color: current.id === s.id ? "var(--p)" : isDone(s) ? "var(--t1)" : "var(--t3)"
                }}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <span style={{ color: "var(--bdr2)", fontSize: ".9rem" }}>→</span>}
              </div>
            ))}
          </motion.div>
        )
      })()}

      {/* ── Step 1: Interview Type ── */}
      <motion.div
        className="glass"
        style={{ padding: "20px", marginBottom: "20px" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: .1 }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: "14px", fontSize: "1.05rem" }}>
          Step 1 — Interview Type
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {TYPES.map(type => (
            <div
              key={type.id}
              onClick={() => setType(type.id)}
              style={{
                position:    "relative",
                padding:      "14px",
                borderRadius: "12px",
                border:       selectedType === type.id
                                ? "2px solid var(--pl)"
                                : "1px solid var(--bdr)",
                background:   selectedType === type.id
                                ? "var(--acc)"
                                : "var(--card2)",
                cursor:       "pointer",
                textAlign:    "center",
                transition:   "all .2s"
              }}
            >
              {selectedType === type.id && (
                <div style={{
                  position: "absolute", top: 8, right: 8, width: 20, height: 20,
                  borderRadius: "50%", background: "var(--p)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <LuCheck size={12}/>
                </div>
              )}
              <div style={{
                width: 42, height: 42, borderRadius: "11px",
                margin: "0 auto 8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: selectedType === type.id ? "var(--bg)" : "var(--bg2)",
                border: selectedType === type.id ? "1px solid rgba(37,99,235,.25)" : "1px solid var(--bdr)",
                color: selectedType === type.id ? "var(--p)" : "var(--t3)"
              }}>
                {type.icon}
              </div>
              <div style={{
                fontWeight: 700, fontSize: ".95rem", marginBottom: "4px",
                color: selectedType === type.id ? "var(--p)" : "var(--t1)"
              }}>
                {type.label}
              </div>
              <div style={{ fontSize: ".82rem", color: "var(--t2)", lineHeight: 1.4 }}>
                {type.desc}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Step 2: Select Role (for role-based / combined) ── */}
      {(selectedType === "role" || selectedType === "both") && (
        <motion.div
          className="glass"
          style={{ padding: "24px", marginBottom: "20px" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: "14px", fontSize: "1.05rem" }}>
            Step 2 — Select Job Role
          </h3>
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap:                 "10px"
          }}>
            {ROLES.map(role => (
              <motion.div
                key={role.id}
                onClick={() => setRole(role)}
                whileHover={selectedRole?.id !== role.id ? { y: -3 } : {}}
                whileTap={{ scale: .97 }}
                style={{
                  position:    "relative",
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       selectedRole?.id === role.id
                                  ? "2px solid var(--pl)"
                                  : "1px solid var(--bdr)",
                  background:   selectedRole?.id === role.id
                                  ? "var(--acc)"
                                  : "var(--card2)",
                  cursor:       "pointer",
                  textAlign:    "center",
                  transition:   "all .2s"
                }}
              >
                {selectedRole?.id === role.id && (
                  <div style={{
                    position: "absolute", top: 7, right: 7, width: 19, height: 19,
                    borderRadius: "50%", background: "var(--p)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <LuCheck size={11}/>
                  </div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: "10px",
                  margin: "0 auto 8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: selectedRole?.id === role.id ? "var(--bg)" : "var(--bg2)",
                  border: selectedRole?.id === role.id ? "1px solid rgba(37,99,235,.25)" : "1px solid var(--bdr)",
                  color: selectedRole?.id === role.id ? "var(--p)" : "var(--t3)"
                }}>
                  {role.icon}
                </div>
                <div style={{
                  fontSize:   ".9rem",
                  fontWeight: selectedRole?.id === role.id ? 700 : 500,
                  color:      selectedRole?.id === role.id ? "var(--p)" : "var(--t1)",
                  lineHeight: 1.3
                }}>
                  {role.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Resume Upload (resume / combined only) ── */}
      {(selectedType === "resume" || selectedType === "both") && (
        <motion.div
          className="glass"
          style={{ padding: "24px", marginBottom: "20px" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: "14px", fontSize: "1.05rem" }}>
            {selectedType === "both" ? "Step 3" : "Step 2"} — Upload Resume
          </h3>
          <p style={{ color: "var(--t2)", marginBottom: "14px", fontSize: ".86rem" }}>
            Resume upload is optional. If you don't have one, you can still start the interview and answer role-based questions.
          </p>
          <label style={{
            display:      "flex",
            flexDirection:"column",
            alignItems:   "center",
            justifyContent:"center",
            padding:      "22px",
            border:       `2px dashed ${resumeFile ? "#16a34a" : "var(--bdr2)"}`,
            borderRadius: "12px",
            cursor:       "pointer",
            background:   resumeFile ? "rgba(22,163,74,.05)" : "var(--card2)",
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
                <div style={{ marginBottom: "8px", color: "#16a34a" }}><LuBadgeCheck size={40}/></div>
                <div style={{ fontWeight: 600, color: "#16a34a" }}>{resumeFile.name}</div>
                <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "4px" }}>
                  Click to change file
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: "8px", color: "var(--t3)" }}><LuFileText size={40}/></div>
                <div style={{ fontWeight: 600 }}>Click to upload resume</div>
                <div style={{ fontSize: ".8rem", color: "var(--t2)", marginTop: "4px" }}>
                  PDF, DOCX, or TXT — Max 5MB
                </div>
              </>
            )}
          </label>
        </motion.div>
      )}

      {/* ── Choose Round ── */}
      {(selectedType === "role" || selectedType === "resume" || selectedType === "both") && (
        <motion.div
          className="glass"
          style={{ padding: "24px", marginBottom: "20px" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y:  0 }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: "12px", fontSize: "1.05rem" }}>
            {selectedType === "both" ? "Step 4" : "Step 3"} — Choose Round
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {ROUNDS.map(round => (
              <div
                key={round.id}
                onClick={() => setRound(round.id)}
                style={{
                  position:    "relative",
                  padding:      "14px",
                  borderRadius: "12px",
                  border:       selectedRound === round.id
                                  ? "2px solid var(--pl)"
                                  : "1px solid var(--bdr)",
                  background:   selectedRound === round.id
                                  ? "var(--acc)"
                                  : "var(--card2)",
                  cursor:       "pointer",
                  textAlign:    "center",
                  transition:   "all .2s"
                }}
              >
                {selectedRound === round.id && (
                  <div style={{
                    position: "absolute", top: 8, right: 8, width: 20, height: 20,
                    borderRadius: "50%", background: "var(--p)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <LuCheck size={12}/>
                  </div>
                )}
                <div style={{
                  width: 42, height: 42, borderRadius: "11px",
                  margin: "0 auto 8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: selectedRound === round.id ? "var(--bg)" : "var(--bg2)",
                  border: selectedRound === round.id ? "1px solid rgba(37,99,235,.25)" : "1px solid var(--bdr)",
                  color: selectedRound === round.id ? "var(--p)" : "var(--t3)"
                }}>
                  {round.icon}
                </div>
                <div style={{
                  fontWeight: 700, fontSize: ".95rem", marginBottom: "4px",
                  color: selectedRound === round.id ? "var(--p)" : "var(--t1)"
                }}>
                  {round.label}
                </div>
                <div style={{ fontSize: ".82rem", color: "var(--t2)", lineHeight: 1.4 }}>
                  {round.desc}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Number of Questions ── */}
      <motion.div
        className="glass"
        style={{ padding: "20px", marginBottom: "24px" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: "14px", fontSize: "1.05rem" }}>
          {selectedType === "both" ? "Step 5" : "Step 4"} — Number of Questions: <span className="gt">{numQuestions}</span>
        </h3>
        <div style={{
          display:      "flex",
          gap:          "10px",
          flexWrap:     "wrap"
        }}>
          {[
            { n: 5,  label: "5 (Quick)" },
            { n: 10, label: "10 (Standard)" },
            { n: 15, label: "15 (Deep)" },
          ].map(opt => (
            <button
              key={opt.n}
              onClick={() => { if (selectedRound !== "mixed") setNumQ(opt.n) }}
              disabled={selectedRound === "mixed"}
              style={{
                position:       "relative",
                flex:            1,
                minWidth:        "110px",
                padding:         "12px 16px",
                borderRadius:    "10px",
                border:          `${numQuestions === opt.n ? "2px" : "1px"} solid ${numQuestions === opt.n ? "var(--p)" : "var(--bdr)"}`,
                background:      numQuestions === opt.n
                                  ? "var(--acc)"
                                  : "var(--card2)",
                color:           numQuestions === opt.n ? "var(--p)" : "var(--t2)",
                fontWeight:      600,
                fontSize:        ".88rem",
                cursor:          selectedRound === "mixed" ? "not-allowed" : "pointer",
                opacity:         selectedRound === "mixed" && numQuestions !== opt.n ? .45 : 1,
                transition:      "all .25s"
              }}
            >
              {numQuestions === opt.n && (
                <span style={{
                  position: "absolute", top: -7, right: -7, width: 19, height: 19,
                  borderRadius: "50%", background: "var(--p)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <LuCheck size={11}/>
                </span>
              )}
              {opt.label}
            </button>
          ))}
        </div>
        {selectedRound === "mixed" ? (
          <div style={{
            marginTop: "12px",
            fontSize:  ".82rem",
            color:     "var(--pl)",
            fontWeight: 600,
            display:   "flex", alignItems: "center", gap: "6px"
          }}>
            <LuLayers size={14}/> Mixed Round is always fixed — 15 questions (6 HR + 9 Technical)
          </div>
        ) : (
          <div style={{
            marginTop: "12px",
            fontSize:  ".82rem",
            color:     "var(--t2)"
          }}>
            Estimated time: <span style={{ color: "var(--pl)", fontWeight: 700 }}>~{numQuestions * (QUESTION_TIME_LIMIT / 60)} min</span> ({numQuestions} questions × {QUESTION_TIME_LIMIT / 60} min each)
          </div>
        )}
      </motion.div>

      {/* ── Sticky Summary + Start Bar ── */}
      {(() => {
        const typeLabel  = (TYPES.find(t => t.id === selectedType) || {}).label || ""
        const roleLabel  = selectedType === "resume" ? null
                         : selectedRole ? selectedRole.label : null
        const resLabel   = selectedType === "role" ? null
                         : (resumeFile ? "Resume ✓" : "No Resume")
        const roundLabel = (ROUNDS.find(r => r.id === selectedRound) || {}).label || ""
        const qCount     = selectedRound === "mixed" ? 15 : numQuestions
        const timeMin    = Math.round((qCount * QUESTION_TIME_LIMIT) / 60)
        const parts      = [roleLabel, resLabel, roundLabel, `${qCount} Questions`].filter(Boolean)
        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y:  0 }}
            style={{
              position:       "sticky",
              bottom:         16,
              zIndex:         50,
              marginTop:      "24px",
              background:     "var(--card)",
              border:         "1px solid var(--bdr)",
              borderRadius:   "14px",
              boxShadow:      "var(--shadow-lg)",
              padding:        "14px 16px",
              display:        "flex",
              flexWrap:       "wrap",
              alignItems:     "center",
              justifyContent: "space-between",
              gap:            "12px"
            }}
          >
            <div style={{ minWidth: "220px", flex: 1 }}>
              <div style={{ fontSize: ".9rem", fontWeight: 700, color: "var(--t1)" }}>
                <span style={{ color: "var(--p)" }}>{typeLabel}</span>
                {parts.length > 0 && <> · {parts.join(" · ")}</>}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--t2)", marginTop: "3px" }}>
                Estimated time: <b style={{ color: "var(--p)" }}>~{timeMin} min</b>
              </div>
            </div>
            <motion.button
              className="btn btnp"
              onClick={startInterview}
              disabled={starting || !selectedRole}
              whileHover={!starting ? { scale: 1.02 } : {}}
              whileTap={{ scale: .98 }}
              style={{ padding: "13px 26px", fontSize: ".98rem", fontWeight: 700, whiteSpace: "nowrap" }}
            >
              {starting ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}/>
                  Generating questions with AI... (max ~30s)
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <LuRocket size={18}/> Start Interview
                </span>
              )}
            </motion.button>
          </motion.div>
        )
      })()}
    </div>
  )

  // ════════════════════════════════════════
  // SCREEN 2 — INTERVIEW
  // ════════════════════════════════════════
  if (screen === SCREEN.INTERVIEW) return (
    <div style={{
      padding: "16px 28px", maxWidth: "1150px", margin: "0 auto",
      height: "100vh", boxSizing: "border-box",
      display: "flex", flexDirection: "column", overflow: "hidden"
    }}>

      {/* ── Header ── */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        marginBottom:   "12px",
        flexWrap:       "wrap",
        gap:            "10px"
      }}>
        <div>
          <span style={{
            background:   "rgba(37,99,235,.15)",
            border:       "1px solid rgba(37,99,235,.3)",
            borderRadius: "20px",
            padding:      "5px 14px",
            fontSize:     ".82rem",
            color:        "var(--pl)",
            fontWeight:   600
          }}>
            💼 {selectedRole?.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Question countdown */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "6px",
            padding:      "6px 14px",
            background:   `${qColor}18`,
            border:       `1px solid ${qColor}55`,
            borderRadius: "20px",
            fontSize:     ".85rem",
            fontWeight:   700,
            color:        qColor
          }}>
            <div style={{
              width:        "7px",
              height:       "7px",
              borderRadius: "50%",
              background:   qColor,
              animation:    qBlink ? "blink 1s infinite" : "none"
            }}/>
            ⏳ {formatTime(questionTimeLeft)}
          </div>

          {/* Total elapsed */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "6px",
            padding:      "6px 14px",
            background:   "var(--card2)",
            borderRadius: "20px",
            fontSize:     ".85rem",
            fontWeight:   600
          }}>
            ⏱ {formatTime(timeElapsed)}
          </div>

          {/* End button */}
          <button
            onClick={() => setShowConfirmModal(true)}
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
      <div style={{ marginBottom: "14px" }}>
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
          background:   "var(--bg3)",
          borderRadius: "10px",
          overflow:     "hidden"
        }}>
          <motion.div
            style={{
              height:       "100%",
              background:   "linear-gradient(90deg,#2563eb,#1d4ed8)",
              borderRadius: "10px"
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: .5 }}
          />
        </div>
      </div>

      {/* ── AI Avatar ── */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <motion.div
          style={{
            width:           "46px",
            height:          "46px",
            borderRadius:    "50%",
            background:      "linear-gradient(135deg,#2563eb,#1d4ed8)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        "1.4rem",
            margin:          "0 auto",
            boxShadow:       "0 0 30px rgba(37,99,235,.4)"
          }}
          animate={{ boxShadow: ["0 0 30px rgba(37,99,235,.4)", "0 0 50px rgba(37,99,235,.7)", "0 0 30px rgba(37,99,235,.4)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🤖
        </motion.div>

        {/* ── Speaking wave bars ── */}
        {speaking && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "4px",
              height:         "16px",
              marginTop:      "6px"
            }}
          >
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
                style={{
                  width:           "5px",
                  height:          "100%",
                  background:      "linear-gradient(180deg,#2563eb,#1d4ed8)",
                  borderRadius:    "3px",
                  transformOrigin: "center"
                }}
              />
            ))}
          </motion.div>
        )}

        <p style={{ color: "var(--t2)", fontSize: ".75rem", marginTop: "4px" }}>
          {speaking ? (
            <span style={{ color: "var(--pl)", fontWeight: 600 }}>AI Interviewer is speaking...</span>
          ) : "AI Interviewer"}
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
            padding:    "16px",
            marginBottom: "10px",
                background:   "rgba(37,99,235,.08)",
            border:     "1px solid rgba(37,99,235,.25)",
            position:   "relative"
          }}
        >
          {/* Q number badge */}
          <div style={{
            position:     "absolute",
            top:          "-12px",
            left:         "20px",
            background:   "linear-gradient(135deg,#2563eb,#1d4ed8)",
            color:        "#fff",
            padding:      "3px 12px",
            borderRadius: "20px",
            fontSize:     ".75rem",
            fontWeight:   700
          }}>
            Q{currentIndex + 1}
          </div>

          <p style={{ fontSize: ".98rem", lineHeight: 1.6, marginTop: "4px" }}>
            {questions[currentIndex]}
          </p>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => speakText(questions[currentIndex])}
              style={{
                background: "rgba(37,99,235,.12)",
                border: "1px solid rgba(37,99,235,.3)",
                color: "var(--pl)",
                padding: "6px 12px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: ".8rem",
                fontWeight: 700
              }}
            >
              🔁 Replay Question
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Answer Box ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
      >
          {speechSupported ? (
            <>
              {speaking ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  color: "var(--t2)", fontSize: ".82rem", fontWeight: 500,
                  padding: "10px 0", marginBottom: "6px"
                }}>
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: "#f59e0b", animation: "pulse 1.2s infinite"
                  }} />
                  🕐 {interviewerName} is speaking... mic will appear when done
                </div>
              ) : (
                <>
                  <div style={{ color: "var(--t2)", fontSize: ".8rem", marginBottom: "8px" }}>
                    🎤 Speak your answer aloud — like a real interview. Words will appear below.
                  </div>

                  {/* Big mic button */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
                    <motion.button
                      type="button"
                      onClick={toggleMic}
                      animate={recordingAnswer ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                      transition={recordingAnswer ? { repeat: Infinity, duration: 1.1 } : {}}
                      style={{
                        width:        "52px",
                        height:       "52px",
                        borderRadius: "50%",
                        background:   recordingAnswer ? "#ef4444" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
                        border:       "none",
                        cursor:       "pointer",
                        display:      "flex",
                        alignItems:   "center",
                        justifyContent: "center",
                        fontSize:     "1.3rem",
                        color:        "#fff",
                        boxShadow:    recordingAnswer
                          ? "0 0 0 14px rgba(239,68,68,.15)"
                          : "0 8px 24px rgba(37,99,235,.35)"
                      }}
                    >
                      {recordingAnswer ? "⏹" : "🎙️"}
                    </motion.button>
                  </div>
                  <div style={{
                    textAlign:    "center",
                    color:        recordingAnswer ? "#ef4444" : "var(--t2)",
                    fontSize:     ".78rem",
                    fontWeight:   recordingAnswer ? 700 : 400,
                    marginBottom: "6px"
                  }}>
                    {recordingAnswer ? "🔴 Listening... speak now" : "Click the mic to start your answer"}
                  </div>
                </>
              )}

              {/* Read-only transcript */}
              <div style={{
                width:        "100%",
                flex:         1,
                minHeight:    0,
                overflowY:    "auto",
                background:   "var(--card2)",
                border:       "1px solid rgba(37,99,235,.25)",
                borderRadius: "12px",
                padding:      "12px 14px",
                color:        "var(--t1)",
                fontSize:     ".92rem",
                lineHeight:   1.6,
                marginBottom: "10px"
              }}>
                {answer ? answer : (
                  <span style={{ color: "var(--t2)", fontSize: ".88rem" }}>
                    Your spoken answer will appear here...
                  </span>
                )}
              </div>

              {/* Record again if mic heard it wrong */}
              {answer && !recordingAnswer && (
                <button
                  type="button"
                  onClick={resetAnswer}
                  style={{
                    background: "rgba(245,158,11,.12)",
                    border: "1px solid rgba(245,158,11,.3)",
                    color: "#fbbf24",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: ".78rem",
                    fontWeight: 700,
                    marginBottom: "8px"
                  }}
                >
                  🔄 Record again (galat suna toh)
                </button>
              )}

              {/* ── Optional Example / Code ── */}
              <div style={{ marginBottom: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    width: "100%",
                    background: showExample ? "rgba(37,99,235,.12)" : "var(--card2)",
                    border: `1px solid ${showExample ? "rgba(37,99,235,.35)" : "var(--bdr)"}`,
                    color: showExample ? "var(--pl)" : "var(--t2)",
                    padding: "9px 14px", borderRadius: "10px",
                    cursor: "pointer", fontSize: ".84rem", fontWeight: 600,
                    transition: "all .2s"
                  }}
                >
                  {showExample ? <LuCheck size={16}/> : <LuPlus size={16}/>}
                  {showExample ? "Example / Code Added" : "Add Example / Code (Optional)"}
                </button>

                {showExample && (
                  <textarea
                    value={example}
                    onChange={e => setExample(e.target.value)}
                    placeholder="Paste code, pseudo-code, or a real-world example to support your answer..."
                    style={{
                      width: "100%", minHeight: "90px", marginTop: "8px",
                      background: "var(--bg)", color: "var(--t1)",
                      border: "1px solid var(--bdr2)", borderRadius: "10px",
                      padding: "10px 12px", fontSize: ".85rem", lineHeight: 1.5,
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      resize: "vertical", outline: "none", boxSizing: "border-box"
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{
              padding:      "20px",
              borderRadius: "12px",
              background:   "rgba(239,68,68,.08)",
              border:       "1px solid rgba(239,68,68,.3)",
              textAlign:    "center",
              marginBottom: "14px"
            }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>⚠️</div>
              <div style={{ color: "#fca5a5", fontWeight: 700, marginBottom: "6px" }}>
                Voice interviews need microphone support
              </div>
              <div style={{ color: "var(--t2)", fontSize: ".85rem", lineHeight: 1.6 }}>
                This browser doesn't support voice input. Please use <b style={{ color: "#60a5fa" }}>Chrome</b> or <b style={{ color: "#60a5fa" }}>Edge</b> to give the interview.
              </div>
            </div>
          )}

          {speechSupported && (
            <div style={{ display: "flex", gap: "8px" }}>
              <motion.button
                className="btn btnp"
                onClick={submitAnswer}
                disabled={submitting}
                style={{ flex: 1, padding: "10px", fontSize: ".9rem" }}
                whileHover={!submitting ? { scale: 1.01 } : {}}
              >
                {submitting ? (
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                    <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                    {currentIndex + 1 >= questions.length
                      ? "Evaluating answers & generating report..."
                      : "Saving answer..."}
                  </span>
                ) : "✅ Submit Answer"}
              </motion.button>
            </div>
          )}
        </motion.div>

      {/* ── End Interview Confirm Modal ── */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px"
            }}
          >
            <motion.div
              className="glass"
              initial={{ scale: .9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: .9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ padding: "32px", maxWidth: "380px", width: "100%", textAlign: "center" }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⚠️</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "8px" }}>
                End Interview?
              </h3>
              <p style={{ color: "var(--t2)", fontSize: ".88rem", marginBottom: "24px" }}>
                Progress will be saved. You can view results after ending.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="btn btns"
                  style={{ flex: 1, padding: "11px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmModal(false)
                    if (answer.trim()) {
                      try { await saveCurrentAnswer() } catch (err) { toast.error("Answer save failed!"); return }
                    }
                    completeInterview()
                  }}
                  className="btn"
                  style={{
                    flex: 1, padding: "11px",
                    background: "var(--err)", color: "#fff", fontWeight: 700
                  }}
                >
                  End Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading overlay (AI evaluating) ── */}
      {completing && (
        <div style={{
          position:     "fixed", inset: 0, zIndex: 999,
          background:   "rgba(0,0,0,.6)",
          backdropFilter: "blur(4px)",
          display:      "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "14px",
          padding:      "20px"
        }}>
          <div className="spinner" style={{ width: 48, height: 48 }}/>
          <div style={{ color: "var(--t1)", fontWeight: 700, fontSize: "1rem", textAlign: "center" }}>
            Evaluating your answers & generating report...
          </div>
          <div style={{ color: "var(--t2)", fontSize: ".82rem", textAlign: "center" }}>
            This may take up to a minute.
          </div>
        </div>
      )}

      {/* ── Interviewer Intro (full-screen premium session welcome) ── */}
      {!introDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: "var(--bg)",
            overflow: "hidden"
          }}
        >
          {/* Viewport-pinned wrapper: card stays centered on screen even if the page behind is taller */}
          <div style={{
            position: "sticky", top: 0, height: "100vh",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "min(16px, 3vw)"
          }}>
          {/* Soft ambient blobs (emerald-tinted, subtle) */}
          <div style={{
            position: "absolute", width: "480px", height: "480px", borderRadius: "50%",
            top: "-160px", right: "-120px",
            background: "radial-gradient(circle, rgba(37,99,235,.16), transparent 70%)",
            filter: "blur(60px)", pointerEvents: "none"
          }}/>
          <div style={{
            position: "absolute", width: "420px", height: "420px", borderRadius: "50%",
            bottom: "-160px", left: "-100px",
            background: "radial-gradient(circle, rgba(245,158,11,.13), transparent 70%)",
            filter: "blur(60px)", pointerEvents: "none"
          }}/>

          <motion.div
            className="glass"
            initial={{ scale: .94, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: .45, ease: "easeOut" }}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "100%",
              minHeight: "min(calc(100vh - 96px), 520px)",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              padding: "clamp(22px, 3.5vw, 38px) clamp(20px, 4vw, 56px)",
              textAlign: "center",
              borderRadius: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            {/* Top group: session chip + header */}
            <div style={{ width: "100%" }}>
            {/* Session chip */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "var(--card2)", border: "1px solid var(--bdr)",
              borderRadius: "999px", padding: "5px 14px",
              marginBottom: "12px"
            }}>
              <motion.span
                animate={{ opacity: [1, .25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "#f59e0b", display: "inline-block"
                }}
              />
              <span style={{
                fontSize: ".7rem", fontWeight: 700, letterSpacing: ".16em",
                color: "var(--t3)", textTransform: "uppercase"
              }}>
                Interview Session
              </span>
            </div>

            {/* Header */}
            <div style={{
              fontSize: ".78rem", fontWeight: 600, letterSpacing: ".18em",
              color: "var(--t3)", textTransform: "uppercase",
              marginBottom: "12px"
            }}>
              Your Interview Today
            </div>
            </div>

            {/* Middle group: avatar → name → copy (screen center) */}
            <div style={{ width: "100%" }}>

            {/* Avatar */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ marginBottom: "10px" }}
            >
              <motion.div
                animate={{ boxShadow: ["0 0 30px rgba(37,99,235,.25)", "0 0 55px rgba(29,78,216,.45)", "0 0 30px rgba(37,99,235,.25)"] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "2.3rem", margin: "0 auto"
                }}
              >
                🤖
              </motion.div>
            </motion.div>

            {/* Interviewer name + role */}
            <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--t1)", marginBottom: "4px" }}>
              {interviewerName}
            </h2>
            <div style={{ color: "var(--t2)", fontSize: ".85rem", marginBottom: "12px" }}>
              AI {selectedRound === "mixed" ? "HR & Technical" : selectedRound === "hr" ? "HR" : "Technical"} Interviewer
            </div>

            {/* Role badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              borderRadius: "999px", padding: "4px 14px",
              fontSize: ".78rem", fontWeight: 600, color: "#fff",
              boxShadow: "0 4px 16px rgba(37,99,235,.35)",
              marginBottom: "16px"
            }}>
              <span style={{ fontSize: ".78rem" }}>
                {selectedRound === "mixed" ? "🔥" : selectedRound === "hr" ? "💬" : "🛠️"}
              </span>
              <span>
                {selectedRound === "mixed"
                  ? "Mixed Round · HR + Technical"
                  : selectedRound === "hr" ? "HR Round" : "Technical Round"}
                {selectedType === "role" || selectedType === "both"
                  ? ` · ${selectedRole?.label}`
                  : " · Resume Based"}
              </span>
            </div>

            {/* Intro copy */}
            <p style={{
              fontSize: ".9rem", lineHeight: 1.6, color: "var(--t2)",
                maxWidth: "600px", margin: "0 auto 18px", whiteSpace: "pre-line"
            }}>
              {introText}
            </p>
            </div>

            {/* Bottom group: actions + footer */}
            <div style={{ width: "100%" }}>

            {/* Actions */}
            <div style={{
              display: "flex", gap: "10px", flexDirection: "column",
              maxWidth: "420px", margin: "0 auto"
            }}>
              <motion.button
                className="btn"
                onClick={() => setIntroDone(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: .98 }}
                style={{
                  width: "100%", height: "50px", borderRadius: "14px",
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  color: "#fff", fontSize: ".95rem", fontWeight: 700,
                  boxShadow: "0 8px 24px rgba(37,99,235,.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
              >
                🎙 Start Interview
              </motion.button>
              <motion.button
                className="btn"
                onClick={() => speakText(introText)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: .99 }}
                style={{
                  width: "100%", height: "42px", borderRadius: "12px",
                  background: "var(--card2)",
                  border: "1px solid var(--bdr2)",
                  color: "var(--t2)", fontSize: ".85rem", fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
              >
                🔊 Replay Introduction
              </motion.button>
            </div>

            {/* Footer */}
            <div style={{ marginTop: "12px", fontSize: ".72rem", color: "var(--t3)" }}>
              The interview timer starts only after you click Start Interview.
            </div>
            </div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  )

  // ════════════════════════════════════════
  // SCREEN 3 — RESULT
  // ════════════════════════════════════════
  if (screen === SCREEN.RESULT) {
    const r      = finalResult || {}
    const report = r.report || {}

    const gradeColor = r.grade === "A+" || r.grade === "A" ? "#16a34a"
                     : r.grade === "B"                     ? "#f59e0b"
                     : r.grade === "C"                     ? "#f59e0b"
                     : "#ef4444"

    return (
      <div style={{ padding: "28px", maxWidth: "1150px", margin: "0 auto" }}>

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

        {/* Score Panel + Stats */}
        <motion.div
          className="glass"
          style={{ padding: "28px", marginBottom: "20px" }}
          initial={{ opacity: 0, scale: .95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "26px", flexWrap: "wrap" }}>
            {/* Overall Score */}
            <div style={{ textAlign: "center", minWidth: "190px", flex: "0 0 auto" }}>
              <div style={{
                fontSize: ".68rem", fontWeight: 700, color: "var(--t2)",
                letterSpacing: ".14em", textTransform: "uppercase", marginBottom: "6px"
              }}>
                Overall Score
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", justifyContent: "center" }}>
                <span style={{ fontSize: "3rem", fontWeight: 900, color: gradeColor, lineHeight: 1 }}>
                  {Math.round(r.percentage || 0)}
                </span>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--t2)" }}>
                  / 100
                </span>
              </div>
              <div style={{ marginTop: "12px" }}>
                <span style={{
                  display:       "inline-block",
                  background:    `${gradeColor}22`,
                  border:        `1px solid ${gradeColor}`,
                  color:         gradeColor,
                  borderRadius:  "30px",
                  padding:       "5px 18px",
                  fontSize:      "1rem",
                  fontWeight:    800
                }}>
                  Grade: {r.grade}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                marginBottom:   "8px",
                fontSize:       ".82rem",
                color:          "var(--t2)"
              }}>
                <span style={{ fontWeight: 700 }}>
                  {r.percentage >= 85 ? "🏆 Excellent Performance"
                 : r.percentage >= 70 ? "✅ Very Good"
                 : r.percentage >= 55 ? "👍 Good Effort"
                 : r.percentage >= 40 ? "⚡ Keep Practicing"
                 : "📚 Needs More Preparation"}
                </span>
                <span style={{ fontWeight: 800, color: gradeColor }}>
                  {Math.round(r.percentage || 0)}%
                </span>
              </div>
              <div style={{
                position:     "relative",
                height:       "18px",
                background:   "var(--bg3)",
                borderRadius: "10px",
                overflow:     "hidden"
              }}>
                <motion.div
                  style={{
                    height:     "100%",
                    background: `linear-gradient(90deg, ${gradeColor}, ${gradeColor}cc)`,
                    borderRadius: "10px"
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.percentage || 0}%` }}
                  transition={{ duration: .8, ease: "easeOut" }}
                />
                {[40, 55, 70, 85].map(t => (
                  <div key={t} style={{
                    position: "absolute", top: 0, bottom: 0, width: "1px",
                    background: "rgba(255,255,255,.55)", left: `${t}%`
                  }}/>
                ))}
              </div>
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                marginTop:      "5px",
                fontSize:       ".68rem",
                color:          "var(--t3)"
              }}>
                <span>C</span><span>B</span><span>A</span><span>A+</span><span>100</span>
              </div>
            </div>
          </div>

          <div style={{ color: "var(--t2)", marginTop: "18px", fontSize: ".9rem" }}>
            {report.motivational_message}
          </div>

          {/* Stats Row */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 "16px",
            marginTop:           "20px"
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

        {/* Performance Breakdown */}
        {(report.skills_breakdown || []).length > 0 && (
          <motion.div
            className="glass"
            style={{ padding: "20px", marginBottom: "20px" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ delay: .15 }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              🧩 Performance Breakdown
            </h3>
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap:                 "12px"
            }}>
              {(report.skills_breakdown || []).map((sk, i) => {
                const p = Math.round(sk.percentage || 0)
                const c = p >= 70 ? "#16a34a" : p >= 40 ? "#f59e0b" : "#ef4444"
                return (
                  <div key={i} style={{
                    padding:      "12px 14px",
                    borderRadius: "10px",
                    background:   "var(--bg3)",
                    border:       "1px solid var(--bdr)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: ".86rem", fontWeight: 600, color: "var(--t1)" }}>{sk.skill}</span>
                      <span style={{ fontSize: ".86rem", fontWeight: 800, color: c }}>{p}%</span>
                    </div>
                    <div style={{ height: "8px", background: "rgba(255,255,255,.05)", borderRadius: "6px", overflow: "hidden" }}>
                      <motion.div
                        style={{ height: "100%", background: c, borderRadius: "6px" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${p}%` }}
                        transition={{ duration: .7, delay: .2 + i * .1 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Report Cards */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                 "16px",
          marginBottom:        "20px"
        }}>

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
            style={{ padding: "20px", background: "rgba(37,99,235,.05)", border: "1px solid rgba(37,99,235,.2)" }}
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
                background:   "rgba(37,99,235,.08)",
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
              {reviewLoading && (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--t2)", fontSize: ".9rem" }}>
                  <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto 10px" }}/>
                  Loading your answers...
                </div>
              )}

              {!reviewLoading && !(reviewQA || allQA).length && (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--t2)", fontSize: ".9rem" }}>
                  No answers were recorded for this session.
                </div>
              )}

              {!reviewLoading && (reviewQA || allQA).map((qa, i) => {
                const ev      = qa.evaluation || qa
                const score   = Number(ev.score ?? 0)
                const hasSug  = !!(ev.good_points || ev.improve || ev.hint)
                const scoreColor = score >= 7 ? "#16a34a" : score >= 5 ? "#f59e0b" : "#ef4444"
                const scoreBg    = score >= 7 ? "rgba(22,163,74,.15)" : score >= 5 ? "rgba(245,158,11,.15)" : "rgba(239,68,68,.15)"
                return (
                  <div key={i} style={{
                    padding:      "16px",
                    borderRadius: "10px",
                    background:   "rgba(255,255,255,.03)",
                    border:       "1px solid var(--bdr)",
                    marginBottom: "10px"
                  }}>
                    <div style={{ fontWeight: 600, color: "var(--pl)", marginBottom: "8px", fontSize: ".88rem" }}>
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
                      {qa.answer || "No answer provided"}
                    </div>
                    {qa.example && (
                      <div style={{
                        padding: "8px", borderRadius: "6px",
                        background: "rgba(16,185,129,.05)",
                        border: "1px solid rgba(16,185,129,.2)",
                        color: "var(--t2)", fontSize: ".82rem",
                        marginBottom: "8px", lineHeight: 1.5,
                        fontFamily: "'JetBrains Mono','Fira Code',monospace",
                        whiteSpace: "pre-wrap", wordBreak: "break-word"
                      }}>
                        <span style={{ fontWeight: 700, color: "#10b981" }}>Example/Code:</span> {qa.example}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: hasSug ? 10 : 0 }}>
                      <span style={{
                        background:   scoreBg,
                        color:        scoreColor,
                        border:       `1px solid ${scoreColor}`,
                        borderRadius: "6px",
                        padding:      "3px 10px",
                        fontSize:     ".78rem",
                        fontWeight:   700,
                        flexShrink:   0
                      }}>
                        {score}/10
                      </span>
                      {ev.feedback && (
                        <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>{ev.feedback}</span>
                      )}
                    </div>
                    {hasSug && (
                      <div style={{ marginTop: "6px", fontSize: ".82rem", lineHeight: 1.6 }}>
                        {ev.good_points && ev.good_points !== "—" && (
                          <div style={{ marginBottom: "6px" }}>
                            <span style={{ fontWeight: 700, color: "#16a34a" }}>+ </span>
                            <span style={{ color: "var(--t2)" }}>{ev.good_points}</span>
                          </div>
                        )}
                        {ev.improve && (
                          <div style={{ marginBottom: "6px" }}>
                            <span style={{ fontWeight: 700, color: "#f59e0b" }}>↗ </span>
                            <span style={{ color: "var(--t2)" }}>{ev.improve}</span>
                          </div>
                        )}
                        {ev.hint && ev.hint !== ev.improve && (
                          <div>
                            <span style={{ fontWeight: 700, color: "var(--pl)" }}>💡 </span>
                            <span style={{ color: "var(--t2)" }}>{ev.hint}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
