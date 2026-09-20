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
  const bodyY=1.30
  const shoulderX=model.bodyLength*.295
  const hipX=-model.bodyLength*.305
  const headX=model.bodyLength*.505+.185*model.headLength
  const headY=bodyY+.17
  const muzzleX=headX+.235+.045*model.muzzleScale
  return {bodyY,shoulderX,hipX,headX,headY,muzzleX}
}

export function createFelineCoreGeometry(model:CatModelParams) {
  const {bodyY,shoulderX,hipX}=felineLandmarks(model)
  const L=model.bodyLength
  const H=model.bodyHeight
  const W=model.bodyWidth
  const neck=model.neckScale
  const fur=model.furInflation

  // One continuous feline torso. Centers and radii are tuned to keep the
  // dorsal line nearly continuous while the underside carries the visible
  // chest depth, waist and abdominal tuck.
  const sections:CrossSection[]=[
    {x:-L*.55,y:bodyY+.01,radiusY:H*.27*model.haunchScale,radiusZ:W*.36*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.28},
    {x:-L*.46,y:bodyY+.02+model.rumpLift*.35,radiusY:H*.58*model.haunchScale,radiusZ:W*.68*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.54},
    {x:hipX,y:bodyY+.02+model.rumpLift*.20,radiusY:H*.72*model.haunchScale,radiusZ:W*.82*model.pelvisWidth,boneA:0,boneB:1,mix:.12,fur:.58},
    {x:-L*.22,y:bodyY+.005,radiusY:H*.66*model.abdomenScale,radiusZ:W*.73*model.waistScale,boneA:0,boneB:1,mix:.38,fur:.38},
    {x:-L*.11,y:bodyY+.025,radiusY:H*.57*model.abdomenScale,radiusZ:W*.66*model.waistScale,boneA:0,boneB:1,mix:.65,fur:.30},
    {x:0,y:bodyY+.035,radiusY:H*.55*model.abdomenScale,radiusZ:W*.65*model.waistScale,boneA:1,boneB:2,mix:.10,fur:.28},
    {x:L*.10,y:bodyY+.018,radiusY:H*.66*model.abdomenScale,radiusZ:W*.72,boneA:1,boneB:2,mix:.30,fur:.34},
    {x:L*.20,y:bodyY-.005,radiusY:H*.78*model.chestDepth,radiusZ:W*.80*model.chestWidth,boneA:1,boneB:2,mix:.58,fur:.42},
    {x:shoulderX,y:bodyY+.005,radiusY:H*.84*model.chestScale*model.chestDepth,radiusZ:W*.84*model.chestWidth,boneA:1,boneB:2,mix:.84,fur:.48},
    {x:L*.38,y:bodyY+.02,radiusY:H*.68*model.chestScale,radiusZ:W*.65*model.chestWidth,boneA:2,boneB:3,mix:.35,fur:.60},
    {x:L*.45,y:bodyY+.07,radiusY:H*.47*neck,radiusZ:W*.46*neck,boneA:2,boneB:3,mix:.70,fur:.68},
    {x:L*.51,y:bodyY+.115,radiusY:H*.29*neck,radiusZ:W*.31*neck,boneA:3,boneB:4,mix:.35,fur:.46},
  ]

  const radialSegments=40
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

      const underside=c<0?.76:1
      const dorsalLift=c>0?Math.pow(c,6)*s.radiusY*.016:0
      const bellyTuck=c<-.35?Math.pow(Math.abs(c),2.6)*s.radiusY*.07:0
      const sideFlatten=1-Math.pow(Math.max(0,Math.abs(sin)-.80),2)*.07

      positions.push(
        s.x,
        s.y+c*s.radiusY*underside*furGain+dorsalLift+bellyTuck,
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
  const geometry=new THREE.SphereGeometry(1,44,32)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.285*model.headLength
  const sy=.265*model.skullScale
  const sz=.305*model.skullScale

  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const front=Math.max(0,x)
    const rear=Math.max(0,-x)
    const lower=Math.max(0,-y)
    const upper=Math.max(0,y)
    const cheek=1+lower*.075*model.cheekScale+front*.025
    const temple=1-upper*.045
    const foreheadFlatten=1-front*.11
    pos.setXYZ(
      i,
      x*sx*(1-rear*.045),
      y*sy*(1-upper*.035),
      z*sz*cheek*temple*foreheadFlatten,
    )
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createCatMuzzleGeometry(model:CatModelParams) {
  const geometry=new THREE.SphereGeometry(1,36,24)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.132*model.muzzleScale
  const sy=.092
  const sz=.192*model.skullScale
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const front=Math.max(0,x)
    const lower=Math.max(0,-y)
    const split=1+Math.abs(z)*.065
    pos.setXYZ(
      i,
      x*sx*(1-front*.06),
      y*sy*(1-lower*.03),
      z*sz*split,
    )
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createSmoothTailGeometry(model:CatModelParams,furLength:number) {
  const length=1.68*model.tailScale
  const radius=(.068+model.bodyWidth*.012)*model.tailThickness+model.furInflation*.065
  const points=[
    new THREE.Vector3(.04,.00,0),
    new THREE.Vector3(-length*.15,.00,.00),
    new THREE.Vector3(-length*.36,.02,.008),
    new THREE.Vector3(-length*.58,.07,.014),
    new THREE.Vector3(-length*.79,.15,.012),
    new THREE.Vector3(-length,.23,.004),
  ]
  const curve=new THREE.CatmullRomCurve3(points)
  const geometry=new THREE.TubeGeometry(curve,56,radius,12,false)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const t=Math.min(1,Math.max(0,Math.abs(x)/Math.max(.01,length)))
    const taper=1-t*.48
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
