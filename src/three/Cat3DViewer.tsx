import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Individual } from '../types'
import { ImportedCatFBX } from './ImportedCatFBX'
import { CatEnvironment } from './CatEnvironment'

export function Cat3DViewer({animal}:{animal:Individual}) {
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading')

  return (
    <div className="viewer-3d-shell imported-fbx-live-viewer">
      <div className={`render-status ${loadState==='error'?'unavailable':'active'}`}>
        {loadState==='loading'
          ? '3D BUILD 7.3.1 · loading real FBX cat'
          : loadState==='ready'
            ? '3D BUILD 7.3.1 · rigged FBX cat active'
            : '3D BUILD 7.3.1 · FBX unavailable'}
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
        <directionalLight position={[-3.5,5,-5]} intensity={.58} color="#efe4cf" />

        <CatEnvironment />
        <ImportedCatFBX animal={animal} onLoadState={setLoadState} />
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
        <a href="https://blendswap.com/blend/18519" target="_blank" rel="noreferrer">
          Rigged and animated Cat · JonasDichelle
        </a>
        <span>CC BY 3.0 · FBX copy sourced from the public Ylikuutio repository</span>
      </div>

      <div className="viewer-3d-hint">
        {loadState==='ready'
          ? `Viewing ${animal.name} · imported rigged cat · inherited size/build + mutation coat active`
          : loadState==='error'
            ? 'The external FBX could not be loaded. Try refreshing or opening the site again.'
            : 'Loading the imported cat model…'}
      </div>
    </div>
  )
}
