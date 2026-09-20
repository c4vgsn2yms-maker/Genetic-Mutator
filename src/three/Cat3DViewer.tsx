import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei'
import type { Individual } from '../types'
import { CatPreview } from '../CatPreview'
import { ImportedCatModel3D } from './ImportedCatModel3D'
import { CatEnvironment } from './CatEnvironment'
import type { FelineGait } from './felineGait'
import type { CatAgeStage } from './catAgeMorph'

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
const AGES:CatAgeStage[]=['kitten','juvenile','adult','senior']

export function Cat3DViewer({animal}:{animal:Individual}) {
  const webgl=useMemo(()=>supportsWebGL(),[])
  const [gait,setGait]=useState<FelineGait>('idle')
  const [showSkeleton,setShowSkeleton]=useState(false)
  const [ageStage,setAgeStage]=useState<CatAgeStage>('adult')
  const [capabilities,setCapabilities]=useState({hasSkeleton:false,hasAnimations:false})

  if (!webgl) {
    return (
      <div className="viewer-3d-fallback">
        <div className="render-status unavailable">3D BUILD 7.0 · WebGL unavailable</div>
        <CatPreview animal={animal} />
        <p>Your browser could not create a WebGL context, so the lightweight 2D phenotype preview is being shown instead.</p>
      </div>
    )
  }

  return (
    <div className="viewer-3d-shell imported-cat-viewer">
      <div className="render-status active">3D BUILD 7.0 · imported real cat mesh + genetic morphs</div>

      <div className="age-controls imported-age-controls" aria-label="Age preview">
        {AGES.map(stage=>(
          <button key={stage} className={ageStage===stage?'active':''} onClick={()=>setAgeStage(stage)}>
            {stage[0].toUpperCase()+stage.slice(1)}
          </button>
        ))}
      </div>

      <div className="gait-controls imported-gait-controls" aria-label="3D motion preview">
        {GAITS.map(name=>(
          <button key={name} className={gait===name?'active':''} onClick={()=>setGait(name)}>
            {name[0].toUpperCase()+name.slice(1)}
          </button>
        ))}
        {capabilities.hasSkeleton && (
          <button className={showSkeleton?'active skeleton-button':'skeleton-button'} onClick={()=>setShowSkeleton(v=>!v)}>
            Skeleton
          </button>
        )}
      </div>

      <Canvas
        shadows
        dpr={[1,1.35]}
        camera={{position:[4.4,2.45,5.2],fov:32,near:.1,far:100}}
        gl={{antialias:true,alpha:false}}
        onCreated={({gl})=>{
          gl.outputColorSpace=THREE.SRGBColorSpace
          gl.toneMapping=THREE.ACESFilmicToneMapping
          gl.toneMappingExposure=1.05
        }}
      >
        <color attach="background" args={['#d7e2cf']} />
        <fog attach="fog" args={['#d7e2cf',13,24]} />
        <ambientLight intensity={.38} />
        <hemisphereLight intensity={1.05} groundColor="#7e735d" color="#f4f8ef" />

        <directionalLight
          position={[4.8,7.5,5.8]}
          intensity={1.38}
          color="#fff9ed"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-.00015}
          shadow-normalBias={.035}
        />
        <directionalLight position={[-4.5,3.2,5]} intensity={.50} color="#cfe0ee" />
        <directionalLight position={[-3.8,5.5,-5.8]} intensity={.62} color="#f0e5cf" />

        <CatEnvironment />

        <Bounds fit clip observe margin={1.18}>
          <Suspense fallback={null}>
            <ImportedCatModel3D
              animal={animal}
              gait={gait}
              ageStage={ageStage}
              showSkeleton={showSkeleton}
              onCapabilities={setCapabilities}
            />
          </Suspense>
        </Bounds>

        <ContactShadows position={[0,.015,0]} opacity={.28} scale={8} blur={3.4} far={5.5} />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={2.8}
          maxDistance={9}
          minPolarAngle={Math.PI*.20}
          maxPolarAngle={Math.PI*.49}
          target={[0,1.0,0]}
        />
      </Canvas>

      <div className="viewer-3d-hint">
        Imported real cat mesh · genetics and age stages deform the same feline base · drag to rotate · zoom
        {!capabilities.hasAnimations ? ' · gait buttons currently preview body motion until a rigged source mesh is supplied' : ''}
      </div>
    </div>
  )
}
