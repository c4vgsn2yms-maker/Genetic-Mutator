import { useMemo } from 'react'
import type { Individual } from './types'
import { rngFromSeed } from './genetics'
import { resolveVisibleAppearance } from './three/catMaterial'

interface Props {
  animal:Individual
  compact?:boolean
}

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))

export function FoxPreview({animal,compact=false}:Props) {
  const p=animal.phenotype
  const appearance=useMemo(()=>resolveVisibleAppearance(animal),[animal])
  const r=rngFromSeed(`fox-preview-${animal.seed}`)
  const uid=animal.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,12)

  const bodyScale=clamp(p.bodyLengthCm/64,.70,1.34)
  const legScale=clamp(p.legRatio/.69,.72,1.32)
  const earScale=clamp(p.earSize/1.14,.72,1.38)
  const muzzleScale=clamp(p.muzzleLength/1.36,.78,1.30)
  const tailScale=clamp((p.tailLengthCm/Math.max(1,p.bodyLengthCm))/.68,.70,1.34)
  const fur=clamp(.88+p.furLength*.20,.90,1.10)

  const spots=p.pattern==='solid'?[]:Array.from({length:Math.round(5+p.patternDensity*12)},(_,i)=>({
    i,
    x:128+r()*142,
    y:91+r()*50,
    rx:3+r()*5,
    ry:2+r()*4,
  }))

  return (
    <div className={compact?'cat-preview compact':'cat-preview'}>
      <svg viewBox="0 0 420 240" role="img" aria-label={`Fox preview of ${animal.name}`}>
        <defs>
          <linearGradient id={`foxcoat-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={appearance.baseCoatColor} />
            <stop offset="1" stopColor={appearance.baseCoatColor} stopOpacity=".77" />
          </linearGradient>
        </defs>

        <ellipse cx="215" cy="207" rx="150" ry="12" fill="rgba(0,0,0,.18)" />

        <g transform={`translate(${205-205*bodyScale} 0) scale(${bodyScale} 1)`}>
          <path
            d="M112 111 C125 76 166 68 218 76 C265 82 296 102 300 132 C301 151 284 165 252 168 C211 170 167 165 137 153 C114 144 105 129 112 111Z"
            fill={`url(#foxcoat-${uid})`}
            transform={`translate(0 ${120-120*fur}) scale(1 ${fur})`}
          />
          {spots.map(s=>(
            <ellipse key={s.i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={appearance.patternColor} opacity={appearance.patternContrast*.8} />
          ))}
          {appearance.whiteCoverage>.12 && (
            <path
              d="M244 121 C267 103 293 108 304 132 C292 151 267 161 239 157 C230 145 231 132 244 121Z"
              fill="#f4f1ea"
              opacity={Math.min(.96,.52+appearance.whiteCoverage*.45)}
            />
          )}
        </g>

        <g fill={appearance.baseCoatColor} stroke="rgba(20,20,24,.25)" strokeWidth="1.5">
          <g transform={`translate(0 ${176-176*legScale}) scale(1 ${legScale})`}>
            <path d="M144 143 C151 142 158 147 159 157 L157 199 Q153 205 145 202 L138 199 L140 158 Q138 149 144 143Z" />
            <path d="M182 148 C189 147 195 152 196 161 L194 199 Q191 205 183 203 L176 200 L178 160 Q176 152 182 148Z" />
            <path d="M253 149 C261 147 268 152 269 161 L274 197 Q271 204 263 203 L255 200 L254 161 Q251 154 253 149Z" />
            <path d="M286 142 C294 140 301 145 302 154 L311 194 Q309 203 300 203 L292 200 L288 154 Q284 147 286 142Z" />
          </g>
        </g>

        <g transform="translate(0 -2)">
          <path
            d="M294 91 C309 68 336 64 354 79 C369 92 368 115 353 128 C337 142 313 139 298 126 C286 116 284 104 294 91Z"
            fill={appearance.baseCoatColor}
          />
          <path
            d={`M301 84 L${308-4*earScale} ${83-38*earScale} L324 77 Z`}
            fill={appearance.baseCoatColor}
            stroke="rgba(20,20,24,.3)"
            strokeWidth="2"
          />
          <path
            d={`M331 77 L${349+5*earScale} ${80-39*earScale} L356 91 Z`}
            fill={appearance.baseCoatColor}
            stroke="rgba(20,20,24,.3)"
            strokeWidth="2"
          />

          <g transform={`translate(${348-348*muzzleScale} 0) scale(${muzzleScale} 1)`}>
            <path d="M333 101 C351 97 374 103 389 116 C376 129 356 134 337 128 C329 120 328 110 333 101Z" fill={appearance.baseCoatColor} />
            <path d="M384 113 Q392 112 397 117 Q394 123 388 123 Q384 121 384 113Z" fill={appearance.noseColor} />
          </g>

          <ellipse cx="319" cy="100" rx="4.4" ry="6.2" fill={appearance.eyeColor} />
          <ellipse cx="347" cy="98" rx="4.2" ry="6.0" fill={appearance.eyeColor} />
          <ellipse cx="319" cy="100" rx="1.1" ry="4.4" fill="#111" />
          <ellipse cx="347" cy="98" rx="1.1" ry="4.3" fill="#111" />
        </g>

        <g transform={`translate(${112-112*tailScale} ${115-115*tailScale}) scale(${tailScale})`}>
          <path d="M119 120 C78 117 42 99 35 70 C29 47 49 32 72 42 C92 50 100 72 88 87 C79 99 62 101 50 94" fill="none" stroke={appearance.baseCoatColor} strokeWidth={18+animal.phenotype.furLength*8} strokeLinecap="round" />
          <path d="M50 94 C44 89 39 82 36 73" fill="none" stroke="#f3eee8" strokeWidth="13" strokeLinecap="round" opacity={appearance.isMelanistic?.15:.88} />
        </g>
      </svg>

      {!compact && (
        <div className="preview-caption">
          <strong>{animal.name}</strong>
          <span>{p.coatName} · fox</span>
        </div>
      )}
    </div>
  )
}
