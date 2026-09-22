import * as THREE from 'three'
import type { BufferAttribute, Group, SkinnedMesh, Texture } from 'three'
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
  seedOffset:number
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

function isEligibleBodyMesh(mesh:SkinnedMesh) {
  const geometry=mesh.geometry
  const name=`${mesh.name} ${mesh.material && !Array.isArray(mesh.material) ? mesh.material.name : ''}`.toLowerCase()
  if (/eye|iris|pupil|cornea|teeth|tooth|tongue|gum|claw|nail|whisker/.test(name)) return false
  return Boolean(
    geometry?.getAttribute('position') &&
    geometry?.getAttribute('normal') &&
    geometry?.getAttribute('skinIndex') &&
    geometry?.getAttribute('skinWeight') &&
    geometry.getAttribute('position').count>30
  )
}

function buildSurfaceSampler(source:SkinnedMesh) {
  const geometry=source.geometry
  const position=geometry.getAttribute('position') as BufferAttribute
  const normal=geometry.getAttribute('normal') as BufferAttribute
  const uv=geometry.getAttribute('uv') as BufferAttribute | undefined
  const skinIndex=geometry.getAttribute('skinIndex') as BufferAttribute
  const skinWeight=geometry.getAttribute('skinWeight') as BufferAttribute
  const index=geometry.index
  const triangleCount=index ? Math.floor(index.count/3) : Math.floor(position.count/3)

  const cumulative=new Float64Array(triangleCount)
  let totalArea=0
  const a=new THREE.Vector3()
  const b=new THREE.Vector3()
  const c=new THREE.Vector3()
  const ab=new THREE.Vector3()
  const ac=new THREE.Vector3()

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
    const area=Math.max(1e-12,new THREE.Vector3().crossVectors(ab,ac).length()*.5)
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

    const sampledU=uv ? uv.getX(ia)*b0+uv.getX(ib)*b1+uv.getX(ic)*b2 : .5
    const sampledV=uv ? uv.getY(ia)*b0+uv.getY(ib)*b1+uv.getY(ic)*b2 : .5

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
    const sampledIndices:[number,number,number,number]=[0,0,0,0]
    const sampledWeights:[number,number,number,number]=[0,0,0,0]
    top.forEach(([bone,weight],slot)=>{
      sampledIndices[slot]=bone
      sampledWeights[slot]=weight/sum
    })

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

function buildFurGeometry(
  source:SkinnedMesh,
  layer:FurLayer,
  furLength:number,
  seed:number,
) {
  const geometry=source.geometry
  geometry.computeBoundingBox()
  const box=geometry.boundingBox!
  const diagonal=Math.max(.001,box.getSize(new THREE.Vector3()).length())

  const speciesFactor=source.userData.furSpecies==='fox' ? 1.14 : 1
  const baseLength=diagonal*(.0045+furLength*.0155)*speciesFactor*layer.lengthScale
  const vertexPerHair=6
  const totalVertices=layer.count*vertexPerHair

  const positions=new Float32Array(totalVertices*3)
  const normals=new Float32Array(totalVertices*3)
  const uvs=new Float32Array(totalVertices*2)
  const skinIndices=new Uint16Array(totalVertices*4)
  const skinWeights=new Float32Array(totalVertices*4)

  const rng=makeRng(seed^hashName(source.name)^layer.seedOffset)
  const sampleSurface=buildSurfaceSampler(source)
  const tangent=new THREE.Vector3()
  const bitangent=new THREE.Vector3()
  const axis=new THREE.Vector3()
  const tip=new THREE.Vector3()
  const root=new THREE.Vector3()
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
    u:number,
    v:number,
    sample:SurfaceSample,
  )=>{
    const p3=outVertex*3
    positions[p3]=vertex.x
    positions[p3+1]=vertex.y
    positions[p3+2]=vertex.z
    normals[p3]=nrm.x
    normals[p3+1]=nrm.y
    normals[p3+2]=nrm.z

    const p2=outVertex*2
    uvs[p2]=u
    uvs[p2+1]=v

    const p4=outVertex*4
    for (let slot=0;slot<4;slot++) {
      skinIndices[p4+slot]=sample.skinIndices[slot]
      skinWeights[p4+slot]=sample.skinWeights[slot]
    }
    outVertex++
  }

  const emitTriangle=(
    a:THREE.Vector3,
    b:THREE.Vector3,
    c:THREE.Vector3,
    sample:SurfaceSample,
  )=>{
    edgeA.subVectors(b,a)
    edgeB.subVectors(c,a)
    triNormal.crossVectors(edgeA,edgeB).normalize()
    if (!Number.isFinite(triNormal.x)) triNormal.copy(sample.normal)
    writeVertex(a,triNormal,sample.u,sample.v,sample)
    writeVertex(b,triNormal,sample.u,sample.v,sample)
    writeVertex(c,triNormal,sample.u,sample.v,sample)
  }

  for (let hair=0;hair<layer.count;hair++) {
    const sample=sampleSurface(rng)
    const n=sample.normal

    axis.set(Math.abs(n.y)<.82?0:1,Math.abs(n.y)<.82?1:0,0)
    tangent.crossVectors(n,axis).normalize()
    if (tangent.lengthSq()<1e-6) tangent.set(1,0,0)
    bitangent.crossVectors(n,tangent).normalize()

    const length=baseLength*(.67+rng()*.62)
    const width=length*(.028+rng()*.018)*layer.widthScale
    const lift=length*.012
    const lean=(rng()-.5)*length*layer.leanScale
    const lean2=(rng()-.5)*length*layer.leanScale

    root.copy(sample.position).addScaledVector(n,lift)
    corners[0].copy(root).addScaledVector(tangent,width)
    corners[1].copy(root).addScaledVector(tangent,-width)
    corners[2].copy(root).addScaledVector(bitangent,width)
    corners[3].copy(root).addScaledVector(bitangent,-width)

    tip.copy(root)
      .addScaledVector(n,length)
      .addScaledVector(tangent,lean)
      .addScaledVector(bitangent,lean2)

    emitTriangle(corners[0],corners[1],tip,sample)
    emitTriangle(corners[2],corners[3],tip,sample)
  }

  const furGeometry=new THREE.BufferGeometry()
  furGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  furGeometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
  furGeometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2))
  furGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4))
  furGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4))
  furGeometry.computeBoundingSphere()
  return furGeometry
}

function createFurMaterial(
  coatTexture:Texture|null,
  coatColor:string,
  layer:FurLayer,
) {
  return new THREE.MeshPhysicalMaterial({
    color:coatTexture?'#ffffff':coatColor,
    map:coatTexture || null,
    roughness:layer.name==='guard'?.68:.86,
    metalness:0,
    side:THREE.DoubleSide,
    sheen:layer.name==='guard'?.48:.28,
    sheenRoughness:.78,
    sheenColor:new THREE.Color(coatColor),
  })
}

export function attachRealFur(root:Group,{animal,coatTexture,coatColor}:FurOptions) {
  const candidates:SkinnedMesh[]=[]
  root.traverse(object=>{
    const mesh=object as SkinnedMesh
    if (!mesh.isSkinnedMesh || mesh.userData.generatedFur) return
    if (isEligibleBodyMesh(mesh)) candidates.push(mesh)
  })
  if (!candidates.length) {
    root.userData.generatedFurCount=0
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

  const guardFraction=.22+.06*furLength
  const totalGuard=Math.max(3500,Math.round(targetTotal*guardFraction))
  const totalUndercoat=Math.max(6000,targetTotal-totalGuard)

  const totalSourceVertices=candidates.reduce(
    (sum,mesh)=>sum+mesh.geometry.getAttribute('position').count,
    0,
  )

  let created=0
  let createdUndercoat=0
  let createdGuard=0

  for (let meshIndex=0;meshIndex<candidates.length;meshIndex++) {
    const source=candidates[meshIndex]
    const sourceVertices=source.geometry.getAttribute('position').count
    const share=sourceVertices/Math.max(1,totalSourceVertices)
    source.userData.furSpecies=animal.species

    const layers:FurLayer[]=[
      {
        name:'undercoat',
        count:Math.max(400,Math.round(totalUndercoat*share)),
        lengthScale:.82,
        widthScale:.92,
        leanScale:.12,
        seedOffset:0x71a3,
      },
      {
        name:'guard',
        count:Math.max(220,Math.round(totalGuard*share)),
        lengthScale:1.75,
        widthScale:1.8,
        leanScale:.22,
        seedOffset:0x2bf1,
      },
    ]

    for (const layer of layers) {
      const furGeometry=buildFurGeometry(
        source,
        layer,
        furLength,
        animal.seed+meshIndex*7919,
      )
      const material=createFurMaterial(coatTexture,coatColor,layer)
      const fur=new THREE.SkinnedMesh(furGeometry,material)
      fur.name=`GeneratedRealFur_${layer.name}_${source.name || meshIndex}`
      fur.userData.generatedFur=true
      fur.userData.furLayer=layer.name
      fur.castShadow=layer.name==='guard'
      fur.receiveShadow=true
      fur.frustumCulled=false
      fur.bindMode=source.bindMode
      fur.position.copy(source.position)
      fur.quaternion.copy(source.quaternion)
      fur.scale.copy(source.scale)
      fur.bind(source.skeleton,source.bindMatrix.clone())

      source.parent?.add(fur)
      created+=layer.count
      if (layer.name==='guard') createdGuard+=layer.count
      else createdUndercoat+=layer.count
    }
  }

  root.userData.generatedFurCount=created
  root.userData.generatedUndercoatCount=createdUndercoat
  root.userData.generatedGuardHairCount=createdGuard
  root.userData.biologicalFurDensityPerSqIn=biologicalDensity
  return created
}
