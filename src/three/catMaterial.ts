import * as THREE from 'three'
import type { Individual } from '../types'
import { rngFromSeed } from '../genetics'

function roundedBlob(
  ctx: CanvasRenderingContext2D,
  x:number,
  y:number,
  rx:number,
  ry:number,
  color:string,
  ring=false,
) {
  ctx.save()
  ctx.translate(x,y)
  ctx.rotate((Math.random()-.5)*.5)
  ctx.beginPath()
  ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2)
  if (ring) {
    ctx.strokeStyle=color
    ctx.lineWidth=Math.max(2,rx*.32)
    ctx.stroke()
  } else {
    ctx.fillStyle=color
    ctx.fill()
  }
  ctx.restore()
}

export function createCoatTexture(animal: Individual) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 384
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const p = animal.phenotype
  const r = rngFromSeed('3d-coat-'+animal.seed)

  const base = ctx.createLinearGradient(0,0,0,canvas.height)
  base.addColorStop(0,p.coatHex)
  base.addColorStop(.55,p.coatHex)
  base.addColorStop(1,'#2b2624')
  ctx.fillStyle=base
  ctx.fillRect(0,0,canvas.width,canvas.height)

  const isAlbino = p.mutationLabels.includes('Albinism')
  const visiblePattern = p.pattern !== 'solid' && !isAlbino
  if (visiblePattern) {
    const count = Math.round(36 + p.patternDensity*76)
    for (let i=0;i<count;i++) {
      const x=r()*canvas.width
      const y=25+r()*(canvas.height-50)
      const rx=5+r()*13
      const ry=3+r()*10
      ctx.save()
      ctx.translate(x,y)
      ctx.rotate((r()-.5)*1.1)
      ctx.beginPath()
      ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2)
      if (p.pattern==='rosetted') {
        ctx.strokeStyle=p.patternHex
        ctx.lineWidth=3+r()*3
        ctx.globalAlpha=.86
        ctx.stroke()
        if (r()>.35) {
          ctx.beginPath()
          ctx.ellipse((r()-.5)*3,(r()-.5)*2,Math.max(1,rx*.35),Math.max(1,ry*.32),0,0,Math.PI*2)
          ctx.fillStyle=p.patternHex
          ctx.globalAlpha=.44
          ctx.fill()
        }
      } else {
        ctx.fillStyle=p.patternHex
        ctx.globalAlpha=.80
        ctx.fill()
      }
      ctx.restore()
    }
  }

  if (p.whiteFraction > .04) {
    const amount=Math.min(.94,p.whiteFraction)
    ctx.globalAlpha=Math.min(.98,.42+amount*.62)
    ctx.fillStyle='#f1eee7'
    ctx.beginPath()
    ctx.ellipse(canvas.width*.54,canvas.height*(1.08-amount*.48),canvas.width*(.24+amount*.28),canvas.height*(.14+amount*.30),0,0,Math.PI*2)
    ctx.fill()

    if (amount>.42) {
      ctx.beginPath()
      ctx.ellipse(canvas.width*.10,canvas.height*.55,canvas.width*.12,canvas.height*.35,0,0,Math.PI*2)
      ctx.fill()
    }
  }

  ctx.globalAlpha=.12
  for (let i=0;i<1200;i++) {
    const shade=r()>.5?'#ffffff':'#000000'
    ctx.fillStyle=shade
    ctx.fillRect(r()*canvas.width,r()*canvas.height,1+r()*1.5,1+r()*1.5)
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
