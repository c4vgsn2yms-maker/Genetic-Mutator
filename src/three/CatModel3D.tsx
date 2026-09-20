import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture } from './catMaterial'
import { phenotypeToCatModel } from './catPhenotypeToModel'
import { createCatHeadGeometry, createCatMuzzleGeometry, createEarGeometry, createFelineCoreGeometry, createSmoothTailGeometry, felineLandmarks } from './felineGeometry'
import { animateFelineRig, createFelineRig } from './felineRig'
import { bodyLocomotion, limbPose, type FelineGait } from './felineGait'
import { applyAgeMorph, type CatAgeStage } from './catAgeMorph'

interface CoatProps {
  map: THREE.Texture | undefined
  color: string
  roughness: number
  metalness: number
  side: THREE.Side
}

function ArticulatedLeg({
  x,z,rootY,length,pawScale,thickness,coatProps,gait,side,hind=false,bodyLength,
}:{
  x:number
  z:number
  rootY:number
  length:number
  pawScale:number
  thickness:number
  coatProps:CoatProps
  gait:FelineGait
  side:1|-1
  hind?:boolean
  bodyLength:number
}) {
  const root=useRef<Group>(null)
  const upperJoint=useRef<Group>(null)
  const lowerJoint=useRef<Group>(null)
  const pasternJoint=useRef<Group>(null)
  const pawJoint=useRef<Group>(null)

  const upper=length*(hind?.43:.43)
  const lower=length*(hind?.40:.41)
  const pastern=length*(hind?.23:.16)
  const hipY=rootY

  useFrame(({clock})=>{
    const pose=limbPose(gait,clock.elapsedTime,side,hind,length,bodyLength)
    if (root.current) {
      root.current.position.y=hipY+pose.lift
      root.current.position.x=x+pose.shoulder
    }
    if (upperJoint.current) upperJoint.current.rotation.z=pose.upper
    if (lowerJoint.current) lowerJoint.current.rotation.z=pose.lower
    if (pasternJoint.current) pasternJoint.current.rotation.z=pose.pastern
    if (pawJoint.current) pawJoint.current.rotation.z=pose.paw
  })

  const upperRadius=(hind?.190:.138)*thickness
  const lowerRadius=(hind?.098:.088)*thickness
  const pasternRadius=.058*thickness
  const pawForward=hind?.11:.085

  return (
    <group ref={root} position={[x,hipY,z]}>
      <group ref={upperJoint}>
        <mesh position={[0,-upper*.30,0]} scale={[upperRadius*1.08,upper*.31,upperRadius*.92]} castShadow>
          <sphereGeometry args={[1,20,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh position={[0,-upper*.61,0]} scale={[1,1,.86]} castShadow>
          <cylinderGeometry args={[upperRadius*.62,upperRadius*.88,Math.max(.13,upper*.58),14,2,false]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>

        <group ref={lowerJoint} position={[0,-upper,0]}>
          <mesh position={[0,-lower*.48,0]} scale={[1,1,.80]} castShadow>
            <cylinderGeometry args={[lowerRadius*.62,lowerRadius*.88,Math.max(.12,lower*.90),13,2,false]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh position={[0,-lower,0]} scale={[lowerRadius*.70,lowerRadius*.48,lowerRadius*.68]} castShadow>
            <sphereGeometry args={[1,14,10]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>

          <group ref={pasternJoint} position={[0,-lower,0]}>
            <mesh position={[0,-pastern*.46,0]} scale={[1,1,.78]} castShadow>
              <cylinderGeometry args={[pasternRadius*.58,pasternRadius*.82,Math.max(.09,pastern*.90),12,1,false]} />
              <meshStandardMaterial {...coatProps} />
            </mesh>

            <group ref={pawJoint} position={[pawForward,-pastern,0]}>
              <mesh scale={[.20*pawScale,.055*thickness,.125*pawScale]} castShadow>
                <sphereGeometry args={[1,22,14]} />
                <meshStandardMaterial {...coatProps} />
              </mesh>
              <mesh position={[.105*pawScale,-.009,0]} scale={[.054*pawScale,.025,.098*pawScale]}>
                <sphereGeometry args={[1,16,10]} />
                <meshStandardMaterial color="#4c3a3d" roughness={.92} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function Eye({x,y,z,color}:{x:number;y:number;z:number;color:string}) {
  return (
    <group position={[x,y,z]}>
      <mesh scale={[.044,.082,.068]}>
        <sphereGeometry args={[1,22,14]} />
        <meshPhysicalMaterial color={color} roughness={.10} clearcoat={1} clearcoatRoughness={.05} />
      </mesh>
      <mesh position={[.041,0,0]} scale={[.010,.056,.015]}>
        <sphereGeometry args={[1,14,10]} />
        <meshBasicMaterial color="#050606" />
      </mesh>
    </group>
  )
}

function Whiskers({x,y,z,side}:{x:number;y:number;z:number;side:1|-1}) {
  const lines=useMemo(()=>{
    const group:THREE.Line[]=[]
    for (let i=0;i<4;i++) {
      const geometry=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x,y-i*.028,z),
        new THREE.Vector3(x+.50,y+.055-i*.045,z+side*(.22+i*.035)),
      ])
      const material=new THREE.LineBasicMaterial({color:'#d9d6cf',transparent:true,opacity:.58})
      group.push(new THREE.Line(geometry,material))
    }
    return group
  },[x,y,z,side])

  useEffect(()=>()=> {
    lines.forEach(line=>{
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    })
  },[lines])

  return <group>{lines.map((line,i)=><primitive object={line} key={i} />)}</group>
}

export function CatModel3D({
  animal,
  gait='idle',
  showSkeleton=false,
  ageStage='adult',
}:{
  animal:Individual
  gait?:FelineGait
  showSkeleton?:boolean
  ageStage?:CatAgeStage
}) {
  const locomotionRoot=useRef<Group>(null)
  const leftEarGroup=useRef<Group>(null)
  const rightEarGroup=useRef<Group>(null)
  const jawGroup=useRef<Group>(null)
  const headGroup=useRef<Group>(null)
  const tailGroup=useRef<Group>(null)

  const model=useMemo(()=>applyAgeMorph(phenotypeToCatModel(animal),ageStage),[animal,ageStage])
  const landmarks=useMemo(()=>felineLandmarks(model),[model])
  const coatTexture=useMemo(()=>createCoatTexture(animal),[
    animal.id,
    animal.seed,
    animal.phenotype.coatHex,
    animal.phenotype.pattern,
    animal.phenotype.patternDensity,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
  ])
  const roughness=coatRoughness(animal)

  const skinnedCore=useMemo(()=>{
    const geometry=createFelineCoreGeometry(model)
    const material=new THREE.MeshStandardMaterial({
      map:coatTexture ?? undefined,
      color:coatTexture?'white':animal.phenotype.coatHex,
      roughness,
      metalness:0,
      side:THREE.DoubleSide,
    })
    const mesh=new THREE.SkinnedMesh(geometry,material)
    const rig=createFelineRig(model)
    mesh.add(rig.pelvis)
    mesh.bind(rig.skeleton)
    mesh.normalizeSkinWeights()
    mesh.castShadow=true
    mesh.receiveShadow=true
    return {mesh,geometry,material,rig}
  },[model,coatTexture,animal.phenotype.coatHex,roughness])

  const skeletonHelper=useMemo(()=>{
    const helper=new THREE.SkeletonHelper(skinnedCore.mesh)
    helper.visible=showSkeleton
    return helper
  },[skinnedCore.mesh])

  useEffect(()=>{
    skeletonHelper.visible=showSkeleton
  },[showSkeleton,skeletonHelper])

  useEffect(()=>()=> {
    skinnedCore.geometry.dispose()
    skinnedCore.material.dispose()
    skinnedCore.rig.skeleton.dispose()
    skeletonHelper.geometry.dispose()
    if (Array.isArray(skeletonHelper.material)) skeletonHelper.material.forEach(m=>m.dispose())
    else skeletonHelper.material.dispose()
  },[skinnedCore,skeletonHelper])

  const leftEar=useMemo(()=>createEarGeometry(.165*model.earScale*model.skullScale,.34*model.earScale,.050),[model.earScale,model.skullScale])
  const rightEar=useMemo(()=>createEarGeometry(.155*model.earScale*model.skullScale,.38*model.earScale,.045),[model.earScale,model.skullScale])
  const headGeometry=useMemo(()=>createCatHeadGeometry(model),[model])
  const muzzleGeometry=useMemo(()=>createCatMuzzleGeometry(model),[model])
  const tailGeometry=useMemo(()=>createSmoothTailGeometry(model,animal.phenotype.furLength),[model,animal.phenotype.furLength])
  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])
  useEffect(()=>()=>{ 
    leftEar.dispose()
    rightEar.dispose()
    headGeometry.dispose()
    muzzleGeometry.dispose()
    tailGeometry.dispose()
  },[leftEar,rightEar,headGeometry,muzzleGeometry,tailGeometry])

  const {bodyY,shoulderX,hipX,headX,headY,muzzleX}=landmarks
  const legZ=model.bodyWidth*.48
  const tailStart=-model.bodyLength*.52

  useFrame(({clock})=>{
    const t=clock.elapsedTime
    animateFelineRig(skinnedCore.rig,t,animal.seed,gait==='rest')
    const movement=bodyLocomotion(gait,t,model.legLength,model.bodyLength)

    if (leftEarGroup.current) leftEarGroup.current.rotation.x=skinnedCore.rig.leftEar.rotation.x
    if (rightEarGroup.current) rightEarGroup.current.rotation.x=skinnedCore.rig.rightEar.rotation.x
    if (jawGroup.current) jawGroup.current.rotation.z=skinnedCore.rig.jaw.rotation.z
    if (headGroup.current) {
      headGroup.current.rotation.y=skinnedCore.rig.head.rotation.y
      headGroup.current.rotation.z=skinnedCore.rig.head.rotation.z
    }
    if (tailGroup.current) {
      const rest=gait==='rest'
      tailGroup.current.rotation.y=(rest?.32:0)+Math.sin(t*(rest?.30:.55)+(animal.seed%41))*(rest?.025:.075)
      tailGroup.current.rotation.z=(rest?-.26:-.10)+Math.sin(t*.41+(animal.seed%59))*.025
    }

    if (locomotionRoot.current) {
      locomotionRoot.current.position.y=movement.bob
      locomotionRoot.current.rotation.z=movement.pitch
      locomotionRoot.current.rotation.x=movement.roll
    }

  })

  const coatProps:CoatProps={
    map:coatTexture ?? undefined,
    color:coatTexture?'white':animal.phenotype.coatHex,
    roughness,
    metalness:0,
    side:THREE.DoubleSide,
  }

  const albino=animal.phenotype.mutationLabels.includes('Albinism')
  const eyeColor=albino?'#bd7b86':'#8da85f'
  const noseColor=albino?'#dbaaaa':'#513539'
  const earZ=.235*model.skullScale
  const headEyeX=headX+.155*model.headLength
  const eyeZ=.225*model.skullScale
  const muzzleCenterX=muzzleX-.035
  const noseX=muzzleCenterX+.145*model.muzzleScale

  return (
    <group scale={model.overallScale}>
      <group ref={locomotionRoot}>
        <primitive object={skinnedCore.mesh} />
        <primitive object={skeletonHelper} />

        <group ref={headGroup} position={[0,0,0]}>
          <mesh geometry={headGeometry} position={[headX,headY,0]} castShadow receiveShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh geometry={muzzleGeometry} position={[muzzleCenterX,headY-.105,0]} castShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh position={[headX+.205*model.headLength,headY-.035,0]} scale={[.105,.095,.135*model.skullScale]} castShadow>
            <sphereGeometry args={[1,24,16]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>

          <group ref={leftEarGroup} position={[headX-.08,headY+.245,earZ]} rotation={[.03,-.08,-.08]}>
            <mesh geometry={leftEar} castShadow>
              <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={leftEar} position={[.008,.010,-.008]} scale={[.68,.70,.58]}>
              <meshStandardMaterial color={albino?'#efc7c8':'#b77f7e'} roughness={.92} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <group ref={rightEarGroup} position={[headX-.08,headY+.245,-earZ]} rotation={[-.03,.08,-.08]}>
            <mesh geometry={rightEar} castShadow>
              <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={rightEar} position={[.008,.010,.008]} scale={[.68,.70,.58]}>
              <meshStandardMaterial color={albino?'#efc7c8':'#b77f7e'} roughness={.92} side={THREE.DoubleSide} />
            </mesh>
          </group>

          <Eye x={headEyeX} y={headY+.08} z={eyeZ} color={eyeColor} />
          <Eye x={headEyeX} y={headY+.08} z={-eyeZ} color={eyeColor} />

          <mesh position={[noseX,headY-.095,0]} scale={[.067,.048,.080]} castShadow>
            <sphereGeometry args={[1,20,12]} />
            <meshPhysicalMaterial color={noseColor} roughness={.38} clearcoat={.34} />
          </mesh>

          <group ref={jawGroup} position={[muzzleCenterX+.015,headY-.155,0]}>
            <mesh position={[.03,0,0]} scale={[.102,.040,.108]}>
              <sphereGeometry args={[1,20,12]} />
              <meshStandardMaterial color={albino?'#e6d2cf':animal.phenotype.coatHex} roughness={.88} />
            </mesh>
            <mesh position={[.095,.036,0]} scale={[.042,.010,.080]}>
              <sphereGeometry args={[1,16,10]} />
              <meshStandardMaterial color="#39282b" roughness={.95} />
            </mesh>
          </group>

          <Whiskers x={muzzleCenterX+.06} y={headY-.105} z={.145} side={1} />
          <Whiskers x={muzzleCenterX+.06} y={headY-.105} z={-.145} side={-1} />
        </group>

        <ArticulatedLeg x={shoulderX+.02} z={legZ} rootY={bodyY+.035} side={1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={shoulderX+.02} z={-legZ} rootY={bodyY+.035} side={-1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={hipX-.015} z={legZ} rootY={bodyY+.05} side={1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.03} thickness={model.limbThickness*1.08} coatProps={coatProps} gait={gait} hind />
        <ArticulatedLeg x={hipX-.015} z={-legZ} rootY={bodyY+.05} side={-1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.03} thickness={model.limbThickness*1.08} coatProps={coatProps} gait={gait} hind />

        <mesh position={[tailStart+.07,bodyY+.075,0]} scale={[.17,.105,.115]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <group ref={tailGroup} position={[tailStart,bodyY+.08,0]}>
          <mesh geometry={tailGeometry} castShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
