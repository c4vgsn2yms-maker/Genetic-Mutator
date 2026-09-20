import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Group, Material, Mesh, MeshStandardMaterial } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture, resolveVisibleAppearance } from './catMaterial'

const CAT_FBX_URL =
  'https://raw.githubusercontent.com/nrz/ylikuutio/adcb264480542b2a6ca16cedbd1afecc605cb2d6/res/objects/www.blendswap.com/86110_rigged_and_animated_cat/cat.fbx'

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const avg=(pair:[number,number])=>(pair[0]+pair[1])/2

function cloneMaterial(material:Material):Material {
  return material.clone()
}

export function ImportedCatFBX({
  animal,
  onLoadState,
}:{
  animal:Individual
  onLoadState?:(state:'loading'|'ready'|'error')=>void
}) {
  const [source,setSource]=useState<Group|null>(null)
  const [error,setError]=useState<string|null>(null)
  const mixerRef=useRef<THREE.AnimationMixer|null>(null)
  const appearance=useMemo(()=>resolveVisibleAppearance(animal),[
    animal.phenotype.coatHex,
    animal.phenotype.patternHex,
    animal.phenotype.pattern,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
    appearance,
  ])
  const coatTexture=useMemo(()=>createCoatTexture(animal,appearance),[
    animal.id,
    animal.seed,
    animal.phenotype.coatHex,
    animal.phenotype.pattern,
    animal.phenotype.patternDensity,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
  ])

  useEffect(()=>{
    let cancelled=false
    setError(null)
    onLoadState?.('loading')
    const loader=new FBXLoader()

    loader.load(
      CAT_FBX_URL,
      object=>{
        if (cancelled) return

        const initialBox=new THREE.Box3().setFromObject(object)
        const size=initialBox.getSize(new THREE.Vector3())
        const center=initialBox.getCenter(new THREE.Vector3())
        const safeHeight=Math.max(.001,size.y)

        // Normalize the authored FBX to a stable cat-sized scene object.
        const baseScale=1.75/safeHeight
        object.scale.setScalar(baseScale)
        object.position.set(
          -center.x*baseScale,
          -initialBox.min.y*baseScale,
          -center.z*baseScale,
        )

        object.traverse(child=>{
          const mesh=child as Mesh
          if (!mesh.isMesh) return
          mesh.castShadow=true
          mesh.receiveShadow=true
          mesh.frustumCulled=false
          if (Array.isArray(mesh.material)) {
            mesh.material=mesh.material.map(cloneMaterial)
          } else if (mesh.material) {
            mesh.material=cloneMaterial(mesh.material)
          }
        })

        setSource(object)
        onLoadState?.('ready')
      },
      undefined,
      err=>{
        if (cancelled) return
        setError(err instanceof Error?err.message:'FBX load failed')
        onLoadState?.('error')
      },
    )

    return ()=>{
      cancelled=true
      mixerRef.current?.stopAllAction()
      mixerRef.current=null
    }
  },[onLoadState])

  const display=useMemo(()=>{
    if (!source) return null
    const clone=SkeletonUtils.clone(source) as Group

    const roughness=coatRoughness(animal)

    const materialRole=(meshName:string,materialName:string)=>{
      const name=`${meshName} ${materialName}`.toLowerCase()
      if (/eye|iris|cornea|pupil/.test(name)) return 'eye'
      if (/nose|snoutskin|muzzle_skin/.test(name)) return 'nose'
      if (/pad|pawpad|toe_pad|footpad/.test(name)) return 'pad'
      if (/inner.?ear|ear.?inner|earskin/.test(name)) return 'ear'
      if (/skin|mouth|lip|gum/.test(name)) return 'skin'
      return 'coat'
    }

    clone.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return

      const apply=(mat:Material)=>{
        const m=mat as MeshStandardMaterial
        const role=materialRole(mesh.name,m.name || '')
        if ('color' in m && m.color) {
          if (role==='eye') {
            m.color.set(appearance.eyeColor)
            if ('roughness' in m) m.roughness=.18
            if ('metalness' in m) m.metalness=0
          } else if (role==='nose') {
            m.color.set(appearance.noseColor)
            if ('roughness' in m) m.roughness=.38
            if ('metalness' in m) m.metalness=0
          } else if (role==='pad') {
            m.color.set(appearance.pawPadColor)
            if ('roughness' in m) m.roughness=.72
            if ('metalness' in m) m.metalness=0
          } else if (role==='ear') {
            m.color.set(appearance.earInnerColor)
            if ('roughness' in m) m.roughness=.72
            if ('metalness' in m) m.metalness=0
          } else if (role==='skin') {
            m.color.set(appearance.skinColor)
            if ('roughness' in m) m.roughness=.66
            if ('metalness' in m) m.metalness=0
          } else {
            // The imported mesh supplies the anatomy and rig. The generated
            // texture supplies the animal-specific inherited coat phenotype.
            if (coatTexture && mesh.geometry.getAttribute('uv')) {
              m.map=coatTexture
              m.color.set('#ffffff')
            } else {
              m.color.set(appearance.baseCoatColor)
            }
            if ('roughness' in m) m.roughness=roughness
            if ('metalness' in m) m.metalness=0
          }
        }
        m.side=THREE.DoubleSide
        m.needsUpdate=true
      }

      if (Array.isArray(mesh.material)) mesh.material.forEach(apply)
      else if (mesh.material) apply(mesh.material)
    })

    return clone
  },[source,animal,coatTexture,appearance])

  useEffect(()=>{
    if (!display) return
    const clips=(source?.animations || []).filter(Boolean)
    if (!clips.length) return

    const mixer=new THREE.AnimationMixer(display)
    mixerRef.current=mixer
    const idle=
      clips.find(c=>/idle|stand|rest/i.test(c.name)) ||
      clips.find(c=>!/walk|run|jump|attack/i.test(c.name)) ||
      clips[0]
    if (idle) mixer.clipAction(idle).reset().fadeIn(.15).play()

    return ()=>{
      mixer.stopAllAction()
      mixer.uncacheRoot(display)
      if (mixerRef.current===mixer) mixerRef.current=null
    }
  },[display,source])

  useFrame((_,delta)=>{
    mixerRef.current?.update(Math.min(delta,.05))
  })

  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])

  useEffect(()=>()=>{
    if (!display) return
    display.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material)) mesh.material.forEach(m=>m.dispose())
      else mesh.material?.dispose()
    })
  },[display])

  const geneticsScale=useMemo(()=>{
    const shoulder=clamp(animal.phenotype.shoulderCm/30,.72,1.75)
    const length=clamp(animal.phenotype.bodyLengthCm/58,.72,1.65)
    const mass=clamp(animal.phenotype.weightKg/5.5,.55,3.5)
    const bone=clamp(avg(animal.genome.boneMass),0,1)
    const muscle=clamp(avg(animal.genome.muscleMass),0,1)

    // Keep deformation deliberately subtle so the imported feline anatomy
    // remains intact. More local variation will use morph targets later.
    const sx=clamp(.94+(length-1)*.26,.84,1.22)
    const sy=clamp(.95+(shoulder-1)*.24,.86,1.24)
    const sz=clamp(.94+(Math.pow(mass,.22)-1)*.24+(bone-.5)*.05+(muscle-.5)*.05,.84,1.22)
    return [sx,sy,sz] as [number,number,number]
  },[animal])

  if (error) {
    return (
      <group>
        <mesh position={[0,.9,0]}>
          <boxGeometry args={[1.6,.7,.08]} />
          <meshStandardMaterial color="#553b39" />
        </mesh>
      </group>
    )
  }

  if (!display) return null

  return (
    <group scale={geneticsScale}>
      <primitive object={display} />
    </group>
  )
}
