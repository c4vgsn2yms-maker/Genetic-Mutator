import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Group, Material, Mesh, MeshStandardMaterial } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture, resolveVisibleAppearance } from './catMaterial'
import { attachRealFur } from './realFur'
import { smoothCreatureSurface } from './surfaceFinish'

const FOX_GLB_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb'

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const avg=(pair:[number,number])=>(pair[0]+pair[1])/2

function cloneMaterial(material:Material):Material {
  return material.clone()
}

export function ImportedFoxGLB({
  animal,
  onLoadState,
  onFurCount,
}:{
  animal:Individual
  onLoadState?:(state:'loading'|'ready'|'error')=>void
  onFurCount?:(count:number)=>void
}) {
  const [source,setSource]=useState<Group|null>(null)
  const [clips,setClips]=useState<THREE.AnimationClip[]>([])
  const [error,setError]=useState<string|null>(null)
  const mixerRef=useRef<THREE.AnimationMixer|null>(null)

  const appearance=useMemo(()=>resolveVisibleAppearance(animal),[
    animal.phenotype.coatHex,
    animal.phenotype.patternHex,
    animal.phenotype.pattern,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
  ])

  const coatTexture=useMemo(()=>createCoatTexture(animal,appearance),[
    animal.id,
    animal.seed,
    animal.phenotype.coatHex,
    animal.phenotype.pattern,
    animal.phenotype.patternDensity,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
    appearance,
  ])

  useEffect(()=>{
    let cancelled=false
    setError(null)
    onLoadState?.('loading')
    const loader=new GLTFLoader()

    loader.load(
      FOX_GLB_URL,
      gltf=>{
        if (cancelled) return
        const object=gltf.scene

        const initialBox=new THREE.Box3().setFromObject(object)
        const size=initialBox.getSize(new THREE.Vector3())
        const center=initialBox.getCenter(new THREE.Vector3())
        const safeHeight=Math.max(.001,size.y)
        const baseScale=1.45/safeHeight

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
          if (Array.isArray(mesh.material)) mesh.material=mesh.material.map(cloneMaterial)
          else if (mesh.material) mesh.material=cloneMaterial(mesh.material)
        })

        setSource(object)
        setClips(gltf.animations || [])
        onLoadState?.('ready')
      },
      undefined,
      err=>{
        if (cancelled) return
        setError(err instanceof Error?err.message:'Fox GLB load failed')
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

    clone.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return
      smoothCreatureSurface(mesh)
    })

    const mutationVisible=animal.phenotype.mutationLabels.length>0
    const nonRedMorph=/winter white|silver fox|black-silver/i.test(animal.phenotype.coatName)
    const preserveAuthoredTexture=!mutationVisible && !nonRedMorph

    clone.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return

      const apply=(mat:Material)=>{
        const m=mat as MeshStandardMaterial
        if (!('color' in m) || !m.color) return
        const name=`${mesh.name} ${m.name || ''}`.toLowerCase()

        if (/eye|iris/.test(name)) {
          if ('map' in m) m.map=null
          m.color.set(appearance.eyeColor)
          if ('roughness' in m) m.roughness=.14
          if ('metalness' in m) m.metalness=0
        } else if (/nose/.test(name)) {
          if ('map' in m) m.map=null
          m.color.set(appearance.noseColor)
          if ('roughness' in m) m.roughness=.38
        } else {
          const hasUv=Boolean(mesh.geometry.getAttribute('uv'))
          if (preserveAuthoredTexture && m.map) {
            // Keep the standard fox's authored facial/leg markings while
            // gently steering the overall tone toward its inherited coat.
            m.color.set(appearance.baseCoatColor)
            m.color.lerp(new THREE.Color('#ffffff'),.62)
          } else {
            if ('map' in m) m.map=coatTexture && hasUv ? coatTexture : null
            m.color.set(coatTexture && hasUv ? '#ffffff' : appearance.baseCoatColor)
          }
          if ('roughness' in m) m.roughness=roughness
          if ('metalness' in m) m.metalness=0
        }
        m.side=THREE.DoubleSide
        m.needsUpdate=true
      }

      if (Array.isArray(mesh.material)) mesh.material.forEach(apply)
      else if (mesh.material) apply(mesh.material)
    })

    attachRealFur(clone,{
      animal,
      coatTexture,
      coatColor:appearance.baseCoatColor,
    })

    return clone
  },[source,animal,coatTexture,appearance])

  useEffect(()=>{
    if (!display) return
    onFurCount?.(Number(display.userData.generatedFurCount || 0))
  },[display,onFurCount])

  useEffect(()=>{
    if (!display || !clips.length) return
    const mixer=new THREE.AnimationMixer(display)
    mixerRef.current=mixer
    const idle=
      clips.find(c=>/survey|idle|stand/i.test(c.name)) ||
      clips.find(c=>!/walk|run/i.test(c.name)) ||
      clips[0]
    if (idle) mixer.clipAction(idle).reset().fadeIn(.15).play()

    return ()=>{
      mixer.stopAllAction()
      mixer.uncacheRoot(display)
      if (mixerRef.current===mixer) mixerRef.current=null
    }
  },[display,clips])

  useFrame((_,delta)=>mixerRef.current?.update(Math.min(delta,.05)))

  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])

  useEffect(()=>()=>{
    if (!display) return
    display.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material)) mesh.material.forEach(m=>m.dispose())
      else mesh.material?.dispose()
      if (mesh.userData.generatedFur) mesh.geometry.dispose()
    })
  },[display])

  const geneticsScale=useMemo(()=>{
    const length=clamp(animal.phenotype.bodyLengthCm/66,.58,1.55)
    const shoulder=clamp(animal.phenotype.shoulderCm/40,.52,1.45)
    const mass=clamp(animal.phenotype.weightKg/6,.22,2.8)
    const leg=clamp(avg(animal.genome.legLength),0,1)
    const fur=clamp(animal.phenotype.furLength,0,1)

    const sx=clamp(.94+(length-1)*.30,.76,1.25)
    const sy=clamp((.95+(shoulder-1)*.23)*(.94+(leg-.5)*.12),.76,1.24)
    const sz=clamp((.95+(Math.pow(mass,.20)-1)*.18)*(1+(fur-.5)*.04),.78,1.22)
    return [sx,sy,sz] as [number,number,number]
  },[animal])

  if (error) return null
  if (!display) return null

  return (
    <group scale={geneticsScale}>
      <primitive object={display} />
    </group>
  )
}
