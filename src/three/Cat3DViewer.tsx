import { Canvas } from '@react-three/fiber'
import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import type { Individual } from '../types'
import { CatPreview } from '../CatPreview'
import { CatModel3D } from './CatModel3D'
import { CatEnvironment } from './CatEnvironment'
import type { FelineGait } from './felineGait'

function supportsWebGL() {
  try {
    const canvas=document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    )
  } catch {
    return false
  }
}

const GAITS:FelineGait[]=['idle','walk','trot','run','rest']

export function Cat3DViewer({animal}:{animal:Individual}) {
  const webgl=useMemo(()=>supportsWebGL(),[])
  const [gait,setGait]=useState<FelineGait>('idle')
  const [showSkeleton,setShowSkeleton]=useState(false)

  if (!webgl) {
    return (
      <div className="viewer-3d-fallback">
        <div className="render-status unavailable">3D BUILD 5.0 · WebGL unavailable</div>
        <CatPreview animal={animal} />
        <p>Your browser could not create a WebGL context, so the lightweight 2D phenotype preview is being shown instead. If hardware acceleration is disabled, enabling it may allow the 3D model to load.</p>
      </div>
    )
  }

  return (
    <div className="viewer-3d-shell">
      <div className="render-status active">3D BUILD 5.0 · habitat + anatomy rig</div>
      <div className="gait-controls" aria-label="3D animation preview">
        {GAITS.map(name=>(
          <button key={name} className={gait===name?'active':''} onClick={()=>setGait(name)}>
            {name[0].toUpperCase()+name.slice(1)}
          </button>
        ))}
        <button className={showSkeleton?'active skeleton-button':'skeleton-button'} onClick={()=>setShowSkeleton(v=>!v)}>
          Skeleton
        </button>
      </div>
      <Canvas
        shadows
        dpr={[1,1.25]}
        camera={{position:[5.5,3.0,5.2],fov:34,near:.1,far:100}}
        gl={{antialias:true,alpha:true}}
      >
        <color attach="background" args={['#18201c']} />
        <fog attach="fog" args={['#18201c',8.5,17]} />
        <ambientLight intensity={.52} />
        <hemisphereLight intensity={1.05} groundColor="#211f19" color="#dfe9df" />
        <directionalLight
          position={[4.5,7,5]}
          intensity={2.1}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
        <directionalLight position={[-5,3,-4]} intensity={.72} color="#8fa6c5" />

        <CatEnvironment />

        <Bounds fit clip observe margin={1.25}>
          <CatModel3D animal={animal} gait={gait} showSkeleton={showSkeleton} />
        </Bounds>

        <ContactShadows position={[0,.015,0]} opacity={.52} scale={8} blur={2.4} far={6} />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={3.2}
          maxDistance={10}
          minPolarAngle={Math.PI*.22}
          maxPolarAngle={Math.PI*.49}
          target={[0,1.35,0]}
        />
      </Canvas>
      <div className="viewer-3d-hint">Drag to rotate · zoom · choose Rest to inspect the resting pose · Skeleton shows the internal armature</div>
    </div>
  )
}
