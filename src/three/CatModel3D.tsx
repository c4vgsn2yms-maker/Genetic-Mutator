import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture } from './catMaterial'
import { phenotypeToCatModel } from './catPhenotypeToModel'

function Leg({
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
  const upper=length*.54
  const lower=length*.48
  const hipY=1.35
  const kneeY=hipY-upper*.75
  const hockY=kneeY-lower*.70
  const pawY=.18
  const backShift=hind?-.18:.04

  return (
    <group>
      <mesh position={[x,hipY,z]} rotation={[0,0,hind?-.18:.06]} castShadow>
        <cylinderGeometry args={[hind?.17:.13,hind?.12:.10,upper,12]} />
        <meshStandardMaterial map={coatTexture ?? undefined} color={coatTexture?'white':'#777'} roughness={roughness} />
      </mesh>
      <mesh position={[x+backShift,kneeY,z]} rotation={[0,0,hind?.22:-.02]} castShadow>
        <cylinderGeometry args={[hind?.115:.095,.075,lower,12]} />
        <meshStandardMaterial map={coatTexture ?? undefined} color={coatTexture?'white':'#777'} roughness={roughness} />
      </mesh>
      <mesh position={[x+backShift+(hind?.10:.08),pawY,z]} scale={[.32*pawScale,.13,.24*pawScale]} castShadow>
        <sphereGeometry args={[1,18,12]} />
        <meshStandardMaterial map={coatTexture ?? undefined} color={coatTexture?'white':'#777'} roughness={roughness} />
      </mesh>
    </group>
  )
}

function Eye({x,y,z}: {x:number;y:number;z:number}) {
  return (
    <group position={[x,y,z]}>
      <mesh scale={[.055,.105,.085]}>
        <sphereGeometry args={[1,18,12]} />
        <meshPhysicalMaterial color="#8aa25a" roughness={.14} clearcoat={1} clearcoatRoughness={.08} />
      </mesh>
      <mesh position={[.051,0,0]} scale={[.013,.075,.018]}>
        <sphereGeometry args={[1,12,8]} />
        <meshBasicMaterial color="#070808" />
      </mesh>
    </group>
  )
}

export function CatModel3D({animal}:{animal:Individual}) {
  const root=useRef<Group>(null)
  const model=useMemo(()=>phenotypeToCatModel(animal),[animal])
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

  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])

  useFrame(({clock})=>{
    if (!root.current) return
    const breath=1+Math.sin(clock.elapsedTime*1.55)*.006
    root.current.scale.y=breath
  })

  const bodyX=model.bodyLength
  const bodyY=1.50
  const shoulderX=bodyX*.28
  const hipX=-bodyX*.28
  const legZ=model.bodyWidth*.56

  const headX=bodyX*.52+.48
  const headY=bodyY+.18
  const headW=.48*model.skullScale
  const headH=.48*(.92+model.skullScale*.08)
  const muzzleX=headX+.42+.12*model.muzzleScale

  const tailGeometry=useMemo(()=>{
    const start=-bodyX*.48
    const reach=1.55*model.tailScale
    const points=[
      new THREE.Vector3(start,bodyY+.12,0),
      new THREE.Vector3(start-.42*reach,bodyY+.03,.02),
      new THREE.Vector3(start-.82*reach,bodyY+.24,.04),
      new THREE.Vector3(start-1.04*reach,bodyY+.62,.03),
      new THREE.Vector3(start-.94*reach,bodyY+.94,.01),
    ]
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.075+model.bodyWidth*.015,8,false)
  },[bodyX,bodyY,model.tailScale,model.bodyWidth])

  useEffect(()=>()=>tailGeometry.dispose(),[tailGeometry])

  const coatMaterial=(extra?:Partial<JSX.IntrinsicElements['meshStandardMaterial']>)=>(
    <meshStandardMaterial
      map={coatTexture ?? undefined}
      color={coatTexture?'white':animal.phenotype.coatHex}
      roughness={roughness}
      metalness={0}
      {...extra}
    />
  )

  return (
    <group scale={model.overallScale}>
      <group ref={root}>
        <mesh position={[0,bodyY,0]} scale={[bodyX*.52,model.bodyHeight,model.bodyWidth]} castShadow receiveShadow>
          <sphereGeometry args={[1,40,26]} />
          {coatMaterial()}
        </mesh>

        <mesh position={[shoulderX,bodyY+.05,0]} scale={[.62*model.chestScale,model.bodyHeight*.93,model.bodyWidth*1.02]} castShadow>
          <sphereGeometry args={[1,28,20]} />
          {coatMaterial()}
        </mesh>

        <mesh position={[hipX-.10,bodyY-.01,0]} scale={[.68*model.haunchScale,model.bodyHeight*.98,model.bodyWidth*1.06]} castShadow>
          <sphereGeometry args={[1,28,20]} />
          {coatMaterial()}
        </mesh>

        <mesh position={[bodyX*.40,bodyY+.10,0]} scale={[.52*model.neckScale,.53*model.neckScale,.48*model.neckScale]} rotation={[0,0,-.22]} castShadow>
          <sphereGeometry args={[1,28,20]} />
          {coatMaterial()}
        </mesh>

        <mesh position={[headX,headY,0]} scale={[.50,headH,headW]} castShadow>
          <sphereGeometry args={[1,36,24]} />
          {coatMaterial()}
        </mesh>

        <mesh position={[muzzleX,headY-.12,.12]} scale={[.29*model.muzzleScale,.20,.20]} castShadow>
          <sphereGeometry args={[1,24,16]} />
          <meshStandardMaterial color={animal.phenotype.mutationLabels.includes('Albinism')?'#eadbd6':'#d2b8a8'} roughness={.82} />
        </mesh>
        <mesh position={[muzzleX,headY-.12,-.12]} scale={[.29*model.muzzleScale,.20,.20]} castShadow>
          <sphereGeometry args={[1,24,16]} />
          <meshStandardMaterial color={animal.phenotype.mutationLabels.includes('Albinism')?'#eadbd6':'#d2b8a8'} roughness={.82} />
        </mesh>

        <mesh position={[muzzleX+.27*model.muzzleScale,headY-.08,0]} scale={[.11,.075,.10]} castShadow>
          <sphereGeometry args={[1,18,12]} />
          <meshPhysicalMaterial color={animal.phenotype.mutationLabels.includes('Albinism')?'#d8a9a9':'#4d3034'} roughness={.48} clearcoat={.25} />
        </mesh>

        <mesh position={[headX-.06,headY+.54,.29]} rotation={[0,0,.05]} scale={[model.earScale,model.earScale,model.earScale]} castShadow>
          <coneGeometry args={[.22,.58,3]} />
          {coatMaterial()}
        </mesh>
        <mesh position={[headX-.06,headY+.54,-.29]} rotation={[0,0,.05]} scale={[model.earScale,model.earScale,model.earScale]} castShadow>
          <coneGeometry args={[.22,.58,3]} />
          {coatMaterial()}
        </mesh>

        <Eye x={headX+.36} y={headY+.10} z={.27} />
        <Eye x={headX+.36} y={headY+.10} z={-.27} />

        <Leg x={shoulderX+.12} z={legZ} length={model.legLength} pawScale={model.pawScale} coatTexture={coatTexture} roughness={roughness} />
        <Leg x={shoulderX+.12} z={-legZ} length={model.legLength} pawScale={model.pawScale} coatTexture={coatTexture} roughness={roughness} />
        <Leg x={hipX} z={legZ} length={model.legLength*.96} pawScale={model.pawScale*1.08} coatTexture={coatTexture} roughness={roughness} hind />
        <Leg x={hipX} z={-legZ} length={model.legLength*.96} pawScale={model.pawScale*1.08} coatTexture={coatTexture} roughness={roughness} hind />

        <mesh geometry={tailGeometry} castShadow>
          {coatMaterial()}
        </mesh>
      </group>
    </group>
  )
}
