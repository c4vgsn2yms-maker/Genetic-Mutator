import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import type { Individual } from '../types'
import { CatPreview } from '../CatPreview'
import { CatModel3D } from './CatModel3D'
import { CatEnvironment } from './CatEnvironment'
import { SketchfabCatReference, type CatReferenceSource } from './SketchfabCatReference'
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
  const [viewMode,setViewMode]=useState<'genetic'|'reference'>('genetic')
  const [ageStage,setAgeStage]=useState<CatAgeStage>('adult')
  const [referenceSource,setReferenceSource]=useState<CatReferenceSource>('realistic-adult')

  if (viewMode==='genetic' && !webgl) {
    return (
      <div className="viewer-3d-fallback">
        <div className="model-source-tabs">
          <button className="active" onClick={()=>setViewMode('genetic')}>Genetic Model</button>
          <button onClick={()=>setViewMode('reference')}>Realistic Reference</button>
        </div>
        <div className="render-status unavailable">3D BUILD 6.4 · WebGL unavailable</div>
        <CatPreview animal={animal} />
        <p>Your browser could not create a WebGL context, so the lightweight 2D phenotype preview is being shown instead. You can still switch to Realistic Reference to view the Sketchfab model.</p>
      </div>
    )
  }

  return (
    <div className="viewer-3d-shell">
      <div className="render-status active">3D BUILD 6.4 · reference-calibrated feline anatomy</div>
      <div className="model-source-tabs" aria-label="3D model source">
        <button className={viewMode==='genetic'?'active':''} onClick={()=>setViewMode('genetic')}>Genetic Model</button>
        <button className={viewMode==='reference'?'active':''} onClick={()=>setViewMode('reference')}>Realistic Reference</button>
      </div>
      {viewMode==='genetic' && (
        <div className="age-controls" aria-label="Age preview">
          {AGES.map(stage=>(
            <button key={stage} className={ageStage===stage?'active':''} onClick={()=>setAgeStage(stage)}>
              {stage[0].toUpperCase()+stage.slice(1)}
            </button>
          ))}
        </div>
      )}
      {viewMode==='reference' && (
        <div className="reference-source-controls" aria-label="Reference model">
          <button className={referenceSource==='realistic-adult'?'active':''} onClick={()=>setReferenceSource('realistic-adult')}>
            Adult Ref
          </button>
          <button className={referenceSource==='family'?'active':''} onClick={()=>setReferenceSource('family')}>
            Cat Family
          </button>
        </div>
      )}
      {viewMode==='genetic' && <div className="gait-controls" aria-label="3D animation preview">
        {GAITS.map(name=>(
          <button key={name} className={gait===name?'active':''} onClick={()=>setGait(name)}>
            {name[0].toUpperCase()+name.slice(1)}
          </button>
        ))}
        <button className={showSkeleton?'active skeleton-button':'skeleton-button'} onClick={()=>setShowSkeleton(v=>!v)}>
          Skeleton
        </button>
      </div>}
      {viewMode==='reference' ? (
        <SketchfabCatReference source={referenceSource} />
      ) : (
      <Canvas
        shadows
        dpr={[1,1.25]}
        camera={{position:[5.5,3.0,5.2],fov:34,near:.1,far:100}}
        gl={{antialias:true,alpha:false}}
        onCreated={({gl})=>{
          gl.outputColorSpace=THREE.SRGBColorSpace
          gl.toneMapping=THREE.ACESFilmicToneMapping
          gl.toneMappingExposure=1.08
        }}
      >
        <color attach="background" args={['#d7e2cf']} />
        <fog attach="fog" args={['#d7e2cf',13,24]} />
        <ambientLight intensity={.34} />
        <hemisphereLight intensity={1.05} groundColor="#7e735d" color="#f4f8ef" />

        {/* Key light: soft daylight from above/front. */}
        <directionalLight
          position={[4.8,7.5,5.8]}
          intensity={1.45}
          color="#fff9ed"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-.00015}
          shadow-normalBias={.035}
        />

        {/* Fill keeps the visible shadow side readable without flattening it. */}
        <directionalLight position={[-4.5,3.2,5.0]} intensity={.52} color="#cfe0ee" />

        {/* Rim separates dark coats and tails from the habitat. */}
        <directionalLight position={[-3.8,5.5,-5.8]} intensity={.68} color="#f0e5cf" />

        <CatEnvironment />

        <Bounds fit clip observe margin={1.25}>
          <CatModel3D animal={animal} gait={gait} showSkeleton={showSkeleton} ageStage={ageStage} />
        </Bounds>

        <ContactShadows position={[0,.015,0]} opacity={.30} scale={8} blur={3.2} far={5.5} />

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
      )}
      <div className="viewer-3d-hint">
        {viewMode==='reference'
          ? (referenceSource==='family'
              ? 'Cat Family age reference from Sketchfab · use it to compare kitten and adult proportions'
              : 'Adult realistic anatomy reference from Sketchfab · this model is not connected to genetics yet')
          : `Age preview: ${ageStage} · drag to rotate · zoom · gait and skeleton controls remain available`}
      </div>
    </div>
  )
}
