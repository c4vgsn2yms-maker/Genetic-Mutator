import * as THREE from 'three'
import type { BufferAttribute, Group, Mesh, SkinnedMesh, Texture } from 'three'
import type { Individual } from '../types'

interface FurOptions {
  animal:Individual
  coatTexture:Texture|null
  coatColor:string
}

interface SurfaceSample {
  position:THREE.Vector3
  normal:THREE.Vector3
  u:number
  v:number
  skinIndices:[number,number,number,number]
  skinWeights:[number,number,number,number]
}

interface FurLayer {
  name:'undercoat'|'guard'
  count:number
  lengthScale:number
  widthScale:number
  leanScale:number
  physicsStrength:number
  guideGridX:number
  guideGridY:number
  seedOffset:number
}

interface FurGuidePhysicsState {
  texture:THREE.DataTexture
  data:Uint8Array
  positions:Float32Array
  velocities:Float32Array
  phases:Float32Array
  guideCount:number
  guideGridX:number
  guideGridY:number
  stiffness:number
  damping:number
  gravity:number
  wind:number
  inertia:number
  maxBend:number
}

function clamp(v:number,min:number,max:number) {
  return Math.max(min,Math.min(max,v))
}

function fract(v:number) {
  return v-Math.floor(v)
}

function makeRng(seed:number) {
  let state=(seed>>>0) || 0x9e3779b9
  return ()=>{
    state+=0x6D2B79F5
    let t=state
    t=Math.imul(t^(t>>>15),t|1)
    t^=t+Math.imul(t^(t>>>7),t|61)
    return ((t^(t>>>14))>>>0)/4294967296
  }
}

function hashName(name:string) {
  let h=2166136261
  for (let i=0;i<name.length;i++) {
    h^=name.charCodeAt(i)
    h=Math.imul(h,16777619)
  }
  return h>>>0
}

function component(attribute:BufferAttribute,index:number,slot:number) {
  if (slot===0) return attribute.getX(index)
  if (slot===1) return attribute.getY(index)
  if (slot===2) return attribute.getZ(index)
  return attribute.getW(index)
}

function isEligibleBodyMesh(mesh:Mesh) {
  const geometry=mesh.geometry
  const name=`${mesh.name} ${mesh.material && !Array.isArray(mesh.material) ? mesh.material.name : ''}`.toLowerCase()
  if (/eye|iris|pupil|cornea|teeth|tooth|tongue|gum|claw|nail|whisker|generatedrealfur/.test(name)) return false
  return Boolean(
    mesh.isMesh &&
    geometry?.getAttribute('position') &&
    geometry?.getAttribute('normal') &&
    geometry.getAttribute('position').count>30
  )
}

function canUseSkinning(source:Mesh):source is SkinnedMesh {
  const geometry=source.geometry
  return Boolean(
    (source as SkinnedMesh).isSkinnedMesh &&
    geometry?.getAttribute('skinIndex') &&
    geometry?.getAttribute('skinWeight') &&
    (source as SkinnedMesh).skeleton
  )
}

function buildSurfaceSampler(source:Mesh) {
  const geometry=source.geometry
  const position=geometry.getAttribute('position') as BufferAttribute
  const normal=geometry.getAttribute('normal') as BufferAttribute
  const uv=geometry.getAttribute('uv') as BufferAttribute | undefined
  const skinIndex=geometry.getAttribute('skinIndex') as BufferAttribute | undefined
  const skinWeight=geometry.getAttribute('skinWeight') as BufferAttribute | undefined
  const skinned=canUseSkinning(source)
  const index=geometry.index
  const triangleCount=index ? Math.floor(index.count/3) : Math.floor(position.count/3)

  const cumulative=new Float64Array(triangleCount)
  let totalArea=0
  const a=new THREE.Vector3()
  const b=new THREE.Vector3()
  const c=new THREE.Vector3()
  const ab=new THREE.Vector3()
  const ac=new THREE.Vector3()
  const cross=new THREE.Vector3()

  const triangleVertex=(triangle:number,corner:number)=>{
    const raw=triangle*3+corner
    return index ? index.getX(raw) : raw
  }

  for (let triangle=0;triangle<triangleCount;triangle++) {
    const ia=triangleVertex(triangle,0)
    const ib=triangleVertex(triangle,1)
    const ic=triangleVertex(triangle,2)
    a.fromBufferAttribute(position,ia)
    b.fromBufferAttribute(position,ib)
    c.fromBufferAttribute(position,ic)
    ab.subVectors(b,a)
    ac.subVectors(c,a)
    const area=Math.max(1e-12,cross.crossVectors(ab,ac).length()*.5)
    totalArea+=area
    cumulative[triangle]=totalArea
  }

  const findTriangle=(target:number)=>{
    let lo=0
    let hi=cumulative.length-1
    while (lo<hi) {
      const mid=(lo+hi)>>1
      if (cumulative[mid]<target) lo=mid+1
      else hi=mid
    }
    return lo
  }

  const p0=new THREE.Vector3()
  const p1=new THREE.Vector3()
  const p2=new THREE.Vector3()
  const n0=new THREE.Vector3()
  const n1=new THREE.Vector3()
  const n2=new THREE.Vector3()

  return (rng:()=>number):SurfaceSample=>{
    const triangle=findTriangle(rng()*totalArea)
    const ia=triangleVertex(triangle,0)
    const ib=triangleVertex(triangle,1)
    const ic=triangleVertex(triangle,2)

    const sqrtR=Math.sqrt(rng())
    const b0=1-sqrtR
    const b1=sqrtR*(1-rng())
    const b2=1-b0-b1

    p0.fromBufferAttribute(position,ia)
    p1.fromBufferAttribute(position,ib)
    p2.fromBufferAttribute(position,ic)
    const sampledPosition=new THREE.Vector3()
      .addScaledVector(p0,b0)
      .addScaledVector(p1,b1)
      .addScaledVector(p2,b2)

    n0.fromBufferAttribute(normal,ia)
    n1.fromBufferAttribute(normal,ib)
    n2.fromBufferAttribute(normal,ic)
    const sampledNormal=new THREE.Vector3()
      .addScaledVector(n0,b0)
      .addScaledVector(n1,b1)
      .addScaledVector(n2,b2)
      .normalize()

    const sampledU=uv ? uv.getX(ia)*b0+uv.getX(ib)*b1+uv.getX(ic)*b2 : rng()
    const sampledV=uv ? uv.getY(ia)*b0+uv.getY(ib)*b1+uv.getY(ic)*b2 : rng()

    const sampledIndices:[number,number,number,number]=[0,0,0,0]
    const sampledWeights:[number,number,number,number]=[1,0,0,0]

    if (skinned && skinIndex && skinWeight) {
      const influences=new Map<number,number>()
      const addInfluences=(vertex:number,bary:number)=>{
        for (let slot=0;slot<4;slot++) {
          const bone=Math.round(component(skinIndex,vertex,slot))
          const weight=component(skinWeight,vertex,slot)*bary
          if (weight>1e-6) influences.set(bone,(influences.get(bone)||0)+weight)
        }
      }
      addInfluences(ia,b0)
      addInfluences(ib,b1)
      addInfluences(ic,b2)

      const top=[...influences.entries()].sort((x,y)=>y[1]-x[1]).slice(0,4)
      const sum=Math.max(1e-8,top.reduce((s,item)=>s+item[1],0))
      sampledWeights.fill(0)
      top.forEach(([bone,weight],slot)=>{
        sampledIndices[slot]=bone
        sampledWeights[slot]=weight/sum
      })
    }

    return {
      position:sampledPosition,
      normal:sampledNormal,
      u:sampledU,
      v:sampledV,
      skinIndices:sampledIndices,
      skinWeights:sampledWeights,
    }
  }
}

function createGuidePhysicsState(
  layer:FurLayer,
  animal:Individual,
  maxBend:number,
  seed:number,
):FurGuidePhysicsState {
  const furLength=clamp(animal.phenotype.furLength,0,1)
  const p=animal.phenotype
  const guideCount=layer.guideGridX*layer.guideGridY
  const data=new Uint8Array(guideCount*4)
  const positions=new Float32Array(guideCount*3)
  const velocities=new Float32Array(guideCount*3)
  const phases=new Float32Array(guideCount)
  const rng=makeRng(seed^layer.seedOffset^0x5bd1e995)

  for (let i=0;i<guideCount;i++) {
    phases[i]=rng()*Math.PI*2
    const p=i*4
    data[p]=128
    data[p+1]=128
    data[p+2]=128
    data[p+3]=255
  }

  const texture=new THREE.DataTexture(
    data,
    layer.guideGridX,
    layer.guideGridY,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  texture.magFilter=THREE.LinearFilter
  texture.minFilter=THREE.LinearFilter
  texture.wrapS=THREE.RepeatWrapping
  texture.wrapT=THREE.RepeatWrapping
  texture.generateMipmaps=false
  texture.flipY=false
  texture.colorSpace=THREE.NoColorSpace
  texture.needsUpdate=true

  const isGuard=layer.name==='guard'
  const stiffnessBoost=p.guardHairStiffness*.55+p.furWireStrength*.45+p.furCoarseness*.25
  const curlSpring=p.furCurlStrength*.22+p.furWaveStrength*.10
  const silkyDamping=p.furSilkiness*.28+p.furLayFlatness*.20
  return {
    texture,
    data,
    positions,
    velocities,
    phases,
    guideCount,
    guideGridX:layer.guideGridX,
    guideGridY:layer.guideGridY,
    stiffness:isGuard
      ? 14+stiffnessBoost*16+curlSpring*8-furLength*3
      : 28+p.furPlushness*10+p.undercoatDepth*8-furLength*4,
    damping:isGuard
      ? 5.2+stiffnessBoost*3.2+silkyDamping*2.2
      : 8.8+p.furPlushness*2.8+silkyDamping*1.8,
    gravity:isGuard
      ? .07+furLength*.11+(1-p.furLayFlatness)*.05
      : .035+furLength*.045,
    wind:isGuard
      ? (.11+furLength*.06)*(1-p.guardHairStiffness*.42+p.furCurlStrength*.20)
      : (.045+furLength*.022)*(1-p.furPlushness*.30),
    inertia:isGuard
      ? 9.5*layer.physicsStrength*(1+p.furCurlStrength*.26-p.guardHairStiffness*.24)
      : 5.5*layer.physicsStrength*(1-p.furPlushness*.18),
    maxBend,
  }
}

function projectedTangent(
  flow:THREE.Vector3,
  normal:THREE.Vector3,
  fallback:THREE.Vector3,
  out:THREE.Vector3,
) {
  out.copy(flow).addScaledVector(normal,-flow.dot(normal))
  if (out.lengthSq()<1e-8) out.copy(fallback).addScaledVector(normal,-fallback.dot(normal))
  if (out.lengthSq()<1e-8) out.set(1,0,0)
  return out.normalize()
}

function groomDirection(
  sample:SurfaceSample,
  box:THREE.Box3,
  boxSize:THREE.Vector3,
  normal:THREE.Vector3,
  longAxis:THREE.Vector3,
  layFlatness:number,
  furWire:number,
  layerName:FurLayer['name'],
  out:THREE.Vector3,
) {
  const center=box.getCenter(new THREE.Vector3())
  const rel=new THREE.Vector3().subVectors(sample.position,center)
  const halfLong=Math.max(.001,(Math.abs(longAxis.x)*boxSize.x+Math.abs(longAxis.z)*boxSize.z)*.5)
  const longitudinal=clamp(rel.dot(longAxis)/halfLong,-1,1)
  const yNorm=boxSize.y>1e-6 ? clamp((sample.position.y-box.min.y)/boxSize.y,0,1) : .5

  const flow=new THREE.Vector3()
  if (yNorm<.28) {
    // Legs and paws: hair runs toward the ground/paw.
    flow.set(0,-1,0)
  } else if (yNorm>.72 && Math.abs(longitudinal)>.34) {
    // Head/cheek/ear zone: sweep backward toward the torso and slightly down.
    flow.copy(longAxis).multiplyScalar(-Math.sign(longitudinal || 1))
    flow.y=-.30
  } else if (Math.abs(longitudinal)>.78) {
    // Longitudinal extremes (tail/head tips): follow the extremity rather than
    // exploding outward from the surface normal.
    flow.copy(longAxis).multiplyScalar(Math.sign(longitudinal || 1))
    flow.y=-.06
  } else {
    // Torso/shoulders/flanks: consistent coat grain along the body.
    flow.copy(longAxis).multiplyScalar(-1)
    flow.y=-.10
  }

  const tangent=projectedTangent(flow,normal,longAxis,new THREE.Vector3())
  // Phase 8.8.1 balance pass: keep the inherited lay direction, but never
  // collapse every strand into a nearly tangent ribbon. A small minimum
  // stand-off preserves readable individual hairs while the coat still
  // follows the body instead of reverting to the old porcupine look.
  const layerBase=layerName==='guard' ? .18 : .11
  const layerMax=layerName==='guard' ? .64 : .48
  const standOff=clamp(
    layerBase+(1-layFlatness)*.46+furWire*.14,
    layerBase,
    layerMax,
  )
  out.copy(tangent).multiplyScalar(1-standOff).addScaledVector(normal,standOff).normalize()
  return out
}

function buildFurGeometry(
  source:Mesh,
  layer:FurLayer,
  animal:Individual,
  seed:number,
) {
  const furLength=clamp(animal.phenotype.furLength,0,1)
  const phenotype=animal.phenotype
  const geometry=source.geometry
  geometry.computeBoundingBox()
  const box=geometry.boundingBox!
  const boxSize=box.getSize(new THREE.Vector3())
  const diagonal=Math.max(.001,boxSize.length())

  const speciesFactor=source.userData.furSpecies==='fox' ? 1.12 : 1
  const textureLift=
    1+
    phenotype.furPlushness*.12+
    phenotype.furCurlStrength*.10+
    phenotype.furWireStrength*.08-
    phenotype.furLayFlatness*.08
  const baseLength=diagonal*(.0030+furLength*.0093)*speciesFactor*layer.lengthScale*textureLift
  const maxBend=baseLength*(layer.name==='guard'?.80:.48)
  const segments=layer.name==='guard' ? 2 : 1
  const vertexPerSegment=6
  const totalVertices=layer.count*vertexPerSegment*segments

  const positions=new Float32Array(totalVertices*3)
  const normals=new Float32Array(totalVertices*3)
  const uvs=new Float32Array(totalVertices*2)
  const guideUvs=new Float32Array(totalVertices*2)
  const skinIndices=new Uint16Array(totalVertices*4)
  const skinWeights=new Float32Array(totalVertices*4)
  const furFlex=new Float32Array(totalVertices)

  const rng=makeRng(seed^hashName(source.name)^layer.seedOffset)
  const sampleSurface=buildSurfaceSampler(source)
  const longAxis=boxSize.z>=boxSize.x ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0)
  const tangent=new THREE.Vector3()
  const bitangent=new THREE.Vector3()
  const axis=new THREE.Vector3()
  const tip=new THREE.Vector3()
  const mid=new THREE.Vector3()
  const root=new THREE.Vector3()
  const hairDirection=new THREE.Vector3()
  const flowTangent=new THREE.Vector3()
  const curveOffset=new THREE.Vector3()
  const corners=[
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]
  const triNormal=new THREE.Vector3()
  const edgeA=new THREE.Vector3()
  const edgeB=new THREE.Vector3()

  let outVertex=0
  const writeVertex=(
    vertex:THREE.Vector3,
    nrm:THREE.Vector3,
    sample:SurfaceSample,
    flex:number,
    guideU:number,
    guideV:number,
  )=>{
    const p3=outVertex*3
    positions[p3]=vertex.x
    positions[p3+1]=vertex.y
    positions[p3+2]=vertex.z
    normals[p3]=nrm.x
    normals[p3+1]=nrm.y
    normals[p3+2]=nrm.z

    const p2=outVertex*2
    uvs[p2]=sample.u
    uvs[p2+1]=sample.v
    guideUvs[p2]=guideU
    guideUvs[p2+1]=guideV

    const p4=outVertex*4
    for (let slot=0;slot<4;slot++) {
      skinIndices[p4+slot]=sample.skinIndices[slot]
      skinWeights[p4+slot]=sample.skinWeights[slot]
    }
    furFlex[outVertex]=flex
    outVertex++
  }

  const emitTriangle=(
    a:THREE.Vector3,
    b:THREE.Vector3,
    c:THREE.Vector3,
    sample:SurfaceSample,
    guideU:number,
    guideV:number,
    baseFlex:number,
    tipFlex:number,
  )=>{
    edgeA.subVectors(b,a)
    edgeB.subVectors(c,a)
    triNormal.crossVectors(edgeA,edgeB).normalize()
    if (!Number.isFinite(triNormal.x)) triNormal.copy(sample.normal)
    writeVertex(a,triNormal,sample,baseFlex,guideU,guideV)
    writeVertex(b,triNormal,sample,baseFlex,guideU,guideV)
    writeVertex(c,triNormal,sample,tipFlex,guideU,guideV)
  }

  for (let hair=0;hair<layer.count;hair++) {
    const sample=sampleSurface(rng)
    const n=sample.normal
    const guideU=fract(sample.u)
    const guideV=fract(sample.v)

    axis.set(Math.abs(n.y)<.82?0:1,Math.abs(n.y)<.82?1:0,0)
    tangent.crossVectors(n,axis).normalize()
    if (tangent.lengthSq()<1e-6) tangent.set(1,0,0)
    bitangent.crossVectors(n,tangent).normalize()

    const yNorm=boxSize.y>1e-6 ? clamp((sample.position.y-box.min.y)/boxSize.y,0,1) : .5
    const center=box.getCenter(new THREE.Vector3())
    const rel=new THREE.Vector3().subVectors(sample.position,center)
    const halfLong=Math.max(.001,(Math.abs(longAxis.x)*boxSize.x+Math.abs(longAxis.z)*boxSize.z)*.5)
    const longNorm=clamp(rel.dot(longAxis)/halfLong,-1,1)

    let regionLengthScale=1
    if (yNorm<.25) regionLengthScale*=.52
    if (yNorm>.76 && Math.abs(longNorm)>.34) regionLengthScale*=.48
    if (Math.abs(longNorm)>.88) regionLengthScale*=.72
    if (yNorm<.16) regionLengthScale*=.70

    projectedTangent(longAxis,n,tangent,flowTangent)
    bitangent.crossVectors(n,flowTangent).normalize()
    if (bitangent.lengthSq()<1e-8) bitangent.set(0,0,1)

    groomDirection(
      sample,
      box,
      boxSize,
      n,
      longAxis,
      phenotype.furLayFlatness,
      phenotype.furWireStrength,
      layer.name,
      hairDirection,
    )

    // Avoid the "combed grooves" regression where thousands of neighboring
    // hairs shared almost exactly the same direction. The jitter is small
    // enough to retain grooming, but large enough to read as separate fibers.
    const directionJitter=(rng()-.5)*(layer.name==='guard'?.22:.10)
    const lateralJitter=(rng()-.5)*(layer.name==='guard'?.16:.07)
    hairDirection
      .addScaledVector(flowTangent,directionJitter)
      .addScaledVector(bitangent,lateralJitter)
      .normalize()

    const length=baseLength*(.78+rng()*.38)*regionLengthScale
    const thicknessGene=clamp(
      phenotype.guardHairThickness*.56+
      phenotype.furCoarseness*.26+
      phenotype.furWireStrength*.18,
      0,1,
    )
    // The Phase 8.8 strands became sub-pixel thin on phones, so the coat
    // visually collapsed back into a ribbed surface. Keep the geometry thin,
    // but apply a modest screen-readability boost while still letting the
    // thickness genes control the result.
    const mobileWidthBoost=
      typeof navigator!=='undefined' && /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
        ? 1.22
        : 1
    const width=
      length*
      (.015+rng()*.009)*
      layer.widthScale*
      (.72+thicknessGene*.72)*
      mobileWidthBoost
    const lift=length*.0045
    const phase=rng()*Math.PI*2
    const waveAmp=length*(.02+.12*phenotype.furWaveStrength)*(layer.name==='guard'?1:.35)
    const curlAmp=length*(.02+.16*phenotype.furCurlStrength)*(layer.name==='guard'?1:.25)
    const wireKink=length*(rng()-.5)*.12*phenotype.furWireStrength

    root.copy(sample.position).addScaledVector(n,lift)
    mid.copy(root)
      .addScaledVector(hairDirection,length*.52)
      .addScaledVector(flowTangent,Math.sin(phase)*waveAmp)
      .addScaledVector(bitangent,Math.cos(phase)*curlAmp)
    tip.copy(root)
      .addScaledVector(hairDirection,length)
      .addScaledVector(flowTangent,Math.sin(phase+Math.PI*.85)*waveAmp)
      .addScaledVector(bitangent,Math.cos(phase+Math.PI*.85)*curlAmp)
      .addScaledVector(flowTangent,wireKink)

    const emitCrossSegment=(from:THREE.Vector3,to:THREE.Vector3,baseFlex:number,tipFlex:number)=>{
      const direction=new THREE.Vector3().subVectors(to,from).normalize()
      const crossA=new THREE.Vector3().crossVectors(direction,n).normalize()
      if (crossA.lengthSq()<1e-8) crossA.copy(flowTangent)
      const crossB=new THREE.Vector3().crossVectors(direction,crossA).normalize()
      corners[0].copy(from).addScaledVector(crossA,width)
      corners[1].copy(from).addScaledVector(crossA,-width)
      corners[2].copy(from).addScaledVector(crossB,width)
      corners[3].copy(from).addScaledVector(crossB,-width)
      emitTriangle(corners[0],corners[1],to,sample,guideU,guideV,baseFlex,tipFlex)
      emitTriangle(corners[2],corners[3],to,sample,guideU,guideV,baseFlex,tipFlex)
    }

    if (segments===2) {
      emitCrossSegment(root,mid,0,.52)
      emitCrossSegment(mid,tip,.52,1)
    } else {
      emitCrossSegment(root,tip,0,1)
    }
  }

  const furGeometry=new THREE.BufferGeometry()
  furGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  furGeometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
  furGeometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2))
  furGeometry.setAttribute('guideUV',new THREE.BufferAttribute(guideUvs,2))
  if (canUseSkinning(source)) {
    furGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4))
    furGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4))
  }
  furGeometry.setAttribute('furFlex',new THREE.Float32BufferAttribute(furFlex,1))
  furGeometry.computeBoundingSphere()

  return {geometry:furGeometry,maxBend}
}

function createFurMaterial(
  coatTexture:Texture|null,
  coatColor:string,
  layer:FurLayer,
  physics:FurGuidePhysicsState,
  animal:Individual,
) {
  const p=animal.phenotype
  const material=new THREE.MeshPhysicalMaterial({
    color:coatTexture?'#ffffff':coatColor,
    map:coatTexture || null,
    roughness:clamp(.92-p.coatGloss*.48+p.furCoarseness*.14, .34,.94),
    metalness:0,
    side:THREE.DoubleSide,
    sheen:clamp(.22+p.furSilkiness*.58+p.coatGloss*.20,.18,.92),
    sheenRoughness:clamp(.86-p.coatGloss*.42+p.furCoarseness*.10,.36,.92),
    sheenColor:new THREE.Color(coatColor).lerp(new THREE.Color('#ffffff'),.10+p.furSilkiness*.18),
    emissive:layer.name==='guard'
      ? new THREE.Color(coatColor).multiplyScalar(.025)
      : new THREE.Color('#000000'),
    emissiveIntensity:layer.name==='guard'?1:0,
  })

  material.userData.furGuidePhysics=physics
  material.onBeforeCompile=(shader:any)=>{
    shader.uniforms.furGuideTexture={value:physics.texture}
    shader.uniforms.furMaxBend={value:physics.maxBend}

    shader.vertexShader=shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
attribute float furFlex;
attribute vec2 guideUV;
uniform sampler2D furGuideTexture;
uniform float furMaxBend;`,
    )

    shader.vertexShader=shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec3 guideBend = texture2D(furGuideTexture, guideUV).rgb * 2.0 - 1.0;
transformed += guideBend * furMaxBend * furFlex;`,
    )
  }
  material.customProgramCacheKey=()=>`physical-guide-fur-${layer.name}`
  return material
}

export function attachRealFur(root:Group,{animal,coatTexture,coatColor}:FurOptions) {
  const candidates:Mesh[]=[]
  let inspectedMeshes=0
  let skinnedCandidates=0
  root.traverse(object=>{
    const mesh=object as Mesh
    if (!mesh.isMesh || mesh.userData.generatedFur) return
    inspectedMeshes++
    if (isEligibleBodyMesh(mesh)) {
      candidates.push(mesh)
      if (canUseSkinning(mesh)) skinnedCandidates++
    }
  })
  root.userData.furInspectedMeshCount=inspectedMeshes
  root.userData.furCandidateMeshCount=candidates.length
  root.userData.furSkinnedCandidateCount=skinnedCandidates
  if (!candidates.length) {
    root.userData.generatedFurCount=0
    root.userData.generatedGuideCount=0
    return 0
  }

  const furLength=Math.max(0,Math.min(1,animal.phenotype.furLength))
  const biologicalDensity=Math.max(60000,Math.min(120000,animal.phenotype.furDensityPerSqIn || 90000))
  const densityNorm=(biologicalDensity-60000)/60000
  const mobile=typeof navigator!=='undefined' && /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
  const lodScale=mobile?.72:1

  const targetTotal=Math.round((
    animal.species==='fox'
      ? 50000+densityNorm*30000+furLength*14000
      : 43000+densityNorm*27000+furLength*13000
  )*lodScale)

  const guardFraction=clamp(
    .12+
    .07*(1-animal.phenotype.undercoatDepth)+
    .05*animal.phenotype.furWireStrength+
    .02*animal.phenotype.furCoarseness,
    .10,
    .24,
  )
  const totalGuard=Math.max(2800,Math.round(targetTotal*guardFraction))
  const totalUndercoat=Math.max(6000,targetTotal-totalGuard)

  const totalSourceVertices=candidates.reduce(
    (sum,mesh)=>sum+mesh.geometry.getAttribute('position').count,
    0,
  )

  let created=0
  let createdUndercoat=0
  let createdGuard=0
  let createdGuides=0
  const guideStates:FurGuidePhysicsState[]=[]

  for (let meshIndex=0;meshIndex<candidates.length;meshIndex++) {
    const source=candidates[meshIndex]
    const sourceVertices=source.geometry.getAttribute('position').count
    const share=sourceVertices/Math.max(1,totalSourceVertices)
    source.userData.furSpecies=animal.species

    const layers:FurLayer[]=[
      {
        name:'undercoat',
        count:Math.max(400,Math.round(totalUndercoat*share)),
        lengthScale:.46+.16*animal.phenotype.undercoatDepth,
        widthScale:.22+.10*animal.phenotype.furPlushness,
        leanScale:.04+.08*animal.phenotype.furWaveStrength,
        physicsStrength:.50+.24*(1-animal.phenotype.furPlushness),
        guideGridX:mobile?14:18,
        guideGridY:mobile?10:14,
        seedOffset:0x71a3,
      },
      {
        name:'guard',
        count:Math.max(220,Math.round(totalGuard*share)),
        lengthScale:1.12+.40*animal.phenotype.furCoarseness+.24*animal.phenotype.furCurlStrength,
        widthScale:.22+.18*animal.phenotype.guardHairThickness,
        leanScale:.08+.18*animal.phenotype.furWireStrength+.10*animal.phenotype.furWaveStrength,
        physicsStrength:.82+.30*(1-animal.phenotype.guardHairStiffness)+.18*animal.phenotype.furCurlStrength,
        guideGridX:mobile?18:24,
        guideGridY:mobile?14:18,
        seedOffset:0x2bf1,
      },
    ]

    for (const layer of layers) {
      const built=buildFurGeometry(
        source,
        layer,
        animal,
        animal.seed+meshIndex*7919,
      )
      const physics=createGuidePhysicsState(
        layer,
        animal,
        built.maxBend,
        animal.seed+meshIndex*7919,
      )
      guideStates.push(physics)
      createdGuides+=physics.guideCount

      const material=createFurMaterial(coatTexture,coatColor,layer,physics,animal)
      let fur:Mesh

      if (canUseSkinning(source)) {
        const skinnedFur=new THREE.SkinnedMesh(built.geometry,material)
        skinnedFur.bindMode=source.bindMode
        skinnedFur.position.copy(source.position)
        skinnedFur.quaternion.copy(source.quaternion)
        skinnedFur.scale.copy(source.scale)
        skinnedFur.bind(source.skeleton,source.bindMatrix.clone())
        source.parent?.add(skinnedFur)
        fur=skinnedFur
      } else {
        // Fallback for imported meshes that render/animate correctly but do
        // not expose Three.js skin attributes. Parenting to the source keeps
        // the complete fur coat attached to the visible body transform.
        const rigidFur=new THREE.Mesh(built.geometry,material)
        rigidFur.position.set(0,0,0)
        rigidFur.quaternion.identity()
        rigidFur.scale.set(1,1,1)
        source.add(rigidFur)
        fur=rigidFur
      }

      fur.name=`GeneratedRealFur_${layer.name}_${source.name || meshIndex}`
      fur.userData.generatedFur=true
      fur.userData.furLayer=layer.name
      fur.userData.furAttachment=canUseSkinning(source)?'skinned':'rigid-parent'
      fur.castShadow=layer.name==='guard'
      fur.receiveShadow=true
      fur.frustumCulled=false
      created+=layer.count
      if (layer.name==='guard') createdGuard+=layer.count
      else createdUndercoat+=layer.count
    }
  }

  root.userData.generatedFurCount=created
  root.userData.generatedGuideCount=createdGuides
  root.userData.furGuideStates=guideStates
  root.userData.generatedUndercoatCount=createdUndercoat
  root.userData.generatedGuardHairCount=createdGuard
  root.userData.biologicalFurDensityPerSqIn=biologicalDensity
  return created
}

function encodeGuideComponent(value:number) {
  return Math.round((clamp(value,-1,1)*.5+.5)*255)
}

export function updateRealFurPhysics(
  root:THREE.Object3D,
  time:number,
  force:THREE.Vector3,
  delta=.016,
) {
  const states=(root.userData.furGuideStates || []) as FurGuidePhysicsState[]
  const dt=Math.min(.033,Math.max(.001,delta))

  for (const state of states) {
    const p=state.positions
    const v=state.velocities
    const data=state.data

    for (let i=0;i<state.guideCount;i++) {
      const i3=i*3
      const i4=i*4
      const phase=state.phases[i]
      const windX=Math.sin(time*(.72+(i%7)*.018)+phase)*state.wind
      const windZ=Math.cos(time*(.58+(i%11)*.013)+phase*1.17)*state.wind
      const gust=Math.sin(time*.21+phase*.37)*.035

      const targetX=clamp(force.x*state.inertia+windX+gust,-.92,.92)
      const targetY=clamp(-state.gravity+force.y*state.inertia*.45,-.72,.28)
      const targetZ=clamp(force.z*state.inertia+windZ-gust*.5,-.92,.92)

      const px=p[i3]
      const py=p[i3+1]
      const pz=p[i3+2]
      let vx=v[i3]
      let vy=v[i3+1]
      let vz=v[i3+2]

      vx+=((targetX-px)*state.stiffness-vx*state.damping)*dt
      vy+=((targetY-py)*state.stiffness-vy*state.damping)*dt
      vz+=((targetZ-pz)*state.stiffness-vz*state.damping)*dt

      const nx=clamp(px+vx*dt,-1,1)
      const ny=clamp(py+vy*dt,-1,1)
      const nz=clamp(pz+vz*dt,-1,1)

      if (Math.abs(nx)>=.999) vx*=.35
      if (Math.abs(ny)>=.999) vy*=.35
      if (Math.abs(nz)>=.999) vz*=.35

      p[i3]=nx
      p[i3+1]=ny
      p[i3+2]=nz
      v[i3]=vx
      v[i3+1]=vy
      v[i3+2]=vz

      data[i4]=encodeGuideComponent(nx)
      data[i4+1]=encodeGuideComponent(ny)
      data[i4+2]=encodeGuideComponent(nz)
      data[i4+3]=255
    }

    state.texture.needsUpdate=true
  }
}
