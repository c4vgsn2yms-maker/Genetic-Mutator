import * as THREE from 'three'

function Rock({position,scale,rotation=0}:{position:[number,number,number];scale:[number,number,number];rotation?:number}) {
  return (
    <mesh position={position} rotation={[0,rotation,0]} scale={scale} castShadow receiveShadow>
      <dodecahedronGeometry args={[1,1]} />
      <meshStandardMaterial color="#4a4944" roughness={.98} />
    </mesh>
  )
}

function GrassTuft({position,scale=1}:{position:[number,number,number];scale?:number}) {
  const blades=Array.from({length:6},(_,i)=>i)
  return (
    <group position={position} scale={scale}>
      {blades.map(i=>(
        <mesh key={i} position={[(i-2.5)*.035,.11,((i%2)-.5)*.04]} rotation={[0,0,(i-2.5)*.06]}>
          <planeGeometry args={[.035,.25]} />
          <meshStandardMaterial color={i%2?'#5f6d48':'#71805a'} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

export function CatEnvironment() {
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow>
        <circleGeometry args={[8,64]} />
        <meshStandardMaterial color="#292b27" roughness={1} />
      </mesh>

      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.008,0]} receiveShadow>
        <circleGeometry args={[4.8,64]} />
        <meshStandardMaterial color="#34322b" roughness={1} />
      </mesh>

      <mesh position={[0,1.95,-4.5]} receiveShadow>
        <planeGeometry args={[12,5.4]} />
        <meshStandardMaterial color="#202623" roughness={1} />
      </mesh>

      <mesh position={[0,.92,-4.18]} rotation={[-.16,0,0]} receiveShadow>
        <planeGeometry args={[9.5,2.1]} />
        <meshStandardMaterial color="#283029" roughness={1} />
      </mesh>

      <Rock position={[-3.25,.22,-1.45]} scale={[.75,.34,.55]} rotation={.4} />
      <Rock position={[-2.65,.13,-1.83]} scale={[.38,.21,.32]} rotation={1.1} />
      <Rock position={[3.15,.18,-1.62]} scale={[.58,.29,.45]} rotation={-.4} />
      <Rock position={[2.65,.10,-2.0]} scale={[.30,.16,.28]} rotation={.7} />

      <GrassTuft position={[-2.2,.01,-1.58]} scale={1.25} />
      <GrassTuft position={[-1.88,.01,-1.83]} scale={.90} />
      <GrassTuft position={[2.15,.01,-1.74]} scale={1.15} />
      <GrassTuft position={[2.45,.01,-1.45]} scale={.85} />
      <GrassTuft position={[.65,.01,-2.55]} scale={.72} />

      <mesh position={[0,.012,-2.7]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <ringGeometry args={[2.2,3.45,64]} />
        <meshStandardMaterial color="#222820" roughness={1} />
      </mesh>
    </group>
  )
}
