import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture } from './catMaterial'
import { phenotypeToCatModel } from './catPhenotypeToModel'
import { createEarGeometry, felineLandmarks } from './felineGeometry'
import { animateFelineRig, createFelineRig } from './felineRig'
import { createFelineCoreGeometry } from './felineGeometry'

function FelineLeg({
  x,z,length,pawScale,thickness,coatTexture,roughness,hind=false,
}:{
  x:number
  z:number
  length:number
  pawScale:number
  thickness:number
  coatTexture:THREE.Texture|null
  roughness:number
  hind?:boolean
}) {
  const upper=length*(hind?.49:.46)
  const lower=length*(hind?.40:.43)
  const pastern=length*(hind?.25:.17)
  const hipY=1.42
  const kneeY=hipY-upper*.72
  const ankleY=Math.max(.35,kneeY-lower*.74)
  const pawY=.15
  const backward=hind?-.17:.035
  const forwardFoot=hind?.20:.14

  const coatProps={
    map:coatTexture ?? undefined,
    color:coatTexture?'white':'#777',
    roughness,
    metalness:0,
  }

  return (
    <group>
      <mesh position={[x,hipY,z]} rotation={[0,0,hind?-.26:.08]} castShadow>
        <capsuleGeometry args={[(hind?.145:.115)*thickness,Math.max(.18,upper-.28),8,14]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward,kneeY,z]} rotation={[0,0,hind?.30:-.04]} castShadow>
        <capsuleGeometry args={[(hind?.105:.088)*thickness,Math.max(.16,lower-.20),7,12]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward+forwardFoot*.25,ankleY,z]} rotation={[0,0,hind?-.13:.03]} castShadow>
        <capsuleGeometry args={[.067*thickness,Math.max(.11,pastern-.12),6,10]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward+forwardFoot,pawY,z]} scale={[.34*pawScale,.115*thickness,.245*pawScale]} castShadow>
        <sphereGeometry args={[1,22,14]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward+forwardFoot+.20*pawScale,pawY-.015,z]} scale={[.12*pawScale,.055,.22*pawScale]}>
        <sphereGeometry args={[1,16,10]} />
        <meshStandardMaterial color="#4c3a3d" roughness={.92} />
      </mesh>
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

export function CatModel3D({animal}:{animal:Individual}) {
  const root=useRef<Group>(null)
  const tailRoot=useRef<Group>(null)
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
      skinning:true,
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

  const tailGeometry=useMemo(()=>{
    const reach=1.62*model.tailScale
    const points=[
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(-.35*reach,-.06,.02),
      new THREE.Vector3(-.73*reach,.15,.04),
      new THREE.Vector3(-1.00*reach,.51,.03),
      new THREE.Vector3(-.94*reach,.85,.01),
    ]
    const radius=.068+model.bodyWidth*.018+animal.phenotype.furLength*.025
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,radius,10,false)
  },[model.tailScale,model.bodyWidth,animal.phenotype.furLength])

  useEffect(()=>()=>tailGeometry.dispose(),[tailGeometry])

  useFrame(({clock})=>{
    const t=clock.elapsedTime
    animateFelineRig(skinnedCore.rig,t,animal.seed)

    if (root.current) {
      root.current.scale.y=1+Math.sin(t*1.45+(animal.seed%127))*.0025
    }
    if (tailRoot.current) {
      tailRoot.current.rotation.y=Math.sin(t*.62+(animal.seed%41))*.075
      tailRoot.current.rotation.z=Math.sin(t*.48+(animal.seed%67))*.035
    }
    const scapulaShift=Math.sin(t*1.45+(animal.seed%23))*.018
    if (leftScapula.current) leftScapula.current.position.x=shoulderX-.02+scapulaShift
    if (rightScapula.current) rightScapula.current.position.x=shoulderX-.02-scapulaShift
  })

  const coatProps={
    map:coatTexture ?? undefined,
    color:coatTexture?'white':animal.phenotype.coatHex,
    roughness,
    metalness:0,
  }

  const albino=animal.phenotype.mutationLabels.includes('Albinism')
  const eyeColor=albino?'#bd7b86':'#8da85f'
  const noseColor=albino?'#dbaaaa':'#513539'
  const earZ=.30*model.skullScale

  return (
    <group scale={model.overallScale}>
      <group ref={root}>
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

        <FelineLeg x={shoulderX+.03} z={legZ} length={model.legLength} pawScale={model.pawScale} thickness={model.limbThickness} coatTexture={coatTexture} roughness={roughness} />
        <FelineLeg x={shoulderX+.03} z={-legZ} length={model.legLength} pawScale={model.pawScale} thickness={model.limbThickness} coatTexture={coatTexture} roughness={roughness} />
        <FelineLeg x={hipX} z={legZ} length={model.legLength*.98} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatTexture={coatTexture} roughness={roughness} hind />
        <FelineLeg x={hipX} z={-legZ} length={model.legLength*.98} pawScale={model.pawScale*1.08} thickness={model.limbThickness*1.06} coatTexture={coatTexture} roughness={roughness} hind />

        <group ref={tailRoot} position={[tailStart,bodyY+.17,0]}>
          <mesh geometry={tailGeometry} castShadow>
            <meshStandardMaterial {...coatProps} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
