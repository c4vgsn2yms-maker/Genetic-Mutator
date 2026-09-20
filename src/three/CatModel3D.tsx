import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture } from './catMaterial'
import { phenotypeToCatModel } from './catPhenotypeToModel'
import { createEarGeometry, createFelineCoreGeometry, felineLandmarks } from './felineGeometry'
import { animateFelineRig, createFelineRig } from './felineRig'
import { bodyLocomotion, limbPose, type FelineGait } from './felineGait'

interface CoatProps {
  map: THREE.Texture | undefined
  color: string
  roughness: number
  metalness: number
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
  const hipY=1.40

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
  const pawForward=hind?.20:.15

  return (
    <group ref={root} position={[x,hipY,z]}>
      <group ref={upperJoint}>
        <mesh position={[0,-upper*.48,0]} castShadow>
          <capsuleGeometry args={[upperRadius,Math.max(.12,upper-upperRadius*2),8,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh position={[0,-upper,0]} scale={[upperRadius*1.20,upperRadius*.82,upperRadius*1.14]} castShadow>
          <sphereGeometry args={[1,14,10]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>

        <group ref={lowerJoint} position={[0,-upper,0]}>
          <mesh position={[0,-lower*.48,0]} castShadow>
            <capsuleGeometry args={[lowerRadius,Math.max(.10,lower-lowerRadius*2),7,12]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>
          <mesh position={[0,-lower,0]} scale={[lowerRadius*1.12,lowerRadius*.86,lowerRadius*1.08]} castShadow>
            <sphereGeometry args={[1,12,9]} />
            <meshStandardMaterial {...coatProps} />
          </mesh>

          <group ref={pasternJoint} position={[0,-lower,0]}>
            <mesh position={[0,-pastern*.46,0]} castShadow>
              <capsuleGeometry args={[pasternRadius,Math.max(.08,pastern-pasternRadius*2),6,10]} />
              <meshStandardMaterial {...coatProps} />
            </mesh>

            <group ref={pawJoint} position={[pawForward,-pastern,0]}>
              <mesh scale={[.34*pawScale,.115*thickness,.245*pawScale]} castShadow>
                <sphereGeometry args={[1,22,14]} />
                <meshStandardMaterial {...coatProps} />
              </mesh>
              <mesh position={[.20*pawScale,-.015,0]} scale={[.12*pawScale,.055,.22*pawScale]}>
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

function TailSegment({
  index,count,length,radius,coatProps,gait,seed,
}:{
  index:number
  count:number
  length:number
  radius:number
  coatProps:CoatProps
  gait:FelineGait
  seed:number
}) {
  const joint=useRef<Group>(null)

  useFrame(({clock})=>{
    if (!joint.current) return
    const t=clock.elapsedTime
    const energy=gait==='idle'?1:gait==='walk'?1.15:gait==='trot'?1.30:1.48
    const wave=Math.sin(t*(.72*energy)+(seed%37)*.11-index*.48)
    const secondary=Math.sin(t*(.43*energy)+(seed%53)*.07-index*.31)
    joint.current.rotation.y=wave*(.035+index*.009)*energy
    joint.current.rotation.z=(index===0?-.08:.015)+secondary*(.018+index*.006)
  })

  return (
    <group ref={joint}>
      <mesh position={[-length*.5,0,0]} rotation={[0,0,Math.PI/2]} castShadow>
        <capsuleGeometry args={[Math.max(.028,radius*(1-index/count*.42)),Math.max(.04,length-radius*2),6,10]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>
      {index<count-1 && (
        <group position={[-length,0,0]}>
          <TailSegment index={index+1} count={count} length={length*.965} radius={radius} coatProps={coatProps} gait={gait} seed={seed} />
        </group>
      )}
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

export function CatModel3D({animal,gait='idle'}:{animal:Individual;gait?:FelineGait}) {
  const locomotionRoot=useRef<Group>(null)
  const leftScapula=useRef<THREE.Mesh>(null)
  const rightScapula=useRef<THREE.Mesh>(null)

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

  useEffect(()=>()=> {
    skinnedCore.geometry.dispose()
    skinnedCore.material.dispose()
    skinnedCore.rig.skeleton.dispose()
  },[skinnedCore])

  const leftEar=useMemo(()=>createEarGeometry(.205*model.earScale,.58*model.earScale,.075),[model.earScale])
  const rightEar=useMemo(()=>createEarGeometry(.205*model.earScale,.58*model.earScale,.075),[model.earScale])
  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])
  useEffect(()=>()=>{ leftEar.dispose(); rightEar.dispose() },[leftEar,rightEar])

  const {bodyY,shoulderX,hipX,headX,headY,muzzleX}=landmarks
  const legZ=model.bodyWidth*.63
  const tailStart=-model.bodyLength*.54

  useFrame(({clock})=>{
    const t=clock.elapsedTime
    animateFelineRig(skinnedCore.rig,t,animal.seed)
    const movement=bodyLocomotion(gait,t,model.legLength,model.bodyLength)

    if (locomotionRoot.current) {
      locomotionRoot.current.position.y=movement.bob
      locomotionRoot.current.rotation.z=movement.pitch
      locomotionRoot.current.rotation.x=movement.roll
    }

    const strideRate=gait==='idle'?.72:gait==='walk'?1.3:gait==='trot'?2.0:2.8
    const scapulaShift=Math.sin(t*strideRate+(animal.seed%23))*(gait==='idle'?.014:gait==='walk'?.035:gait==='trot'?.052:.070)
    if (leftScapula.current) leftScapula.current.position.x=shoulderX-.02+scapulaShift
    if (rightScapula.current) rightScapula.current.position.x=shoulderX-.02-scapulaShift
  })

  const coatProps:CoatProps={
    map:coatTexture ?? undefined,
    color:coatTexture?'white':animal.phenotype.coatHex,
    roughness,
    metalness:0,
  }

  const albino=animal.phenotype.mutationLabels.includes('Albinism')
  const eyeColor=albino?'#bd7b86':'#8da85f'
  const noseColor=albino?'#dbaaaa':'#513539'
  const earZ=.30*model.skullScale
  const tailSegments=7
  const totalTailLength=1.62*model.tailScale
  const tailSegmentLength=totalTailLength/tailSegments
  const tailRadius=.068+model.bodyWidth*.018+animal.phenotype.furLength*.025

  return (
    <group scale={model.overallScale}>
      <group ref={locomotionRoot}>
        <primitive object={skinnedCore.mesh} />

        <mesh ref={leftScapula} position={[shoulderX-.02,bodyY+.42,legZ*.72]} rotation={[0,.05,-.28]} scale={[.36*model.limbThickness,.15,.23]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh ref={rightScapula} position={[shoulderX-.02,bodyY+.42,-legZ*.72]} rotation={[0,-.05,-.28]} scale={[.36*model.limbThickness,.15,.23]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>

        <mesh geometry={leftEar} position={[headX-.04,headY+.35,earZ]} rotation={[.02,0,-.08]} castShadow>
          <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={rightEar} position={[headX-.04,headY+.35,-earZ]} rotation={[-.02,0,-.08]} castShadow>
          <meshStandardMaterial {...coatProps} side={THREE.DoubleSide} />
        </mesh>

        <Eye x={headX+.30} y={headY+.10} z={.275*model.skullScale} color={eyeColor} />
        <Eye x={headX+.30} y={headY+.10} z={-.275*model.skullScale} color={eyeColor} />

        <mesh position={[muzzleX+.19*model.muzzleScale,headY-.10,0]} scale={[.105,.071,.105]} castShadow>
          <sphereGeometry args={[1,20,12]} />
          <meshPhysicalMaterial color={noseColor} roughness={.38} clearcoat={.34} />
        </mesh>

        <mesh position={[muzzleX+.13*model.muzzleScale,headY-.21,0]} scale={[.19,.07,.19]}>
          <sphereGeometry args={[1,18,10]} />
          <meshStandardMaterial color="#d3c4bb" transparent opacity={albino?.38:.16} roughness={.92} />
        </mesh>

        <Whiskers x={muzzleX+.10} y={headY-.11} z={.18} side={1} />
        <Whiskers x={muzzleX+.10} y={headY-.11} z={-.18} side={-1} />

        <ArticulatedLeg x={shoulderX+.03} z={legZ} side={1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={shoulderX+.03} z={-legZ} side={-1} length={model.legLength} bodyLength={model.bodyLength} pawScale={model.pawScale} thickness={model.limbThickness} coatProps={coatProps} gait={gait} />
        <ArticulatedLeg x={hipX} z={legZ} side={1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatProps={coatProps} gait={gait} hind />
        <ArticulatedLeg x={hipX} z={-legZ} side={-1} length={model.legLength*.98} bodyLength={model.bodyLength} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatProps={coatProps} gait={gait} hind />

        <group position={[tailStart,bodyY+.17,0]}>
          <TailSegment index={0} count={tailSegments} length={tailSegmentLength} radius={tailRadius} coatProps={coatProps} gait={gait} seed={animal.seed} />
        </group>
      </group>
    </group>
  )
}
