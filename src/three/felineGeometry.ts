import * as THREE from 'three'
import type { CatModelParams } from './catPhenotypeToModel'

interface CrossSection {
  x:number
  y:number
  radiusY:number
  radiusZ:number
  boneA:number
  boneB:number
  mix:number
  fur:number
}

export interface FelineLandmarks {
  bodyY:number
  shoulderX:number
  hipX:number
  headX:number
  headY:number
  muzzleX:number
}

export function felineLandmarks(model:CatModelParams):FelineLandmarks {
  const bodyY=1.32
  const shoulderX=model.bodyLength*.30
  const hipX=-model.bodyLength*.30
  const headX=model.bodyLength*.515+.22*model.headLength
  const headY=bodyY+.19
  const muzzleX=headX+.275+.055*model.muzzleScale
  return {bodyY,shoulderX,hipX,headX,headY,muzzleX}
}

export function createFelineCoreGeometry(model:CatModelParams) {
  const {bodyY,shoulderX,hipX}=felineLandmarks(model)
  const L=model.bodyLength
  const H=model.bodyHeight
  const W=model.bodyWidth
  const neck=model.neckScale
  const fur=model.furInflation

  // Reference-calibrated adult-cat torso: broad rib cage, visible waist,
  // rounded pelvis/haunches and a low neck transition. This deliberately
  // avoids the double-hump / tube silhouette of the earlier build.
  const sections:CrossSection[]=[
    {x:-L*.55,y:bodyY+.015,radiusY:H*.30*model.haunchScale,radiusZ:W*.40*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.35},
    {x:-L*.44,y:bodyY+.045+model.rumpLift,radiusY:H*.69*model.haunchScale,radiusZ:W*.76*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.62},
    {x:hipX,y:bodyY+.035+model.rumpLift*.55,radiusY:H*.82*model.haunchScale,radiusZ:W*.88*model.pelvisWidth,boneA:0,boneB:1,mix:.12,fur:.64},
    {x:-L*.17,y:bodyY-.025,radiusY:H*.69*model.abdomenScale,radiusZ:W*.70*model.waistScale,boneA:0,boneB:1,mix:.48,fur:.38},
    {x:-L*.04,y:bodyY-.035,radiusY:H*.66*model.abdomenScale,radiusZ:W*.67*model.waistScale,boneA:0,boneB:1,mix:.80,fur:.34},
    {x:L*.09,y:bodyY-.018,radiusY:H*.74*model.abdomenScale,radiusZ:W*.73,boneA:1,boneB:2,mix:.24,fur:.38},
    {x:L*.19,y:bodyY+.005,radiusY:H*.84*model.chestDepth,radiusZ:W*.82*model.chestWidth,boneA:1,boneB:2,mix:.58,fur:.48},
    {x:shoulderX,y:bodyY+.035,radiusY:H*.90*model.chestScale*model.chestDepth,radiusZ:W*.87*model.chestWidth,boneA:1,boneB:2,mix:.84,fur:.58},
    {x:L*.39,y:bodyY+.060,radiusY:H*.72*model.chestScale,radiusZ:W*.68*model.chestWidth,boneA:2,boneB:3,mix:.38,fur:.70},
    {x:L*.46,y:bodyY+.105,radiusY:H*.48*neck,radiusZ:W*.46*neck,boneA:2,boneB:3,mix:.72,fur:.78},
    {x:L*.525,y:bodyY+.145,radiusY:H*.29*neck,radiusZ:W*.30*neck,boneA:3,boneB:4,mix:.34,fur:.52},
  ]

  const radialSegments=36
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
    const furGain=1+fur*s.fur
    for (let j=0;j<=radialSegments;j++) {
      const v=j/radialSegments
      const angle=v*Math.PI*2
      const c=Math.cos(angle)
      const sin=Math.sin(angle)

      const underside=c<0?.74:1
      const dorsalLift=c>0?Math.pow(c,5)*s.radiusY*.028:0
      const tuck=c<-.45?Math.pow(Math.abs(c),3)*s.radiusY*.055:0
      const sideFlatten=1-Math.pow(Math.max(0,Math.abs(sin)-.78),2)*.08

      positions.push(
        s.x,
        s.y+c*s.radiusY*underside*furGain+dorsalLift+tuck,
        sin*s.radiusZ*furGain*sideFlatten,
      )
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

export function createCatHeadGeometry(model:CatModelParams) {
  const geometry=new THREE.SphereGeometry(1,42,30)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.335*model.headLength
  const sy=.315*model.skullScale
  const sz=.345*model.skullScale

  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const front=Math.max(0,x)
    const rear=Math.max(0,-x)
    const lower=Math.max(0,-y)
    const cheek=1+lower*.10*model.cheekScale+front*.035
    const temple=1-Math.max(0,y-.18)*.06
    const frontFlatten=1-front*.08
    pos.setXYZ(
      i,
      x*sx*(1-rear*.05),
      y*sy*(1+Math.max(0,y)*.025),
      z*sz*cheek*temple*frontFlatten,
    )
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createCatMuzzleGeometry(model:CatModelParams) {
  const geometry=new THREE.SphereGeometry(1,34,22)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.155*model.muzzleScale
  const sy=.105
  const sz=.215*model.skullScale
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const lower=Math.max(0,-y)
    const split=1+Math.abs(z)*.08
    pos.setXYZ(i,x*sx,y*sy*(1-lower*.04),z*sz*split)
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createSmoothTailGeometry(model:CatModelParams,furLength:number) {
  const length=1.70*model.tailScale
  const radius=(.067+model.bodyWidth*.012)*model.tailThickness+model.furInflation*.070
  const points=[
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(-length*.18,.00,.00),
    new THREE.Vector3(-length*.40,.035,.012),
    new THREE.Vector3(-length*.62,.10,.022),
    new THREE.Vector3(-length*.82,.20,.020),
    new THREE.Vector3(-length,.30,.008),
  ]
  const curve=new THREE.CatmullRomCurve3(points)
  const geometry=new THREE.TubeGeometry(curve,52,radius,12,false)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const t=Math.min(1,Math.max(0,Math.abs(x)/Math.max(.01,length)))
    const taper=1-t*.45
    const p=curve.getPoint(t)
    pos.setXYZ(i,x,p.y+(pos.getY(i)-p.y)*taper,p.z+(pos.getZ(i)-p.z)*taper)
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createEarGeometry(width:number,height:number,depth:number) {
  const vertices=new Float32Array([
    0,height,0,
    -width,0,depth,
    width*.78,0,depth*.72,
    0,height,0,
    width*.78,0,-depth*.72,
    -width,0,-depth,
    0,height,0,
    -width,0,-depth,
    -width,0,depth,
    0,height,0,
    width*.78,0,depth*.72,
    width*.78,0,-depth*.72,
    -width,0,depth,
    -width,0,-depth,
    width*.78,0,-depth*.72,
    -width,0,depth,
    width*.78,0,-depth*.72,
    width*.78,0,depth*.72,
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
