import * as THREE from 'three'
import type { Group, SkinnedMesh, Texture } from 'three'
import type { Individual } from '../types'

interface FurOptions {
  animal:Individual
  coatTexture:Texture|null
  coatColor:string
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

function isEligibleBodyMesh(mesh:SkinnedMesh) {
  const geometry=mesh.geometry
  const name=`${mesh.name} ${mesh.material && !Array.isArray(mesh.material) ? mesh.material.name : ''}`.toLowerCase()
  if (/eye|iris|pupil|cornea|teeth|tooth|tongue|gum|claw|nail|whisker/.test(name)) return false
  return Boolean(
    geometry?.getAttribute('position') &&
    geometry?.getAttribute('normal') &&
    geometry?.getAttribute('skinIndex') &&
    geometry?.getAttribute('skinWeight') &&
    geometry.getAttribute('position').count>120
  )
}

function buildFurGeometry(
  source:SkinnedMesh,
  hairCount:number,
  furLength:number,
  seed:number,
) {
  const geometry=source.geometry
  const position=geometry.getAttribute('position')
  const normal=geometry.getAttribute('normal')
  const uv=geometry.getAttribute('uv')
  const skinIndex=geometry.getAttribute('skinIndex')
  const skinWeight=geometry.getAttribute('skinWeight')

  geometry.computeBoundingBox()
  const box=geometry.boundingBox!
  const diagonal=Math.max(.001,box.getSize(new THREE.Vector3()).length())

  const speciesFactor=source.userData.furSpecies==='fox' ? 1.16 : 1
  // The previous fibers were physically present but too small to survive
  // phone-scale rasterization. Make each strand long/thick enough to break
  // the silhouette while still reading as fur rather than quills.
  const baseLength=diagonal*(.010+furLength*.022)*speciesFactor
  const vertexPerHair=12
  const totalVertices=hairCount*vertexPerHair

  const positions=new Float32Array(totalVertices*3)
  const normals=new Float32Array(totalVertices*3)
  const uvs=new Float32Array(totalVertices*2)
  const skinIndices=new Uint16Array(totalVertices*4)
  const skinWeights=new Float32Array(totalVertices*4)

  const rng=makeRng(seed^hashName(source.name))
  const p=new THREE.Vector3()
  const n=new THREE.Vector3()
  const tangent=new THREE.Vector3()
  const bitangent=new THREE.Vector3()
  const axis=new THREE.Vector3()
  const tip=new THREE.Vector3()
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
  const writeVertex=(v:THREE.Vector3,nrm:THREE.Vector3,u:number,vv:number,sourceIndex:number)=>{
    const p3=outVertex*3
    positions[p3]=v.x
    positions[p3+1]=v.y
    positions[p3+2]=v.z
    normals[p3]=nrm.x
    normals[p3+1]=nrm.y
    normals[p3+2]=nrm.z

    const p2=outVertex*2
    uvs[p2]=u
    uvs[p2+1]=vv

    const p4=outVertex*4
    skinIndices[p4]=skinIndex.getX(sourceIndex)
    skinIndices[p4+1]=skinIndex.getY(sourceIndex)
    skinIndices[p4+2]=skinIndex.getZ(sourceIndex)
    skinIndices[p4+3]=skinIndex.getW(sourceIndex)
    skinWeights[p4]=skinWeight.getX(sourceIndex)
    skinWeights[p4+1]=skinWeight.getY(sourceIndex)
    skinWeights[p4+2]=skinWeight.getZ(sourceIndex)
    skinWeights[p4+3]=skinWeight.getW(sourceIndex)
    outVertex++
  }

  const emitTriangle=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,u:number,v:number,index:number)=>{
    edgeA.subVectors(b,a)
    edgeB.subVectors(c,a)
    triNormal.crossVectors(edgeA,edgeB).normalize()
    if (!Number.isFinite(triNormal.x)) triNormal.copy(n)
    writeVertex(a,triNormal,u,v,index)
    writeVertex(b,triNormal,u,v,index)
    writeVertex(c,triNormal,u,v,index)
  }

  for (let hair=0;hair<hairCount;hair++) {
    const index=Math.floor(rng()*position.count)
    p.fromBufferAttribute(position,index)
    n.fromBufferAttribute(normal,index).normalize()

    axis.set(Math.abs(n.y)<.82?0:1,Math.abs(n.y)<.82?1:0,0)
    tangent.crossVectors(n,axis).normalize()
    if (tangent.lengthSq()<1e-6) tangent.set(1,0,0)
    bitangent.crossVectors(n,tangent).normalize()

    const length=baseLength*(.58+rng()*.72)
    const width=length*(.075+rng()*.035)
    const lift=length*.060
    const lean=(rng()-.5)*length*.18
    const lean2=(rng()-.5)*length*.18
    const root=p.clone().addScaledVector(n,lift)

    corners[0].copy(root).addScaledVector(tangent,width).addScaledVector(bitangent,width)
    corners[1].copy(root).addScaledVector(tangent,-width).addScaledVector(bitangent,width)
    corners[2].copy(root).addScaledVector(tangent,-width).addScaledVector(bitangent,-width)
    corners[3].copy(root).addScaledVector(tangent,width).addScaledVector(bitangent,-width)

    tip.copy(root)
      .addScaledVector(n,length)
      .addScaledVector(tangent,lean)
      .addScaledVector(bitangent,lean2)

    const uu=uv?uv.getX(index):.5
    const vv=uv?uv.getY(index):.5

    emitTriangle(corners[0],corners[1],tip,uu,vv,index)
    emitTriangle(corners[1],corners[2],tip,uu,vv,index)
    emitTriangle(corners[2],corners[3],tip,uu,vv,index)
    emitTriangle(corners[3],corners[0],tip,uu,vv,index)
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

export function attachRealFur(root:Group,{animal,coatTexture,coatColor}:FurOptions) {
  const candidates:SkinnedMesh[]=[]
  root.traverse(object=>{
    const mesh=object as SkinnedMesh
    if (!mesh.isSkinnedMesh || mesh.userData.generatedFur) return
    if (isEligibleBodyMesh(mesh)) candidates.push(mesh)
  })
  if (!candidates.length) return 0

  const furLength=Math.max(0,Math.min(1,animal.phenotype.furLength))
  const targetTotal=animal.species==='fox'
    ? Math.round(9000+furLength*7000)
    : Math.round(7500+furLength*6000)

  const totalSourceVertices=candidates.reduce(
    (sum,mesh)=>sum+mesh.geometry.getAttribute('position').count,
    0,
  )

  let created=0
  for (let meshIndex=0;meshIndex<candidates.length;meshIndex++) {
    const source=candidates[meshIndex]
    const sourceVertices=source.geometry.getAttribute('position').count
    const proportional=Math.round(targetTotal*(sourceVertices/Math.max(1,totalSourceVertices)))
    const hairCount=Math.max(220,proportional)
    if (created>=targetTotal && meshIndex>0) break

    source.userData.furSpecies=animal.species
    const usedHairCount=Math.min(hairCount,Math.max(220,targetTotal-created))
    const furGeometry=buildFurGeometry(
      source,
      usedHairCount,
      furLength,
      animal.seed+meshIndex*7919,
    )

    const material=new THREE.MeshStandardMaterial({
      color:coatTexture?'#ffffff':coatColor,
      map:coatTexture || null,
      roughness:.96,
      metalness:0,
      side:THREE.DoubleSide,
    })

    const fur=new THREE.SkinnedMesh(furGeometry,material)
    fur.name=`GeneratedRealFur_${source.name || meshIndex}`
    fur.userData.generatedFur=true
    fur.castShadow=true
    fur.receiveShadow=true
    fur.frustumCulled=false
    fur.bindMode=source.bindMode
    fur.position.copy(source.position)
    fur.quaternion.copy(source.quaternion)
    fur.scale.copy(source.scale)
    fur.bind(source.skeleton,source.bindMatrix.clone())

    source.parent?.add(fur)
    created+=usedHairCount
  }

  root.userData.generatedFurCount=created
  return created
}
