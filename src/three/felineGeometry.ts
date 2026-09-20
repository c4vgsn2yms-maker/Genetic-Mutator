import * as THREE from 'three'
import type { CatModelParams } from './catPhenotypeToModel'

interface CrossSection {
  x: number
  y: number
  radiusY: number
  radiusZ: number
  boneA: number
  boneB: number
  mix: number
}

export interface FelineLandmarks {
  bodyY: number
  shoulderX: number
  hipX: number
  headX: number
  headY: number
  muzzleX: number
}

export function felineLandmarks(model: CatModelParams): FelineLandmarks {
  const bodyY=1.48
  const shoulderX=model.bodyLength*.28
  const hipX=-model.bodyLength*.29
  const headX=model.bodyLength*.52+.47
  const headY=bodyY+.28
  const muzzleX=headX+.38+.12*model.muzzleScale
  return {bodyY,shoulderX,hipX,headX,headY,muzzleX}
}

export function createFelineCoreGeometry(model: CatModelParams) {
  const {bodyY,shoulderX,hipX,headX,headY,muzzleX}=felineLandmarks(model)
  const L=model.bodyLength
  const H=model.bodyHeight
  const W=model.bodyWidth
  const skull=model.skullScale
  const neck=model.neckScale

  const sections: CrossSection[]=[
    {x:-L*.56,y:bodyY+.03,radiusY:H*.42*model.haunchScale,radiusZ:W*.54*model.pelvisWidth,boneA:0,boneB:0,mix:0},
    {x:-L*.47,y:bodyY+.00,radiusY:H*.78*model.haunchScale,radiusZ:W*.88*model.pelvisWidth,boneA:0,boneB:0,mix:0},
    {x:hipX,y:bodyY+.01,radiusY:H*.98*model.haunchScale,radiusZ:W*1.05*model.pelvisWidth,boneA:0,boneB:1,mix:.12},
    {x:-L*.08,y:bodyY+.01,radiusY:H*.86,radiusZ:W*.86,boneA:0,boneB:1,mix:.86},
    {x:shoulderX,y:bodyY+.08,radiusY:H*1.02*model.chestScale,radiusZ:W*1.01*model.chestWidth,boneA:1,boneB:2,mix:.86},
    {x:L*.40,y:bodyY+.15,radiusY:H*.75*neck,radiusZ:W*.74*neck,boneA:2,boneB:3,mix:.58},
    {x:L*.50,y:bodyY+.22,radiusY:H*.55*neck,radiusZ:W*.55*neck,boneA:3,boneB:4,mix:.18},
    {x:headX-.18,y:headY-.02,radiusY:.42*skull,radiusZ:.41*skull,boneA:3,boneB:4,mix:.72},
    {x:headX+.08,y:headY+.02,radiusY:.48*skull,radiusZ:.47*skull,boneA:4,boneB:4,mix:0},
    {x:headX+.31,y:headY-.01,radiusY:.38*skull,radiusZ:.41*skull,boneA:4,boneB:4,mix:0},
    {x:muzzleX-.10,y:headY-.10,radiusY:.24*model.muzzleScale,radiusZ:.28*skull,boneA:4,boneB:4,mix:0},
    {x:muzzleX+.18*model.muzzleScale,y:headY-.11,radiusY:.12*model.muzzleScale,radiusZ:.16*skull,boneA:4,boneB:4,mix:0},
  ]

  const radialSegments=30
  const positions:number[]=[]
  const uvs:number[]=[]
  const skinIndices:number[]=[]
  const skinWeights:number[]=[]
  const indices:number[]=[]

  const pushSkin=(s:CrossSection)=>{
    skinIndices.push(s.boneA,s.boneB,0,0)
    const mix=s.boneA===s.boneB?0:s.mix
    skinWeights.push(1-mix,mix,0,0)
  }

  for (let i=0;i<sections.length;i++) {
    const s=sections[i]
    const u=i/(sections.length-1)

    for (let j=0;j<=radialSegments;j++) {
      const v=j/radialSegments
      const angle=v*Math.PI*2
      const c=Math.cos(angle)
      const sin=Math.sin(angle)

      const verticalScale=c<0?.74:1
      const dorsalLift=c>0?Math.pow(c,4)*s.radiusY*.06:0
      const ventralTuck=c<-.35?Math.pow(Math.abs(c),3)*s.radiusY*.035:0
      const y=s.y+c*s.radiusY*verticalScale+dorsalLift+ventralTuck
      const z=sin*s.radiusZ

      positions.push(s.x,y,z)
      uvs.push(u,v)
      pushSkin(s)
    }
  }

  const ring=radialSegments+1
  for (let i=0;i<sections.length-1;i++) {
    for (let j=0;j<radialSegments;j++) {
      const a=i*ring+j
      const b=(i+1)*ring+j
      const c=(i+1)*ring+j+1
      const d=i*ring+j+1
      indices.push(a,b,d,b,c,d)
    }
  }

  const addCap=(sectionIndex:number,flip:boolean)=>{
    const s=sections[sectionIndex]
    const center=positions.length/3
    positions.push(s.x,s.y,0)
    uvs.push(sectionIndex===0?0:1,.5)
    pushSkin(s)
    const base=sectionIndex*ring
    for (let j=0;j<radialSegments;j++) {
      if (flip) indices.push(center,base+j+1,base+j)
      else indices.push(center,base+j,base+j+1)
    }
  }
  addCap(0,true)
  addCap(sections.length-1,false)

  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4))
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function createEarGeometry(width:number,height:number,depth:number) {
  const vertices=new Float32Array([
    0, height, 0,
    -width, 0, depth,
    width, 0, depth,
    0, height, 0,
    width, 0, -depth,
    -width, 0, -depth,
    0, height, 0,
    -width, 0, -depth,
    -width, 0, depth,
    0, height, 0,
    width, 0, depth,
    width, 0, -depth,
    -width, 0, depth,
    -width, 0, -depth,
    width, 0, -depth,
    -width, 0, depth,
    width, 0, -depth,
    width, 0, depth,
  ])
  const uv=new Float32Array([
    .5,1,0,0,1,0,
    .5,1,0,0,1,0,
    .5,1,0,0,1,0,
    .5,1,0,0,1,0,
    0,1,0,0,1,0,
    0,1,1,0,1,1,
  ])
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3))
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2))
  geometry.computeVertexNormals()
  return geometry
}
