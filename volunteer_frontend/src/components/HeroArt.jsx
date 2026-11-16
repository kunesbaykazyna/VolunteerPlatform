// Illustrated hero picture (no external image needed).
// To use a real photo instead: put it in src/assets/hero.jpg and replace <HeroArt /> in Hero.jsx with <img src={heroImg} />
export default function HeroArt() {
  return (
    <svg viewBox="0 0 560 440" role="img" aria-label="Volunteers planting trees together" className="hero-art">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf0d5" />
          <stop offset="1" stopColor="#e9f3e6" />
        </linearGradient>
        <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb58c" />
          <stop offset="1" stopColor="#5f9e75" />
        </linearGradient>
      </defs>
      <rect width="560" height="440" fill="url(#sky)" />
      <circle cx="430" cy="100" r="46" fill="#f6c76a" opacity=".9" />
      <circle cx="430" cy="100" r="70" fill="#f6c76a" opacity=".25" />
      <path d="M0 290 Q120 210 250 270 T560 250 V440 H0z" fill="#a9d3b0" />
      <path d="M0 340 Q160 270 320 330 T560 310 V440 H0z" fill="url(#hill1)" />
      <path d="M0 390 Q200 340 380 385 T560 370 V440 H0z" fill="#2e6b4e" />

      {/* trees */}
      <g>
        <rect x="88" y="262" width="9" height="46" rx="3" fill="#7a5a3a" />
        <circle cx="92" cy="246" r="32" fill="#3f8a5f" />
        <circle cx="74" cy="262" r="20" fill="#4c9b6c" />
        <circle cx="112" cy="262" r="20" fill="#4c9b6c" />
      </g>
      <g>
        <rect x="470" y="280" width="8" height="40" rx="3" fill="#7a5a3a" />
        <circle cx="474" cy="266" r="26" fill="#3f8a5f" />
        <circle cx="458" cy="280" r="16" fill="#4c9b6c" />
        <circle cx="490" cy="280" r="16" fill="#4c9b6c" />
      </g>

      {/* sapling being planted */}
      <rect x="276" y="322" width="5" height="36" rx="2" fill="#7a5a3a" />
      <ellipse cx="278" cy="318" rx="16" ry="12" fill="#4c9b6c" />
      <ellipse cx="266" cy="326" rx="11" ry="8" fill="#5fae7d" />
      <ellipse cx="292" cy="326" rx="11" ry="8" fill="#5fae7d" />
      <ellipse cx="278" cy="360" rx="34" ry="7" fill="#4a3a2a" opacity=".55" />

      {/* volunteers */}
      <g>
        <circle cx="200" cy="262" r="15" fill="#f1c9a5" />
        <path d="M186 258 Q200 238 214 258 Q200 250 186 258z" fill="#3b2a20" />
        <path d="M176 360 Q176 290 200 288 Q224 290 224 360z" fill="#e8a33d" />
        <path d="M222 306 L262 336" stroke="#e8a33d" strokeWidth="12" strokeLinecap="round" />
        <path d="M190 360 V392 M210 360 V392" stroke="#34495e" strokeWidth="11" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="360" cy="258" r="15" fill="#c68a62" />
        <path d="M345 256 Q360 232 375 256 Q360 246 345 256z" fill="#1f1a17" />
        <path d="M336 358 Q336 288 360 286 Q384 288 384 358z" fill="#f7f3e8" />
        <path d="M338 306 L296 336" stroke="#f7f3e8" strokeWidth="12" strokeLinecap="round" />
        <path d="M350 358 V392 M370 358 V392" stroke="#2e6b4e" strokeWidth="11" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="410" cy="300" r="12" fill="#f1c9a5" />
        <path d="M398 298 Q410 280 422 298 Q410 292 398 298z" fill="#8a4b2a" />
        <path d="M392 374 Q392 318 410 316 Q428 318 428 374z" fill="#d96c6c" />
        <path d="M400 374 V398 M418 374 V398" stroke="#34495e" strokeWidth="9" strokeLinecap="round" />
      </g>
      {/* shovel */}
      <path d="M244 300 L270 352" stroke="#8d6e4a" strokeWidth="5" strokeLinecap="round" />
      <path d="M262 346 L280 352 L270 366 L256 360z" fill="#9aa5ab" />
    </svg>
  )
}
