import * as THREE from 'three'
import type { BufferGeometry, Material, Mesh, MeshStandardMaterial } from 'three'

function smoothNormalsByPosition(geometry:BufferGeometry) {
  const position=geometry.getAttribute('position')
  const normal=geometry.getAttribute('normal')
  if (!position || !normal || position.count!==normal.count) return

  const sums=new Map<string,THREE.Vector3>()
  const counts=new Map<string,number>()
  const precision=10000

  for (let i=0;i<position.count;i++) {
    const key=`${Math.round(position.getX(i)*precision)},${Math.round(position.getY(i)*precision)},${Math.round(position.getZ(i)*precision)}`
    const sum=sums.get(key) || new THREE.Vector3()
    sum.x+=normal.getX(i)
    sum.y+=normal.getY(i)
    sum.z+=normal.getZ(i)
    sums.set(key,sum)
    counts.set(key,(counts.get(key)||0)+1)
  }

  const out=new Float32Array(position.count*3)
  const n=new THREE.Vector3()
  for (let i=0;i<position.count;i++) {
    const key=`${Math.round(position.getX(i)*precision)},${Math.round(position.getY(i)*precision)},${Math.round(position.getZ(i)*precision)}`
    n.copy(sums.get(key) || new THREE.Vector3(
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i),
    )).normalize()
    out[i*3]=n.x
    out[i*3+1]=n.y
    out[i*3+2]=n.z
  }

  geometry.setAttribute('normal',new THREE.BufferAttribute(out,3))
  geometry.attributes.normal.needsUpdate=true
}

function finishMaterial(material:Material) {
  const m=material as MeshStandardMaterial
  if ('wireframe' in m) m.wireframe=false
  if ('flatShading' in m) m.flatShading=false
  if ('roughness' in m && typeof m.roughness==='number') {
    m.roughness=Math.max(.48,m.roughness)
  }
  m.needsUpdate=true
}

export function smoothCreatureSurface(mesh:Mesh) {
  if (mesh.userData.generatedEye || mesh.userData.generatedFur) return

  const name=`${mesh.name} ${Array.isArray(mesh.material)?mesh.material.map(m=>m.name).join(' '):mesh.material?.name || ''}`.toLowerCase()
  const shouldSmooth=!/eye|iris|pupil|cornea|teeth|tooth|tongue|claw|nail/.test(name)

  if (shouldSmooth && mesh.geometry?.getAttribute('position') && mesh.geometry?.getAttribute('normal')) {
    mesh.geometry=mesh.geometry.clone()
    smoothNormalsByPosition(mesh.geometry)
  }

  if (Array.isArray(mesh.material)) mesh.material.forEach(finishMaterial)
  else if (mesh.material) finishMaterial(mesh.material)
}
