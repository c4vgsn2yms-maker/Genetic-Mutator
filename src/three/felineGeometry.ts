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
  fur: number
  face?: boolean
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
  const bodyY=1.46
  const shoulderX=model.bodyLength*.285
  const hipX=-model.bodyLength*.315
  const headX=model.bodyLength*.525+.43*model.headLength
  const headY=bodyY+.31
  const muzzleX=headX+.35+.13*model.muzzleScale
  return {bodyY,shoulderX,hipX,headX,headY,muzzleX}
}

export function createFelineCoreGeometry(model: CatModelParams) {
  const {bodyY,shoulderX,hipX}=felineLandmarks(model)
  const L=model.bodyLength
  const H=model.bodyHeight
  const W=model.bodyWidth
  const neck=model.neckScale
  const fur=model.furInflation

  // A single lofted feline surface. The waist, deep chest, raised rump,
  // narrow neck and wedge-shaped head keep the silhouette feline across
  // inherited size/build extremes.
  const sections: CrossSection[]=[
    {x:-L*.585,y:bodyY+.03+model.rumpLift*.35,radiusY:H*.34*model.haunchScale,radiusZ:W*.43*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.45},
    {x:-L*.51,y:bodyY+.08+model.rumpLift,radiusY:H*.70*model.haunchScale,radiusZ:W*.82*model.pelvisWidth,boneA:0,boneB:0,mix:0,fur:.72},
    {x:hipX,y:bodyY+.07+model.rumpLift,radiusY:H*.91*model.haunchScale,radiusZ:W*.98*model.pelvisWidth,boneA:0,boneB:1,mix:.10,fur:.72},
    {x:-L*.20,y:bodyY-.01,radiusY:H*.75*model.abdomenScale,radiusZ:W*.73*model.waistScale,boneA:0,boneB:1,mix:.48,fur:.42},
    {x:-L*.08,y:bodyY-.035,radiusY:H*.71*model.abdomenScale,radiusZ:W*.68*model.waistScale,boneA:0,boneB:1,mix:.82,fur:.38},
    {x:L*.08,y:bodyY-.015,radiusY:H*.80*model.abdomenScale,radiusZ:W*.76,boneA:1,boneB:2,mix:.22,fur:.44},
    {x:L*.20,y:bodyY+.035,radiusY:H*.93*model.chestDepth,radiusZ:W*.91*model.chestWidth,boneA:1,boneB:2,mix:.62,fur:.58},
    {x:shoulderX,y:bodyY+.10,radiusY:H*1.02*model.chestScale*model.chestDepth,radiusZ:W*1.00*model.chestWidth,boneA:1,boneB:2,mix:.86,fur:.76},
    {x:L*.39,y:bodyY+.15,radiusY:H*.79*model.chestScale,radiusZ:W*.74*model.chestWidth,boneA:2,boneB:3,mix:.34,fur:.95},
    {x:L*.47,y:bodyY+.22,radiusY:H*.58*neck,radiusZ:W*.57*neck,boneA:2,boneB:3,mix:.72,fur:1.05},
    {x:L*.535,y:bodyY+.29,radiusY:H*.43*neck,radiusZ:W*.44*neck,boneA:3,boneB:4,mix:.20,fur:.82},
    {x:L*.59,y:bodyY+.33,radiusY:H*.31*neck,radiusZ:W*.33*neck,boneA:3,boneB:4,mix:.55,fur:.55},
  ]

  const radialSegments=34
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

      // Flatten the belly, keep a clean dorsal arc and broaden the lower
      // face slightly for whisker pads/cheeks without adding balloon meshes.
      const underside=c<0?.70:1
      const dorsalLift=c>0?Math.pow(c,4)*s.radiusY*.055:0
      const bellyTuck=c<-.42?Math.pow(Math.abs(c),3)*s.radiusY*.045:0
      const faceCheek=s.face && c<.18 ? 1+Math.max(0,1-Math.abs(c))*.055*model.cheekScale : 1
      const dorsalNarrow=s.face && c>.25 ? .96 : 1

      const y=s.y+c*s.radiusY*underside*furGain+dorsalLift+bellyTuck
      const z=sin*s.radiusZ*furGain*faceCheek*dorsalNarrow

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

export function createCatHeadGeometry(model: CatModelParams) {
  const geometry=new THREE.SphereGeometry(1,40,28)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.46*model.headLength
  const sy=.43*model.skullScale
  const sz=.45*model.skullScale

  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const front=Math.max(0,x)
    const rear=Math.max(0,-x)
    const cheek=1+Math.max(0,.25-Math.abs(y))*.16*model.cheekScale
    const faceNarrow=1-front*.15
    const crown=1+Math.max(0,y)*.045
    pos.setXYZ(
      i,
      x*sx*(1-rear*.04),
      y*sy*crown,
      z*sz*faceNarrow*cheek,
    )
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createCatMuzzleGeometry(model: CatModelParams) {
  const geometry=new THREE.SphereGeometry(1,30,20)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const sx=.25*model.muzzleScale
  const sy=.145
  const sz=.255*model.skullScale
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const front=Math.max(0,x)
    const taper=1-front*.14
    pos.setXYZ(i,x*sx,y*sy,z*sz*taper)
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createSmoothTailGeometry(model: CatModelParams,furLength:number) {
  const length=1.72*model.tailScale
  const radius=(.060+model.bodyWidth*.014)*model.tailThickness + model.furInflation*.085
  const points=[
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(-length*.20,.015,.01),
    new THREE.Vector3(-length*.42,.08,.025),
    new THREE.Vector3(-length*.64,.20,.04),
    new THREE.Vector3(-length*.82,.38,.035),
    new THREE.Vector3(-length,.56,.015),
  ]
  const curve=new THREE.CatmullRomCurve3(points)
  const geometry=new THREE.TubeGeometry(curve,48,radius,10,false)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  // Subtle distal taper without breaking continuity.
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i)
    const t=Math.min(1,Math.max(0,Math.abs(x)/Math.max(.01,length)))
    const taper=1-t*.32
    const y=pos.getY(i)
    const z=pos.getZ(i)
    const centerY=curve.getPoint(t).y
    const centerZ=curve.getPoint(t).z
    pos.setXYZ(i,x,centerY+(y-centerY)*taper,centerZ+(z-centerZ)*taper)
  }
  pos.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}

export function createEarGeometry(width:number,height:number,depth:number) {
  // Slightly swept, tapered cat pinna rather than a cone.
  const vertices=new Float32Array([
    0, height, 0,
    -width, 0, depth,
    width*.80, 0, depth*.74,
    0, height, 0,
    width*.80, 0, -depth*.74,
    -width, 0, -depth,
    0, height, 0,
    -width, 0, -depth,
    -width, 0, depth,
    0, height, 0,
    width*.80, 0, depth*.74,
    width*.80, 0, -depth*.74,
    -width, 0, depth,
    -width, 0, -depth,
    width*.80, 0, -depth*.74,
    -width, 0, depth,
    width*.80, 0, -depth*.74,
    width*.80, 0, depth*.74,
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
