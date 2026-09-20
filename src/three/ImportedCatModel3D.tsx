import { useEffect, useMemo, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import type { Individual } from '../types'
import { phenotypeToCatModel } from './catPhenotypeToModel'
import { applyAgeMorph, type CatAgeStage } from './catAgeMorph'
import { bodyLocomotion, type FelineGait } from './felineGait'

export const CAT_ASSET_URL='https://cdn.3dassets.dev/assets/28146/v1/model.glb'

const MORPHS=[
  'bodyLength',
  'bodyWidth',
  'chest',
  'pelvis',
  'head',
  'muzzle',
  'legLength',
  'bodyCondition',
  'fur',
  'tailLength',
] as const

type MorphName=(typeof MORPHS)[number]

type Capabilities={
  hasSkeleton:boolean
  hasAnimations:boolean
}

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const smoothstep=(a:number,b:number,x:number)=>{
  const t=clamp((x-a)/(b-a),0,1)
  return t*t*(3-2*t)
}

function targetInfluences(animal:Individual,ageStage:CatAgeStage):Record<MorphName,number> {
  const model=applyAgeMorph(phenotypeToCatModel(animal),ageStage)
  return {
    bodyLength:clamp((model.bodyLength/2.34-1)/.16,-1.15,1.15),
    bodyWidth:clamp((model.bodyWidth/.49-1)/.15,-1.10,1.15),
    chest:clamp((model.chestWidth-1)/.10,-1,1.10),
    pelvis:clamp((model.pelvisWidth-1)/.10,-1,1.10),
    head:clamp((model.skullScale/.88-1)/.16,-1.05,1.15),
    muzzle:clamp((model.muzzleScale/.78-1)/.16,-1.05,1.10),
    legLength:clamp((model.legLength/1.08-1)/.17,-1.10,1.20),
    bodyCondition:clamp((model.bodyCondition-.94)/.18,-1.05,1.15),
    fur:clamp(model.furInflation/.115,0,1.20),
    tailLength:clamp((model.tailScale-1)/.22,-1,1.10),
  }
}

function colorizeMaterial(material:THREE.Material,animal:Individual) {
  const copy=material.clone()
  const labels=animal.phenotype.mutationLabels
  const target=labels.includes('Albinism')
    ? new THREE.Color('#f3e8df')
    : labels.includes('Leucism')
      ? new THREE.Color('#e4ded4')
      : labels.includes('Melanism')
        ? new THREE.Color('#242322')
        : new THREE.Color(animal.phenotype.coatHex)

  if ('color' in copy && copy.color instanceof THREE.Color) {
    const amount=labels.length ? .72 : .48
    copy.color.lerp(target,amount)
  }
  if ('roughness' in copy && typeof copy.roughness==='number') {
    copy.roughness=Math.max(.48,Math.min(.92,copy.roughness))
  }
  copy.needsUpdate=true
  return copy
}

function buildMorphTargets(root:THREE.Group,animal:Individual) {
  root.updateMatrixWorld(true)
  const bounds=new THREE.Box3().setFromObject(root)
  const size=bounds.getSize(new THREE.Vector3())
  const center=bounds.getCenter(new THREE.Vector3())
  const minY=bounds.min.y

  const tempLocal=new THREE.Vector3()
  const tempWorld=new THREE.Vector3()
  const tempTarget=new THREE.Vector3()
  const tempNormal=new THREE.Vector3()
  const normalMatrix=new THREE.Matrix3()

  root.traverse(object=>{
    if (!(object instanceof THREE.Mesh)) return
    const mesh=object
    const geometry=mesh.geometry.clone()
    const position=geometry.getAttribute('position')
    if (!(position instanceof THREE.BufferAttribute)) {
      mesh.geometry=geometry
      return
    }

    mesh.geometry=geometry
    mesh.material=Array.isArray(mesh.material)
      ? mesh.material.map(mat=>colorizeMaterial(mat,animal))
      : colorizeMaterial(mesh.material,animal)

    root.updateMatrixWorld(true)
    const inverseWorld=mesh.matrixWorld.clone().invert()
    normalMatrix.getNormalMatrix(mesh.matrixWorld)
    const normal=geometry.getAttribute('normal')
    const arrays=Object.fromEntries(MORPHS.map(name=>[name,new Float32Array(position.count*3)])) as Record<MorphName,Float32Array>

    const write=(name:MorphName,index:number,dx:number,dy:number,dz:number)=>{
      tempTarget.copy(tempWorld).add({x:dx,y:dy,z:dz} as THREE.Vector3)
      tempTarget.applyMatrix4(inverseWorld)
      tempLocal.set(position.getX(index),position.getY(index),position.getZ(index))
      tempTarget.sub(tempLocal)
      const arr=arrays[name]
      arr[index*3]=tempTarget.x
      arr[index*3+1]=tempTarget.y
      arr[index*3+2]=tempTarget.z
    }

    for (let i=0;i<position.count;i++) {
      tempLocal.set(position.getX(i),position.getY(i),position.getZ(i))
      tempWorld.copy(tempLocal).applyMatrix4(mesh.matrixWorld)

      const nx=(tempWorld.x-center.x)/Math.max(.0001,size.x*.5)
      const ny=(tempWorld.y-minY)/Math.max(.0001,size.y)
      const nz=(tempWorld.z-center.z)/Math.max(.0001,size.z*.5)

      const upper=smoothstep(.18,.42,ny)
      const notTop=1-smoothstep(.84,.98,ny)
      const torso=upper*notTop*(1-smoothstep(.64,.93,Math.abs(nz)))
      const head=smoothstep(.48,.66,ny)*smoothstep(.43,.72,nz)
      const muzzle=smoothstep(.48,.64,ny)*smoothstep(.70,.94,nz)
      const chest=torso*smoothstep(.02,.30,nz)*(1-smoothstep(.52,.78,nz))
      const pelvis=torso*smoothstep(.03,.28,-nz)*(1-smoothstep(.55,.82,-nz))
      const neck=smoothstep(.35,.60,ny)*smoothstep(.30,.58,nz)*(1-smoothstep(.70,.88,nz))
      const paw=smoothstep(.0,.05,.13-ny)
      const tail=smoothstep(.64,.92,-nz)*smoothstep(.20,.44,ny)

      write('bodyLength',i,0,0,(tempWorld.z-center.z)*.14)
      write('bodyWidth',i,(tempWorld.x-center.x)*.14*(.35+.65*torso),0,0)
      write('chest',i,(tempWorld.x-center.x)*.14*chest,(tempWorld.y-(minY+size.y*.46))*.07*chest,0)
      write('pelvis',i,(tempWorld.x-center.x)*.14*pelvis,(tempWorld.y-(minY+size.y*.46))*.055*pelvis,0)
      write('head',i,(tempWorld.x-center.x)*.16*head,(tempWorld.y-(minY+size.y*.63))*.10*head,(tempWorld.z-(center.z+size.z*.34))*.08*head)
      write('muzzle',i,0,0,size.z*.075*muzzle)
      write('legLength',i,0,size.y*.13*smoothstep(.03,.56,ny)*(1-paw*.75),0)
      write('bodyCondition',i,(tempWorld.x-center.x)*.11*torso,(tempWorld.y-(minY+size.y*.42))*.055*torso,0)

      if (normal instanceof THREE.BufferAttribute) {
        tempNormal.set(normal.getX(i),normal.getY(i),normal.getZ(i)).applyMatrix3(normalMatrix).normalize()
        const furRegion=clamp(torso+head*.72+neck*.70+pelvis*.45,0,1)
        write('fur',i,tempNormal.x*size.y*.016*furRegion,tempNormal.y*size.y*.016*furRegion,tempNormal.z*size.y*.016*furRegion)
      } else {
        write('fur',i,0,0,0)
      }

      write('tailLength',i,0,size.y*.015*tail,(tempWorld.z-center.z)*.18*tail)
    }

    geometry.morphTargetsRelative=true
    geometry.morphAttributes.position=MORPHS.map(name=>{
      const attr=new THREE.Float32BufferAttribute(arrays[name],3)
      attr.name=name
      return attr
    })
    geometry.computeBoundingSphere()
    mesh.updateMorphTargets()
  })

  return root
}

function applyInfluences(root:THREE.Group,influences:Record<MorphName,number>) {
  root.traverse(object=>{
    if (!(object instanceof THREE.Mesh) || !object.morphTargetDictionary || !object.morphTargetInfluences) return
    for (const name of MORPHS) {
      const index=object.morphTargetDictionary[name]
      if (index!==undefined) object.morphTargetInfluences[index]=influences[name]
    }
  })
}

export function ImportedCatModel3D({
  animal,
  gait='idle',
  ageStage='adult',
  showSkeleton=false,
  onCapabilities,
}:{
  animal:Individual
  gait?:FelineGait
  ageStage?:CatAgeStage
  showSkeleton?:boolean
  onCapabilities?:(capabilities:Capabilities)=>void
}) {
  const gltf=useGLTF(CAT_ASSET_URL)
  const motionRoot=useRef<THREE.Group>(null)
  const {actions}=useAnimations(gltf.animations,motionRoot)
  const model=useMemo(()=>applyAgeMorph(phenotypeToCatModel(animal),ageStage),[animal,ageStage])
  const influences=useMemo(()=>targetInfluences(animal,ageStage),[animal,ageStage])

  const scene=useMemo(()=>{
    const cloned=cloneSkeleton(gltf.scene) as THREE.Group
    return buildMorphTargets(cloned,animal)
  },[gltf.scene,animal])

  useEffect(()=>{
    applyInfluences(scene,influences)
  },[scene,influences])

  const capabilities=useMemo(()=>{
    let hasSkeleton=false
    scene.traverse(object=>{
      if (object instanceof THREE.SkinnedMesh) hasSkeleton=true
    })
    return {hasSkeleton,hasAnimations:gltf.animations.length>0}
  },[scene,gltf.animations.length])

  useEffect(()=>{
    onCapabilities?.(capabilities)
  },[capabilities,onCapabilities])

  const skeletonHelper=useMemo(()=>{
    if (!capabilities.hasSkeleton) return null
    let target:THREE.SkinnedMesh|null=null
    scene.traverse(object=>{
      if (!target && object instanceof THREE.SkinnedMesh) target=object
    })
    return target ? new THREE.SkeletonHelper(target) : null
  },[scene,capabilities.hasSkeleton])

  useEffect(()=>{
    if (skeletonHelper) skeletonHelper.visible=showSkeleton
  },[skeletonHelper,showSkeleton])

  useEffect(()=>()=> {
    scene.traverse(object=>{
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials=Array.isArray(object.material)?object.material:[object.material]
      materials.forEach(material=>material.dispose())
    })
    if (skeletonHelper) {
      skeletonHelper.geometry.dispose()
      if (Array.isArray(skeletonHelper.material)) skeletonHelper.material.forEach(material=>material.dispose())
      else skeletonHelper.material.dispose()
    }
  },[scene,skeletonHelper])

  useEffect(()=>{
    const entries=Object.entries(actions)
    entries.forEach(([,action])=>action?.fadeOut(.12))
    if (!entries.length) return
    const wanted=gait==='rest'?'sleep':gait
    const chosen=entries.find(([name])=>name.toLowerCase().includes(wanted))
      ?? entries.find(([name])=>gait==='idle' && name.toLowerCase().includes('idle'))
      ?? entries[0]
    chosen?.[1]?.reset().fadeIn(.12).play()
    return ()=>chosen?.[1]?.fadeOut(.12)
  },[actions,gait])

  useFrame(({clock})=>{
    if (!motionRoot.current) return
    if (!capabilities.hasAnimations) {
      const t=clock.elapsedTime
      const movement=bodyLocomotion(gait,t,model.legLength,model.bodyLength)
      const gaitEnergy=gait==='idle'?0:gait==='rest'?.15:gait==='walk'?.45:gait==='trot'?.72:1
      motionRoot.current.position.y=movement.bob*.42
      motionRoot.current.rotation.x=movement.pitch*.55
      motionRoot.current.rotation.z=movement.roll*.50+Math.sin(t*(1.1+gaitEnergy*2.2))*gaitEnergy*.008
    }
  })

  const displayScale=3.05*clamp(model.overallScale/.86,.58,1.75)

  return (
    <group ref={motionRoot} scale={displayScale}>
      <primitive object={scene} />
      {skeletonHelper && <primitive object={skeletonHelper} />}
    </group>
  )
}

useGLTF.preload(CAT_ASSET_URL)
