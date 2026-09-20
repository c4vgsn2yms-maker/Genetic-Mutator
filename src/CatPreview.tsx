import type { Individual } from './types'
import { rngFromSeed } from './genetics'

interface Props {
  animal: Individual
  compact?: boolean
}

export function CatPreview({ animal, compact = false }: Props) {
  const p = animal.phenotype
  const r = rngFromSeed(`preview-${animal.seed}`)
  const uid = animal.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,12)
  const bodyScaleX = Math.max(.78, Math.min(1.48, p.bodyLengthCm / 66))
  const bodyScaleY = Math.max(.78, Math.min(1.38, p.weightKg ** .16 / 1.36))
  const leg = Math.max(.78, Math.min(1.34, p.legRatio / .60))
  const headScale = Math.max(.82, Math.min(1.30, p.skullWidth))
  const muzzle = Math.max(.76, Math.min(1.26, p.muzzleLength))
  const tailScale = Math.max(.72, Math.min(1.55, p.tailLengthCm / Math.max(1,p.bodyLengthCm) / .68))
  const spotCount = p.pattern === 'solid' ? 0 : Math.round(9 + p.patternDensity * 20)
  const spots = Array.from({length:spotCount}, (_,i) => {
    const x = 116 + r()*170
    const y = 82 + r()*66
    const rx = p.pattern === 'rosetted' ? 5 + r()*5 : 3 + r()*4
    const ry = rx * (.55 + r()*.55)
    return {i,x,y,rx,ry,rot:(r()-.5)*70}
  })

  const whitePatch = p.whiteFraction > .03
    ? <path d="M215 126 C250 104 286 112 302 143 C275 167 233 169 201 153 Z" fill="#f3eee8" opacity={Math.min(.98,.45+p.whiteFraction*.6)} />
    : null

  return (
    <div className={compact ? 'cat-preview compact' : 'cat-preview'}>
      <svg viewBox="0 0 420 240" role="img" aria-label={`Procedural preview of ${animal.name}`}>
        <defs>
          <linearGradient id={`coat-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.coatHex} />
            <stop offset="1" stopColor={p.coatHex} stopOpacity=".78" />
          </linearGradient>
          <filter id={`soft-${uid}`}>
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
          <clipPath id={`torso-${uid}`}>
            <ellipse cx="205" cy="120" rx="94" ry="49" />
          </clipPath>
        </defs>

        <ellipse cx="212" cy="207" rx="145" ry="13" fill="rgba(0,0,0,.18)" />

        <g transform={`translate(${205 - 205*bodyScaleX} ${120 - 120*bodyScaleY}) scale(${bodyScaleX} ${bodyScaleY})`}>
          <ellipse cx="205" cy="120" rx="94" ry="49" fill={`url(#coat-${uid})`} />
          <path d="M132 106 C143 79 165 69 189 72 C173 91 172 127 181 160 C155 155 135 137 132 106Z" fill={p.coatHex} opacity=".92" />
          {spots.map(s => (
            <g key={s.i} transform={`rotate(${s.rot} ${s.x} ${s.y})`} clipPath={`url(#torso-${uid})`}>
              {p.pattern === 'rosetted' ? (
                <>
                  <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill="none" stroke={p.patternHex} strokeWidth="3.2" opacity=".92" />
                  <ellipse cx={s.x+1} cy={s.y} rx={Math.max(1,s.rx-3.2)} ry={Math.max(1,s.ry-2.2)} fill={p.coatHex} opacity=".86" />
                </>
              ) : (
                <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={p.patternHex} opacity=".88" />
              )}
            </g>
          ))}
          {whitePatch}
        </g>

        <g transform={`translate(${317 - 317*headScale} ${88 - 88*headScale}) scale(${headScale})`}>
          <path d="M297 71 L309 35 L326 68 Z" fill={p.coatHex} stroke="rgba(20,20,24,.4)" strokeWidth="2" />
          <path d="M333 68 L351 36 L357 78 Z" fill={p.coatHex} stroke="rgba(20,20,24,.4)" strokeWidth="2" />
          <path d="M307 64 C320 50 347 55 358 77 C368 96 359 121 337 130 C316 139 292 126 287 105 C282 88 289 74 307 64Z" fill={p.coatHex} />
          <ellipse cx="303" cy="91" rx="4.4" ry="6.2" fill="#d7cf9a" />
          <ellipse cx="345" cy="91" rx="4.4" ry="6.2" fill="#d7cf9a" />
          <ellipse cx="303" cy="91" rx="1.2" ry="4.4" fill="#111" />
          <ellipse cx="345" cy="91" rx="1.2" ry="4.4" fill="#111" />
          <g transform={`translate(${328 - 328*muzzle} ${109 - 109*muzzle}) scale(${muzzle} 1)`}>
            <ellipse cx="328" cy="109" rx="21" ry="15" fill="rgba(242,225,211,.42)" />
            <path d="M321 104 Q328 99 335 104 Q333 112 328 113 Q323 112 321 104Z" fill="#5d4545" />
            <path d="M328 113 L328 120" stroke="#3a2b2b" strokeWidth="1.5" />
          </g>
        </g>

        <g fill={p.coatHex} stroke="rgba(15,15,18,.22)" strokeWidth="1.5">
          <g transform={`translate(0 ${174-174*leg}) scale(1 ${leg})`}>
            <path d="M141 142 C149 142 156 146 157 154 L156 196 Q153 204 145 202 L137 199 L139 154 Q138 147 141 142Z" />
            <path d="M176 149 C184 149 190 153 191 161 L189 199 Q186 206 178 203 L171 201 L173 161 Q172 154 176 149Z" />
            <path d="M253 149 C261 148 267 153 268 161 L272 197 Q270 204 262 203 L254 201 L253 161 Q250 154 253 149Z" />
            <path d="M283 140 C291 139 298 144 299 152 L307 195 Q305 203 297 203 L288 201 L285 153 Q281 146 283 140Z" />
          </g>
        </g>

        <g transform={`translate(${104-104*tailScale} ${117-117*tailScale}) scale(${tailScale})`}>
          <path d="M115 116 C72 100 50 68 65 48 C78 30 101 43 92 60 C84 74 69 68 70 58" fill="none" stroke={p.coatHex} strokeWidth="15" strokeLinecap="round" />
          <path d="M115 116 C72 100 50 68 65 48" fill="none" stroke="rgba(20,20,25,.12)" strokeWidth="2" strokeLinecap="round" />
        </g>

        {p.whiteFraction > .3 && (
          <g opacity={Math.min(.92,p.whiteFraction)}>
            <path d="M293 75 C304 66 318 65 327 71 C315 82 308 102 309 121 C296 116 288 103 288 91 C288 84 290 79 293 75Z" fill="#f3eee8" />
            <path d="M139 172 L157 172 L156 198 Q152 205 144 202 L138 199Z" fill="#f3eee8" />
          </g>
        )}

        <path d="M114 111 C122 91 137 80 154 76" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="preview-caption">
          <strong>{animal.name}</strong>
          <span>{p.coatName} · {p.pattern}</span>
        </div>
      )}
    </div>
  )
}
