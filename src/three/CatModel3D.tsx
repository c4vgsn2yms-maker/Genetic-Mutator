import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture } from './catMaterial'
import { phenotypeToCatModel } from './catPhenotypeToModel'
import { createEarGeometry, createFelineCoreGeometry, felineLandmarks } from './felineGeometry'

function FelineLeg({
  x,z,length,pawScale,coatTexture,roughness,hind=false,
}:{
  x:number
  z:number
  length:number
  pawScale:number
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
        <capsuleGeometry args={[hind?.145:.115,Math.max(.18,upper-.28),8,14]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward,kneeY,z]} rotation={[0,0,hind?.30:-.04]} castShadow>
        <capsuleGeometry args={[hind?.105:.088,Math.max(.16,lower-.20),7,12]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward+forwardFoot*.25,ankleY,z]} rotation={[0,0,hind?-.13:.03]} castShadow>
        <capsuleGeometry args={[.067,Math.max(.11,pastern-.12),6,10]} />
        <meshStandardMaterial {...coatProps} />
      </mesh>

      <mesh position={[x+backward+forwardFoot,pawY,z]} scale={[.34*pawScale,.115,.245*pawScale]} castShadow>
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

  const coreGeometry=useMemo(()=>createFelineCoreGeometry(model),[model])
  const leftEar=useMemo(()=>createEarGeometry(.205*model.earScale,.58*model.earScale,.075),[model.earScale])
  const rightEar=useMemo(()=>createEarGeometry(.205*model.earScale,.58*model.earScale,.075),[model.earScale])

  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])
  useEffect(()=>()=>{ coreGeometry.dispose() },[coreGeometry])
  useEffect(()=>()=>{ leftEar.dispose(); rightEar.dispose() },[leftEar,rightEar])

  useFrame(({clock})=>{
    if (!root.current) return
    const breath=1+Math.sin(clock.elapsedTime*1.55)*.0045
    root.current.scale.y=breath
  })

  const {bodyY,shoulderX,hipX,headX,headY,muzzleX}=landmarks
  const legZ=model.bodyWidth*.63

  const tailGeometry=useMemo(()=>{
    const start=-model.bodyLength*.54
    const reach=1.62*model.tailScale
    const points=[
      new THREE.Vector3(start,bodyY+.17,0),
      new THREE.Vector3(start-.35*reach,bodyY+.11,.02),
      new THREE.Vector3(start-.73*reach,bodyY+.32,.04),
      new THREE.Vector3(start-1.00*reach,bodyY+.68,.03),
      new THREE.Vector3(start-.94*reach,bodyY+1.02,.01),
    ]
    const radius=.068+model.bodyWidth*.018+animal.phenotype.furLength*.025
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,radius,10,false)
  },[model.bodyLength,model.tailScale,model.bodyWidth,bodyY,animal.phenotype.furLength])

  useEffect(()=>()=>tailGeometry.dispose(),[tailGeometry])

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
        <mesh geometry={coreGeometry} castShadow receiveShadow>
          <meshStandardMaterial {...coatProps} />
        </mesh>

        {/* Shoulder blades add the mobile feline shoulder silhouette without
            breaking the continuity of the main body surface. */}
        <mesh position={[shoulderX-.02,bodyY+.42,legZ*.72]} rotation={[0,.05,-.28]} scale={[.36,.15,.23]} castShadow>
          <sphereGeometry args={[1,22,14]} />
          <meshStandardMaterial {...coatProps} />
        </mesh>
        <mesh position={[shoulderX-.02,bodyY+.42,-legZ*.72]} rotation={[0,-.05,-.28]} scale={[.36,.15,.23]} castShadow>
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

        <FelineLeg x={shoulderX+.03} z={legZ} length={model.legLength} pawScale={model.pawScale} coatTexture={coatTexture} roughness={roughness} />
        <FelineLeg x={shoulderX+.03} z={-legZ} length={model.legLength} pawScale={model.pawScale} coatTexture={coatTexture} roughness={roughness} />
        <FelineLeg x={hipX} z={legZ} length={model.legLength*.98} pawScale={model.pawScale*1.08} coatTexture={coatTexture} roughness={roughness} hind />
        <FelineLeg x={hipX} z={-legZ} length={model.legLength*.98} pawScale={model.pawScale*1.08} coatTexture={coatTexture} roughness={roughness} hind />

        <mesh geometry={tailGeometry} castShadow>
          <meshStandardMaterial {...coatProps} />
        </mesh>
      </group>
    </group>
  )
}
