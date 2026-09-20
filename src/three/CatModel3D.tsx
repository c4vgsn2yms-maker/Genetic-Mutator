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

interface CoatProps {
  map: THREE.Texture | undefined
  color: string
  roughness: number
  metalness: number
  side: THREE.Side
}

function ArticulatedLeg({
  x,z,length,pawScale,thickness,coatProps,gait,side,hind=false,bodyLength,
}:{
  x:number
  z:number
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

  const upper=length*(hind?.49:.46)
  const lower=length*(hind?.40:.43)
  const pastern=length*(hind?.25:.17)
  const hipY=1.44

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

  const upperRadius=(hind?.145:.115)*thickness
  const lowerRadius=(hind?.105:.088)*thickness
  const pasternRadius=.067*thickness
  const pawForward=hind?.13:.10

  return (
    <group ref={root} position={[x,hipY,z]}>
      <group ref={upperJoint}>
        <mesh position={[0,-upper*.46,0]} scale={[1,1,.86]} castShadow>
          <cylinderGeometry args={[upperRadius*.78,upperRadius*1.10,Math.max(.16,upper*.88),12,2,false]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh position={[0,-upper,0]} scale={[upperRadius*.92,upperRadius*.70,upperRadius*.88]} castShadow>
          <sphereGeometry args={[1,14,10]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>

        <group ref={lowerJoint} position={[0,-upper,0]}>
          <mesh position={[0,-lower*.46,0]} scale={[1,1,.84]} castShadow>
            <cylinderGeometry args={[lowerRadius*.68,lowerRadius*.96,Math.max(.14,lower*.90),11,2,false]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh position={[0,-lower,0]} scale={[lowerRadius*.84,lowerRadius*.64,lowerRadius*.80]} castShadow>
            <sphereGeometry args={[1,12,9]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>

          <group ref={pasternJoint} position={[0,-lower,0]}>
            <mesh position={[0,-pastern*.46,0]} scale={[1,1,.78]} castShadow>
              <cylinderGeometry args={[pasternRadius*.62,pasternRadius*.88,Math.max(.10,pastern*.88),10,1,false]} />
              <meshStandardMaterial {...coatProps} />
            </mesh>

            <group ref={pawJoint} position={[pawForward,-pastern,0]}>
              <mesh scale={[.22*pawScale,.075*thickness,.155*pawScale]} castShadow>
                <sphereGeometry args={[1,22,14]} />
                <meshStandardMaterial {...coatProps} />
              </mesh>
              <mesh position={[.13*pawScale,-.010,0]} scale={[.075*pawScale,.035,.135*pawScale]}>
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
      <mesh scale={[.058,.108,.087]}>
        <sphereGeometry args={[1,22,14]} />
        <meshPhysicalMaterial color={color} roughness={.10} clearcoat={1} clearcoatRoughness={.05} />
      </mesh>
      <mesh position={[.054,0,0]} scale={[.014,.076,.020]}>
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
        new THREE.Vector3(x+.72,y+.07-i*.055,z+side*(.28+i*.045)),
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

export function CatModel3D({animal,gait='idle',showSkeleton=false}:{animal:Individual;gait?:FelineGait;showSkeleton?:boolean}) {
  const locomotionRoot=useRef<Group>(null)
  const leftScapula=useRef<THREE.Mesh>(null)
  const rightScapula=useRef<THREE.Mesh>(null)
  const leftEarGroup=useRef<Group>(null)
  const rightEarGroup=useRef<Group>(null)
  const jawGroup=useRef<Group>(null)
  const headGroup=useRef<Group>(null)
  const tailGroup=useRef<Group>(null)

  const model=useMemo(()=>phenotypeToCatModel(animal),[animal])
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

  const leftEar=useMemo(()=>createEarGeometry(.18*model.earScale*model.skullScale,.48*model.earScale,.052),[model.earScale,model.skullScale])
  const rightEar=useMemo(()=>createEarGeometry(.18*model.earScale*model.skullScale,.48*model.earScale,.052),[model.earScale,model.skullScale])
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
  const legZ=model.bodyWidth*.54
  const tailStart=-model.bodyLength*.54

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

    const strideRate=gait==='rest'?.35:gait==='idle'?.72:gait==='walk'?1.3:gait==='trot'?2.0:2.8
    const scapulaShift=Math.sin(t*strideRate+(animal.seed%23))*(gait==='idle'?.014:gait==='walk'?.035:gait==='trot'?.052:.070)
    if (leftScapula.current) leftScapula.current.position.x=shoulderX-.02+scapulaShift
    if (rightScapula.current) rightScapula.current.position.x=shoulderX-.02-scapulaShift
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
  const earZ=.30*model.skullScale
  const headEyeX=headX+.23*model.headLength
  const eyeZ=.255*model.skullScale
  const muzzleCenterX=muzzleX-.02
  const noseX=muzzleCenterX+.25*model.muzzleScale

  return (
    <group scale={model.overallScale}>
      <group ref={locomotionRoot}>
        <primitive object={skinnedCore.mesh} />
        <primitive object={skeletonHelper} />

        <mesh ref={leftScapula} position={[shoulderX-.02,bodyY+.42,legZ*.72]} rotation={[0,.05,-.28]} scale={[.30*model.limbThickness,.105,.18]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh ref={rightScapula} position={[shoulderX-.02,bodyY+.42,-legZ*.72]} rotation={[0,-.05,-.28]} scale={[.30*model.limbThickness,.105,.18]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>

        <group ref={headGroup} position={[0,0,0]}>
          <mesh geometry={headGeometry} position={[headX,headY,0]} castShadow receiveShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh geometry={muzzleGeometry} position={[muzzleCenterX,headY-.105,0]} castShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>

          <group ref={leftEarGroup} position={[headX-.10,headY+.31,earZ]} rotation={[.03,-.08,-.08]}>
            <mesh geometry={leftEar} castShadow>
              <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={leftEar} position={[.008,.010,-.008]} scale={[.68,.70,.58]}>
              <meshStandardMaterial color={albino?'#efc7c8':'#b77f7e'} roughness={.92} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <group ref={rightEarGroup} position={[headX-.10,headY+.31,-earZ]} rotation={[-.03,.08,-.08]}>
            <mesh geometry={rightEar} castShadow>
              <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={rightEar} position={[.008,.010,.008]} scale={[.68,.70,.58]}>
              <meshStandardMaterial color={albino?'#efc7c8':'#b77f7e'} roughness={.92} side={THREE.DoubleSide} />
            </mesh>
          </group>

          <Eye x={headEyeX} y={headY+.08} z={eyeZ} color={eyeColor} />
          <Eye x={headEyeX} y={headY+.08} z={-eyeZ} color={eyeColor} />

          <mesh position={[noseX,headY-.095,0]} scale={[.085,.060,.095]} castShadow>
            <sphereGeometry args={[1,20,12]} />
            <meshPhysicalMaterial color={noseColor} roughness={.38} clearcoat={.34} />
          </mesh>

          <group ref={jawGroup} position={[muzzleCenterX+.045,headY-.205,0]}>
            <mesh position={[.03,0,0]} scale={[.15,.055,.145]}>
              <sphereGeometry args={[1,20,12]} />
              <meshStandardMaterial color={albino?'#e6d2cf':animal.phenotype.coatHex} roughness={.88} />
            </mesh>
            <mesh position={[.13,.046,0]} scale={[.055,.012,.10]}>
              <sphereGeometry args={[1,16,10]} />
              <meshStandardMaterial color="#39282b" roughness={.95} />
            </mesh>
          </group>

          <Whiskers x={muzzleCenterX+.06} y={headY-.105} z={.145} side={1} />
          <Whiskers x={muzzleCenterX+.06} y={headY-.105} z={-.145} side={-1} />
        </group>

        <ArticulatedLeg x={shoulderX+.03} z={legZ} side={1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={shoulderX+.03} z={-legZ} side={-1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={hipX} z={legZ} side={1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatProps={coatProps} gait={gait} hind />
        <ArticulatedLeg x={hipX} z={-legZ} side={-1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatProps={coatProps} gait={gait} hind />

        <group ref={tailGroup} position={[tailStart,bodyY+.14,0]}>
          <mesh geometry={tailGeometry} castShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
