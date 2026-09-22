import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { EnvironmentSettings, Individual } from '../types'
import { ImportedCatFBX } from './ImportedCatFBX'
import { ImportedFoxGLB } from './ImportedFoxGLB'
import { CatEnvironment } from './CatEnvironment'

export function Cat3DViewer({animal,environment}:{animal:Individual;environment:EnvironmentSettings}) {
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading')
  const [furCount,setFurCount]=useState(0)
  const [guideCount,setGuideCount]=useState(0)
  const isFox=animal.species==='fox'
  const speciesLabel=isFox?'fox':'cat'

  return (
    <div className="viewer-3d-shell imported-fbx-live-viewer">
      <div className={`render-status ${loadState==='error'?'unavailable':'active'}`}>
        {loadState==='loading'
          ? `3D BUILD 8.7.2 · loading ${speciesLabel} model`
          : loadState==='ready'
            ? `3D BUILD 8.7.2 · animated ${speciesLabel} active`
            : `3D BUILD 8.7.2 · ${speciesLabel} model unavailable`}
      </div>

      <Canvas
        shadows
        camera={{position:[4.2,2.4,5.0],fov:42,near:.01,far:100}}
        dpr={[1,1.75]}
        gl={{antialias:true,alpha:false}}
        onCreated={({gl})=>{
          gl.outputColorSpace=THREE.SRGBColorSpace
          gl.toneMapping=THREE.ACESFilmicToneMapping
          gl.toneMappingExposure=1.05
        }}
      >
        <color attach="background" args={['#d7e2cf']} />
        <fog attach="fog" args={['#d7e2cf',10,22]} />

        <ambientLight intensity={.34} />
        <hemisphereLight intensity={1.0} groundColor="#81745f" color="#f4f8ef" />
        <directionalLight
          position={[4.5,7,5.5]}
          intensity={1.35}
          color="#fff9ed"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-4,3.2,4.5]} intensity={.46} color="#d5e3ee" />
        <directionalLight position={[-3.5,5,-5]} intensity={1.05} color="#efe4cf" />
        <directionalLight position={[1.5,3.5,-6]} intensity={.72} color="#f8efe2" />

        <CatEnvironment environment={environment} />
        {isFox
          ? <ImportedFoxGLB animal={animal} onLoadState={setLoadState} onFurCount={setFurCount} onGuideCount={setGuideCount} />
          : <ImportedCatFBX animal={animal} onLoadState={setLoadState} onFurCount={setFurCount} onGuideCount={setGuideCount} />}
        <ContactShadows position={[0,.01,0]} opacity={.28} scale={7} blur={3.2} far={5} />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={2.4}
          maxDistance={8}
          target={[0,.85,0]}
        />
      </Canvas>

      <div className="asset-credit">
        {isFox ? (
          <>
            <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox" target="_blank" rel="noreferrer">
              Fox · Khronos glTF Sample Assets
            </a>
            <span>CC0 model · CC BY 4.0 rig/animation + glTF conversion</span>
          </>
        ) : (
          <>
            <a href="https://blendswap.com/blend/18519" target="_blank" rel="noreferrer">
              Rigged and animated Cat · JonasDichelle
            </a>
            <span>CC BY 3.0 · FBX copy sourced from the public Ylikuutio repository</span>
          </>
        )}
      </div>

      <div className="viewer-3d-hint">
        {loadState==='ready' && (
          <strong>
            {animal.phenotype.furDensityPerSqIn.toLocaleString()} hairs/in² biological coat · {guideCount.toLocaleString()} spring-simulated guide hairs → {furCount.toLocaleString()} individual 3D follower hairs ·{' '}
          </strong>
        )}
        {loadState==='ready'
          ? isFox
          ? `Viewing ${animal.name} · fox phenotype + physical guide-strand fur + semi-random wind gusts`
          : `Viewing ${animal.name} · cat phenotype + breathing, blinking + physical fur + semi-random wind gusts`
          : loadState==='error'
            ? `The external ${speciesLabel} model could not be loaded. Try refreshing or opening the site again.`
            : `Loading the ${speciesLabel} model…`}
      </div>
    </div>
  )
}
