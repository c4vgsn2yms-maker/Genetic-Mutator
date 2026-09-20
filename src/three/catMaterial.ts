import * as THREE from 'three'
import type { Individual } from '../types'
import { rngFromSeed } from '../genetics'

export interface VisibleAppearance {
  baseCoatColor: string
  patternColor: string
  patternContrast: number
  whiteCoverage: number
  skinColor: string
  noseColor: string
  pawPadColor: string
  earInnerColor: string
  eyeColor: string
  isAlbino: boolean
  isMelanistic: boolean
  isLeucistic: boolean
  isPiebald: boolean
}

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))

function mixHex(a:string,b:string,t:number) {
  const ca=new THREE.Color(a)
  const cb=new THREE.Color(b)
  ca.lerp(cb,clamp(t,0,1))
  return `#${ca.getHexString()}`
}

export function resolveVisibleAppearance(animal: Individual): VisibleAppearance {
  const p=animal.phenotype
  const labels=p.mutationLabels.map(label=>label.toLowerCase())
  const isAlbino=labels.includes('albinism') || labels.includes('albino')
  const isMelanistic=labels.includes('melanism') || labels.includes('melanistic')
  const isLeucistic=labels.includes('leucism') || labels.includes('leucistic')
  const isPiebald=labels.includes('piebald')

  const normalPattern=p.patternHex || '#29241f'
  let appearance:VisibleAppearance={
    baseCoatColor:p.coatHex,
    patternColor:normalPattern,
    patternContrast:p.pattern==='solid'?0:.82,
    whiteCoverage:clamp(p.whiteFraction,0,.96),
    skinColor:'#765d58',
    noseColor:'#5b3d42',
    pawPadColor:'#4c383c',
    earInnerColor:'#b98282',
    eyeColor:'#91a65b',
    isAlbino,
    isMelanistic,
    isLeucistic,
    isPiebald,
  }

  // Albinism is epistatic here: even if a cat also carries/expresses a
  // melanistic locus, the lack of melanin controls the visible phenotype.
  if (isAlbino) {
    appearance={
      ...appearance,
      baseCoatColor:'#f7f1e8',
      patternColor:'#eaded4',
      patternContrast:.055,
      whiteCoverage:0,
      skinColor:'#efb6be',
      noseColor:'#eca5b0',
      pawPadColor:'#e8a7b0',
      earInnerColor:'#efb8bf',
      eyeColor:'#c8cde9',
    }
  } else if (isLeucistic) {
    appearance={
      ...appearance,
      baseCoatColor:mixHex(p.coatHex,'#f7f5ef',.88),
      patternColor:mixHex(normalPattern,'#eeeae2',.90),
      patternContrast:.10,
      whiteCoverage:Math.max(.76,appearance.whiteCoverage),
      skinColor:'#7a6460',
      noseColor:'#80666a',
      pawPadColor:'#70595d',
      earInnerColor:'#d5b2b0',
    }
  } else if (isMelanistic) {
    appearance={
      ...appearance,
      baseCoatColor:'#111315',
      patternColor:'#25282b',
      patternContrast:.18,
      skinColor:'#171719',
      noseColor:'#111214',
      pawPadColor:'#101113',
      earInnerColor:'#342b2d',
      eyeColor:'#a6a25a',
    }
  }

  if (isPiebald && !isAlbino) {
    appearance.whiteCoverage=Math.max(
      appearance.whiteCoverage,
      clamp(.18+p.whiteFraction*.82,.18,.92),
    )
  }

  return appearance
}

function drawIrregularWhitePatch(
  ctx:CanvasRenderingContext2D,
  r:()=>number,
  cx:number,
  cy:number,
  radiusX:number,
  radiusY:number,
) {
  ctx.beginPath()
  const points=18
  for (let i=0;i<=points;i++) {
    const angle=(i/points)*Math.PI*2
    const wobble=.72+r()*.46
    const x=cx+Math.cos(angle)*radiusX*wobble
    const y=cy+Math.sin(angle)*radiusY*wobble
    if (i===0) ctx.moveTo(x,y)
    else ctx.lineTo(x,y)
  }
  ctx.closePath()
  ctx.fill()
}

export function createCoatTexture(animal: Individual, appearance=resolveVisibleAppearance(animal)) {
  const canvas=document.createElement('canvas')
  canvas.width=768
  canvas.height=384
  const ctx=canvas.getContext('2d')
  if (!ctx) return null

  const p=animal.phenotype
  const r=rngFromSeed('3d-coat-'+animal.seed)

  const base=ctx.createLinearGradient(0,0,0,canvas.height)
  base.addColorStop(0,mixHex(appearance.baseCoatColor,'#ffffff',.08))
  base.addColorStop(.55,appearance.baseCoatColor)
  base.addColorStop(1,mixHex(appearance.baseCoatColor,'#111111',.22))
  ctx.fillStyle=base
  ctx.fillRect(0,0,canvas.width,canvas.height)

  const visiblePattern=p.pattern!=='solid' && appearance.patternContrast>.015
  if (visiblePattern) {
    const count=Math.round(34+p.patternDensity*82)
    for (let i=0;i<count;i++) {
      const x=r()*canvas.width
      const y=20+r()*(canvas.height-40)
      const rx=5+r()*15
      const ry=3+r()*9
      ctx.save()
      ctx.translate(x,y)
      ctx.rotate((r()-.5)*.95)
      ctx.globalAlpha=clamp(appearance.patternContrast*(.72+r()*.24),.02,.95)
      ctx.beginPath()
      ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2)

      if (p.pattern==='rosetted') {
        ctx.strokeStyle=appearance.patternColor
        ctx.lineWidth=2.5+r()*3
        ctx.stroke()
        if (r()>.30) {
          ctx.beginPath()
          ctx.ellipse((r()-.5)*3,(r()-.5)*2,Math.max(1,rx*.34),Math.max(1,ry*.30),0,0,Math.PI*2)
          ctx.fillStyle=appearance.patternColor
          ctx.globalAlpha*=.48
          ctx.fill()
        }
      } else {
        ctx.fillStyle=appearance.patternColor
        ctx.fill()
      }
      ctx.restore()
    }
  }

  if (appearance.whiteCoverage>.035) {
    const amount=clamp(appearance.whiteCoverage,0,.96)
    ctx.fillStyle='#f3f1eb'
    ctx.globalAlpha=clamp(.78+amount*.20,.78,.98)

    // Several overlapping irregular islands look more like piebald white
    // spotting than the old single oval mask.
    drawIrregularWhitePatch(
      ctx,r,
      canvas.width*.54,
      canvas.height*(1.04-amount*.38),
      canvas.width*(.17+amount*.23),
      canvas.height*(.10+amount*.25),
    )
    if (amount>.28) {
      drawIrregularWhitePatch(
        ctx,r,
        canvas.width*.12,
        canvas.height*.56,
        canvas.width*(.06+amount*.10),
        canvas.height*(.18+amount*.18),
      )
    }
    if (amount>.52) {
      drawIrregularWhitePatch(
        ctx,r,
        canvas.width*.84,
        canvas.height*.42,
        canvas.width*(.07+amount*.12),
        canvas.height*(.15+amount*.14),
      )
    }
  }

  // Fine coat-level variation keeps black/melanistic and pale coats from
  // looking like flat plastic while remaining subtle enough for mutations.
  ctx.globalAlpha=appearance.isAlbino?.045:.09
  for (let i=0;i<1500;i++) {
    ctx.fillStyle=r()>.5?'#ffffff':'#000000'
    ctx.fillRect(r()*canvas.width,r()*canvas.height,1+r()*1.4,1+r()*1.4)
  }
  ctx.globalAlpha=1

  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.wrapS=THREE.RepeatWrapping
  texture.wrapT=THREE.ClampToEdgeWrapping
  texture.repeat.set(1.15,1)
  texture.needsUpdate=true
  return texture
}

export function coatRoughness(animal: Individual) {
  return Math.max(.52,Math.min(.88,.76-animal.phenotype.furLength*.12))
}
