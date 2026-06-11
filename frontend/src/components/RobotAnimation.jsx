import { motion } from "framer-motion"

export default function RobotAnimation({ size = 300 }) {
  return (
    <div style={{width:size,height:size,position:"relative",margin:"0 auto"}}>
      <svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg"
           style={{width:"100%",height:"100%"}}>
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6"/>
            <stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
          <filter id="rglow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="rbg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".15"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="120" rx="90" ry="80" fill="url(#rbg)"/>
        <motion.line x1="100" y1="10" x2="100" y2="32"
          stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round"
          animate={{y:[0,-4,0]}} transition={{duration:2,repeat:Infinity}}/>
        <motion.circle cx="100" cy="7" r="6" fill="url(#rg)" filter="url(#rglow)"
          animate={{scale:[1,1.4,1],opacity:[1,.6,1]}}
          transition={{duration:1.5,repeat:Infinity}}/>
        <motion.rect x="58" y="32" width="84" height="68" rx="16"
          fill="rgba(255,255,255,.04)" stroke="url(#rg)" strokeWidth="1.8"
          animate={{y:[0,-5,0]}} transition={{duration:3,repeat:Infinity,ease:"easeInOut"}}/>
        {[{cx:82,cy:60,c:"#8b5cf6"},{cx:118,cy:60,c:"#06b6d4"}].map((e,i)=>(
          <g key={i}>
            <motion.circle cx={e.cx} cy={e.cy} r="13"
              fill={`${e.c}22`} stroke={e.c} strokeWidth="1.8"
              animate={{scale:[1,1.08,1]}} transition={{duration:2,repeat:Infinity,delay:i*.3}}/>
            <motion.circle cx={e.cx} cy={e.cy} r="7" fill="url(#rg)" filter="url(#rglow)"
              animate={{scale:[1,1.2,1]}} transition={{duration:1.5,repeat:Infinity,delay:i*.2}}/>
            <circle cx={e.cx} cy={e.cy} r="2.5" fill="white"/>
          </g>
        ))}
        <motion.path d="M83 82 Q100 92 117 82" stroke="url(#rg)"
          strokeWidth="2" fill="none" strokeLinecap="round"
          animate={{d:["M83 82 Q100 92 117 82","M83 84 Q100 90 117 84","M83 82 Q100 92 117 82"]}}
          transition={{duration:3,repeat:Infinity}}/>
        <rect x="88" y="100" width="24" height="14" rx="5"
          fill="rgba(255,255,255,.04)" stroke="url(#rg)" strokeWidth="1.5"/>
        <motion.rect x="42" y="114" width="116" height="78" rx="20"
          fill="rgba(255,255,255,.03)" stroke="url(#rg)" strokeWidth="1.8"
          animate={{y:[0,-3,0]}} transition={{duration:3,repeat:Infinity,ease:"easeInOut",delay:.5}}/>
        <rect x="63" y="126" width="74" height="44" rx="10"
          fill="rgba(139,92,246,.08)" stroke="rgba(139,92,246,.25)" strokeWidth="1"/>
        <motion.circle cx="100" cy="145" r="12"
          fill="rgba(139,92,246,.15)" stroke="#8b5cf6" strokeWidth="2"
          animate={{scale:[1,1.2,1]}} transition={{duration:1,repeat:Infinity}}/>
        <motion.circle cx="100" cy="145" r="6" fill="url(#rg)" filter="url(#rglow)"
          animate={{scale:[.8,1.2,.8]}} transition={{duration:1,repeat:Infinity}}/>
        {[{x:72,y:130,c:"#10b981"},{x:72,y:148,c:"#f59e0b"},
          {x:128,y:130,c:"#06b6d4"},{x:128,y:148,c:"#ef4444"}].map((d,i)=>(
          <motion.circle key={i} cx={d.x} cy={d.y} r="4.5" fill={d.c}
            animate={{opacity:[1,.2,1]}}
            transition={{duration:1.5,repeat:Infinity,delay:i*.3}}/>
        ))}
        {[{x:7,y:116,o:"24px 130px",d:[-10,10,-10]},
          {x:155,y:116,o:"172px 130px",d:[10,-10,10]}].map((a,i)=>(
          <motion.rect key={i} x={a.x} y={a.y} width="35" height="55" rx="12"
            fill="rgba(255,255,255,.04)" stroke="url(#rg)" strokeWidth="1.5"
            animate={{rotate:a.d,y:[0,-3,0]}}
            transition={{duration:2.5,repeat:Infinity,ease:"easeInOut",delay:i*.5}}
            style={{transformOrigin:a.o}}/>
        ))}
        {[{cx:24,cy:175},{cx:176,cy:175}].map((h,i)=>(
          <circle key={i} cx={h.cx} cy={h.cy} r="9"
            fill="rgba(255,255,255,.04)" stroke="url(#rg)" strokeWidth="1.5"/>
        ))}
        {[{x:63},{x:103}].map((l,i)=>(
          <rect key={i} x={l.x} y="192" width="34" height="30" rx="10"
            fill="rgba(255,255,255,.04)" stroke="url(#rg)" strokeWidth="1.5"/>
        ))}
        {[{x:56},{x:100}].map((f,i)=>(
          <rect key={i} x={f.x} y="213" width="44" height="14" rx="7"
            fill="rgba(139,92,246,.2)" stroke="url(#rg)" strokeWidth="1.5"/>
        ))}
      </svg>
      {[...Array(5)].map((_,i)=>(
        <motion.div key={i} style={{
          position:"absolute",width:"5px",height:"5px",borderRadius:"50%",
          background:i%2===0?"#8b5cf6":"#06b6d4",
          left:`${10+i*18}%`,top:`${15+(i%3)*22}%`,opacity:.5
        }}
          animate={{y:[0,-15,0],opacity:[.5,1,.5],scale:[1,1.6,1]}}
          transition={{duration:2+i*.4,repeat:Infinity,delay:i*.5}}/>
      ))}
    </div>
  )
}