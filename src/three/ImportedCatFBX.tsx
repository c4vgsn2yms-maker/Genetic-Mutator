import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Group, Material, Mesh, MeshStandardMaterial } from 'three'
import type { Individual } from '../types'
import { coatRoughness, createCoatTexture, resolveVisibleAppearance } from './catMaterial'

const CAT_FBX_URL =
  'https://raw.githubusercontent.com/nrz/ylikuutio/adcb264480542b2a6ca16cedbd1afecc605cb2d6/res/objects/www.blendswap.com/86110_rigged_and_animated_cat/cat.fbx'

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const avg=(pair:[number,number])=>(pair[0]+pair[1])/2

function cloneMaterial(material:Material):Material {
  return material.clone()
}

function attachVisibleEyes(root:Group,eyeColor:string) {
  let headBone:THREE.Bone|null=null
  let bestScore=-1

  root.traverse(object=>{
    const bone=object as THREE.Bone
    if (!bone.isBone) return
    const name=bone.name.toLowerCase()
    const score=/head/.test(name)?4:/skull/.test(name)?3:/cranium/.test(name)?2:-1
    if (score>bestScore) {
      bestScore=score
      headBone=bone
    }
  })

  if (!headBone) return

  root.updateMatrixWorld(true)
  const box=new THREE.Box3().setFromObject(root)
  const size=box.getSize(new THREE.Vector3())
  const center=box.getCenter(new THREE.Vector3())
  const headWorld=(headBone as THREE.Bone).getWorldPosition(new THREE.Vector3())

  const forward=headWorld.clone().sub(center)
  forward.y=0
  if (forward.lengthSq()<1e-5) forward.set(1,0,0)
  forward.normalize()

  const up=new THREE.Vector3(0,1,0)
  const lateral=new THREE.Vector3().crossVectors(up,forward).normalize()
  const height=Math.max(.5,size.y)
  // Mobile screenshots showed the generated globes sitting too deeply in
  // the sockets. Move them slightly forward/up/outward and enlarge them just
  // enough to read clearly without turning them cartoonishly oversized.
  const eyeRadius=clamp(height*.035,.040,.078)
  const eyeForward=height*.092
  const eyeUp=height*.050
  const eyeSide=height*.060

  const rootScale=root.getWorldScale(new THREE.Vector3())
  const scaleFix=Math.max(.0001,(rootScale.x+rootScale.y+rootScale.z)/3)
  const localRadius=eyeRadius/scaleFix

  for (const side of [-1,1]) {
    const worldPos=headWorld.clone()
      .addScaledVector(forward,eyeForward)
      .addScaledVector(up,eyeUp)
      .addScaledVector(lateral,eyeSide*side)

    const localPos=root.worldToLocal(worldPos.clone())
    const localForwardPoint=root.worldToLocal(worldPos.clone().add(forward))
    const localForward=localForwardPoint.sub(localPos).normalize()

    const eyeGroup=new THREE.Group()
    eyeGroup.name=`GeneratedVisibleEye_${side<0?'L':'R'}`
    eyeGroup.userData.generatedEye=true
    eyeGroup.position.copy(localPos)
    eyeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),localForward)
    eyeGroup.scale.setScalar(localRadius)

    const globe=new THREE.Mesh(
      new THREE.SphereGeometry(1,24,16),
      new THREE.MeshStandardMaterial({
        color:new THREE.Color(eyeColor),
        roughness:.18,
        metalness:0,
      }),
    )
    globe.userData.generatedEye=true
    eyeGroup.add(globe)

    const pupil=new THREE.Mesh(
      new THREE.SphereGeometry(.34,18,12),
      new THREE.MeshStandardMaterial({
        color:'#050607',
        roughness:.22,
        metalness:0,
      }),
    )
    pupil.position.set(0,0,.96)
    pupil.scale.set(.54,1,.30)
    pupil.userData.generatedEye=true
    eyeGroup.add(pupil)

    const glint=new THREE.Mesh(
      new THREE.SphereGeometry(.10,12,8),
      new THREE.MeshBasicMaterial({color:'#ffffff'}),
    )
    glint.position.set(.20,.19,1.00)
    glint.userData.generatedEye=true
    eyeGroup.add(glint)

    root.add(eyeGroup)
    root.updateMatrixWorld(true)
    ;(headBone as THREE.Bone).attach(eyeGroup)
  }
}

export function ImportedCatFBX({
  animal,
  onLoadState,
}:{
  animal:Individual
  onLoadState?:(state:'loading'|'ready'|'error')=>void
}) {
  const [source,setSource]=useState<Group|null>(null)
  const [error,setError]=useState<string|null>(null)
  const mixerRef=useRef<THREE.AnimationMixer|null>(null)
  const appearance=useMemo(()=>resolveVisibleAppearance(animal),[
    animal.phenotype.coatHex,
    animal.phenotype.patternHex,
    animal.phenotype.pattern,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
  ])
  const coatTexture=useMemo(()=>createCoatTexture(animal,appearance),[
    animal.id,
    animal.seed,
    animal.phenotype.coatHex,
    animal.phenotype.pattern,
    animal.phenotype.patternDensity,
    animal.phenotype.whiteFraction,
    animal.phenotype.mutationLabels.join('|'),
    appearance,
  ])

  useEffect(()=>{
    let cancelled=false
    setError(null)
    onLoadState?.('loading')
    const loader=new FBXLoader()

    loader.load(
      CAT_FBX_URL,
      object=>{
        if (cancelled) return

        const initialBox=new THREE.Box3().setFromObject(object)
        const size=initialBox.getSize(new THREE.Vector3())
        const center=initialBox.getCenter(new THREE.Vector3())
        const safeHeight=Math.max(.001,size.y)

        // Normalize the authored FBX to a stable cat-sized scene object.
        const baseScale=1.75/safeHeight
        object.scale.setScalar(baseScale)
        object.position.set(
          -center.x*baseScale,
          -initialBox.min.y*baseScale,
          -center.z*baseScale,
        )

        object.traverse(child=>{
          const mesh=child as Mesh
          if (!mesh.isMesh) return
          mesh.castShadow=true
          mesh.receiveShadow=true
          mesh.frustumCulled=false
          if (Array.isArray(mesh.material)) {
            mesh.material=mesh.material.map(cloneMaterial)
          } else if (mesh.material) {
            mesh.material=cloneMaterial(mesh.material)
          }
        })

        setSource(object)
        onLoadState?.('ready')
      },
      undefined,
      err=>{
        if (cancelled) return
        setError(err instanceof Error?err.message:'FBX load failed')
        onLoadState?.('error')
      },
    )

    return ()=>{
      cancelled=true
      mixerRef.current?.stopAllAction()
      mixerRef.current=null
    }
  },[onLoadState])

  const display=useMemo(()=>{
    if (!source) return null
    const clone=SkeletonUtils.clone(source) as Group

    const roughness=coatRoughness(animal)

    const materialRole=(meshName:string,materialName:string)=>{
      const name=`${meshName} ${materialName}`.toLowerCase()
      if (/eye|iris|cornea|pupil/.test(name)) return 'eye'
      if (/nose|snoutskin|muzzle_skin/.test(name)) return 'nose'
      if (/pad|pawpad|toe_pad|footpad/.test(name)) return 'pad'
      if (/inner.?ear|ear.?inner|earskin/.test(name)) return 'ear'
      // Do not classify generic "skin" as exposed skin. Many animal FBX
      // exporters call the entire skinned body material "skin", which would
      // otherwise bypass the inherited coat texture.
      if (/mouth|lip|gum|tongue/.test(name)) return 'skin'
      return 'coat'
    }

    clone.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return

      const apply=(mat:Material)=>{
        const m=mat as MeshStandardMaterial
        const role=materialRole(mesh.name,m.name || '')
        if ('color' in m && m.color) {
          if (role==='eye') {
            m.color.set(appearance.eyeColor)
            if ('roughness' in m) m.roughness=.18
            if ('metalness' in m) m.metalness=0
          } else if (role==='nose') {
            m.color.set(appearance.noseColor)
            if ('roughness' in m) m.roughness=.38
            if ('metalness' in m) m.metalness=0
          } else if (role==='pad') {
            m.color.set(appearance.pawPadColor)
            if ('roughness' in m) m.roughness=.72
            if ('metalness' in m) m.metalness=0
          } else if (role==='ear') {
            m.color.set(appearance.earInnerColor)
            if ('roughness' in m) m.roughness=.72
            if ('metalness' in m) m.metalness=0
          } else if (role==='skin') {
            m.color.set(appearance.skinColor)
            if ('roughness' in m) m.roughness=.66
            if ('metalness' in m) m.metalness=0
          } else {
            // The imported mesh supplies the anatomy and rig. The generated
            // texture supplies the animal-specific inherited coat phenotype.
            const hasUv=Boolean(mesh.geometry.getAttribute('uv'))
            if ('map' in m) {
              // Never allow the FBX's original brown diffuse map to multiply
              // over leucism/albinism/piebald or any other inherited coat.
              m.map=coatTexture && hasUv ? coatTexture : null
            }
            if ('vertexColors' in m) m.vertexColors=false
            m.color.set(coatTexture && hasUv ? '#ffffff' : appearance.baseCoatColor)
            if ('roughness' in m) m.roughness=roughness
            if ('metalness' in m) m.metalness=0
          }
        }
        m.side=THREE.DoubleSide
        m.needsUpdate=true
      }

      if (Array.isArray(mesh.material)) mesh.material.forEach(apply)
      else if (mesh.material) apply(mesh.material)
    })

    // Some versions of this FBX render the original eyes too dark or too
    // deeply recessed to read. Add glossy, head-bone-attached eyes so every
    // phenotype has clearly visible eyeballs and mutation-aware eye color.
    attachVisibleEyes(clone,appearance.eyeColor)

    return clone
  },[source,animal,coatTexture,appearance])

  useEffect(()=>{
    if (!display) return
    const clips=(source?.animations || []).filter(Boolean)
    if (!clips.length) return

    const mixer=new THREE.AnimationMixer(display)
    mixerRef.current=mixer
    const idle=
      clips.find(c=>/idle|stand|rest/i.test(c.name)) ||
      clips.find(c=>!/walk|run|jump|attack/i.test(c.name)) ||
      clips[0]
    if (idle) mixer.clipAction(idle).reset().fadeIn(.15).play()

    return ()=>{
      mixer.stopAllAction()
      mixer.uncacheRoot(display)
      if (mixerRef.current===mixer) mixerRef.current=null
    }
  },[display,source])

  useFrame((_,delta)=>{
    mixerRef.current?.update(Math.min(delta,.05))
  })

  useEffect(()=>()=>{ coatTexture?.dispose() },[coatTexture])

  useEffect(()=>()=>{
    if (!display) return
    display.traverse(child=>{
      const mesh=child as Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material)) mesh.material.forEach(m=>m.dispose())
      else mesh.material?.dispose()
      if (mesh.userData.generatedEye) mesh.geometry.dispose()
    })
  },[display])

  const geneticsScale=useMemo(()=>{
    const shoulder=clamp(animal.phenotype.shoulderCm/30,.72,1.75)
    const length=clamp(animal.phenotype.bodyLengthCm/58,.72,1.65)
    const mass=clamp(animal.phenotype.weightKg/5.5,.55,3.5)
    const bone=clamp(avg(animal.genome.boneMass),0,1)
    const muscle=clamp(avg(animal.genome.muscleMass),0,1)
    const legGene=clamp(avg(animal.genome.legLength),0,1)
    const fur=clamp(animal.phenotype.furLength,0,1)

    // Keep deformation deliberately subtle so the imported feline anatomy
    // remains intact while still reflecting inherited founder customization.
    const sx=clamp(.94+(length-1)*.30,.82,1.25)
    const sy=clamp((.95+(shoulder-1)*.22)*(.93+(legGene-.5)*.16),.82,1.27)
    const sz=clamp((.94+(Math.pow(mass,.22)-1)*.24+(bone-.5)*.05+(muscle-.5)*.05)*(1+(fur-.5)*.035),.82,1.24)
    return [sx,sy,sz] as [number,number,number]
  },[animal])

  if (error) {
    return (
      <group>
        <mesh position={[0,.9,0]}>
          <boxGeometry args={[1.6,.7,.08]} />
          <meshStandardMaterial color="#553b39" />
        </mesh>
      </group>
    )
  }

  if (!display) return null

  return (
    <group scale={geneticsScale}>
      <primitive object={display} />
    </group>
  )
}
