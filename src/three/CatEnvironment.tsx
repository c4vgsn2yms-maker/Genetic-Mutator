import * as THREE from 'three'
import type { EnvironmentSettings } from '../types'

function Rock({position,scale,rotation=0,color='#8b8372'}:{position:[number,number,number];scale:[number,number,number];rotation?:number;color?:string}) {
  return (
    <mesh position={position} rotation={[0,rotation,0]} scale={scale} castShadow receiveShadow>
      <dodecahedronGeometry args={[1,1]} />
      <meshStandardMaterial color={color} roughness={.98} />
    </mesh>
  )
}

function GrassTuft({position,scale=1,colorA='#5f6d48',colorB='#71805a'}:{position:[number,number,number];scale?:number;colorA?:string;colorB?:string}) {
  const blades=Array.from({length:6},(_,i)=>i)
  return (
    <group position={position} scale={scale}>
      {blades.map(i=>(
        <mesh key={i} position={[(i-2.5)*.035,.11,((i%2)-.5)*.04]} rotation={[0,0,(i-2.5)*.06]}>
          <planeGeometry args={[.035,.25]} />
          <meshStandardMaterial color={i%2?colorA:colorB} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function palette(environment:EnvironmentSettings) {
  if (environment.temperatureC<=0) {
    return {ground:'#d9e3e1',inner:'#edf2ef',back:'#c9dbe0',far:'#bacdd0',rock:'#8f9b9f',grassA:'#70827c',grassB:'#84968e'}
  }
  if (environment.temperatureC>=31 && environment.coverDensity<.4) {
    return {ground:'#a9855f',inner:'#c3a071',back:'#d6c5a2',far:'#c2ad84',rock:'#8c715b',grassA:'#777245',grassB:'#938454'}
  }
  if (environment.terrain==='forest') {
    return {ground:'#756f58',inner:'#8c8765',back:'#a8b99d',far:'#879b79',rock:'#777368',grassA:'#4f6945',grassB:'#668056'}
  }
  if (environment.terrain==='rocky') {
    return {ground:'#7d7970',inner:'#969087',back:'#c1c4bd',far:'#9fa59a',rock:'#686864',grassA:'#626c50',grassB:'#75805c'}
  }
  if (environment.terrain==='wetland') {
    return {ground:'#667261',inner:'#78856d',back:'#aabdad',far:'#829887',rock:'#6e746e',grassA:'#456a52',grassB:'#5e8064'}
  }
  return {ground:'#948a72',inner:'#aa9a78',back:'#c7d3be',far:'#b1bea6',rock:'#8b8372',grassA:'#5f6d48',grassB:'#71805a'}
}

export function CatEnvironment({environment}:{environment:EnvironmentSettings}) {
  const p=palette(environment)
  const grassScale=.55+environment.coverDensity*1.15
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow>
        <circleGeometry args={[8,64]} />
        <meshStandardMaterial color={p.ground} roughness={1} />
      </mesh>

      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.008,0]} receiveShadow>
        <circleGeometry args={[4.8,64]} />
        <meshStandardMaterial color={p.inner} roughness={1} />
      </mesh>

      <mesh position={[0,1.95,-4.5]} receiveShadow>
        <planeGeometry args={[12,5.4]} />
        <meshStandardMaterial color={p.back} roughness={1} />
      </mesh>

      <mesh position={[0,.92,-4.18]} rotation={[-.16,0,0]} receiveShadow>
        <planeGeometry args={[9.5,2.1]} />
        <meshStandardMaterial color={p.far} roughness={1} />
      </mesh>

      <Rock position={[-3.25,.22,-1.45]} scale={[.75,.34,.55]} rotation={.4} color={p.rock} />
      <Rock position={[-2.65,.13,-1.83]} scale={[.38,.21,.32]} rotation={1.1} color={p.rock} />
      <Rock position={[3.15,.18,-1.62]} scale={[.58,.29,.45]} rotation={-.4} color={p.rock} />
      <Rock position={[2.65,.10,-2.0]} scale={[.30,.16,.28]} rotation={.7} color={p.rock} />

      <GrassTuft position={[-2.2,.01,-1.58]} scale={1.25*grassScale} colorA={p.grassA} colorB={p.grassB} />
      <GrassTuft position={[-1.88,.01,-1.83]} scale={.90*grassScale} colorA={p.grassA} colorB={p.grassB} />
      <GrassTuft position={[2.15,.01,-1.74]} scale={1.15*grassScale} colorA={p.grassA} colorB={p.grassB} />
      <GrassTuft position={[2.45,.01,-1.45]} scale={.85*grassScale} colorA={p.grassA} colorB={p.grassB} />
      <GrassTuft position={[.65,.01,-2.55]} scale={.72*grassScale} colorA={p.grassA} colorB={p.grassB} />

      <mesh position={[0,.012,-2.7]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <ringGeometry args={[2.2,3.45,64]} />
        <meshStandardMaterial color={p.far} roughness={1} />
      </mesh>
    </group>
  )
}
