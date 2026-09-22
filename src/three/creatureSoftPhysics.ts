import * as THREE from 'three'
import { updateRealFurPhysics } from './realFur'

interface SoftBone {
  bone:THREE.Bone
  baseQuaternion:THREE.Quaternion
  animated:boolean
  value:THREE.Vector3
  velocity:THREE.Vector3
  strength:number
  phase:number
}

function makeRng(seed:number) {
  let state=(seed>>>0) || 0x1234abcd
  return ()=>{
    state+=0x6D2B79F5
    let t=state
    t=Math.imul(t^(t>>>15),t|1)
    t^=t+Math.imul(t^(t>>>7),t|61)
    return ((t^(t>>>14))>>>0)/4294967296
  }
}

function trackNodeName(trackName:string) {
  const dot=trackName.indexOf('.')
  return dot>=0?trackName.slice(0,dot):trackName
}

function depth(object:THREE.Object3D) {
  let d=0
  let p=object.parent
  while (p) {
    d++
    p=p.parent
  }
  return d
}

export interface CreatureSoftPhysics {
  update:(delta:number,time:number,motion?:THREE.Vector3)=>void
}

export function createCreatureSoftPhysics(
  root:THREE.Object3D,
  clips:THREE.AnimationClip[],
  seed:number,
):CreatureSoftPhysics {
  const rng=makeRng(seed^0x61c88647)
  const animatedNames=new Set<string>()
  clips.forEach(clip=>clip.tracks.forEach(track=>animatedNames.add(trackNodeName(track.name))))

  const bones:THREE.Bone[]=[]
  root.traverse(object=>{
    const bone=object as THREE.Bone
    if (bone.isBone) bones.push(bone)
  })

  const wrap=(bone:THREE.Bone,strength:number):SoftBone=>({
    bone,
    baseQuaternion:bone.quaternion.clone(),
    animated:animatedNames.has(bone.name),
    value:new THREE.Vector3(),
    velocity:new THREE.Vector3(),
    strength,
    phase:rng()*Math.PI*2,
  })

  const tail=bones
    .filter(b=>/tail|caudal/i.test(b.name))
    .sort((a,b)=>depth(a)-depth(b))
    .slice(0,16)
    .map((bone,index)=>wrap(bone,.32+.045*index))

  const ears=bones
    .filter(b=>/ear|auricle|pinna/i.test(b.name))
    .slice(0,6)
    .map(bone=>wrap(bone,.24))

  const headBones=bones
    .filter(b=>/head|skull|cranium|neck|cerv/i.test(b.name))
    .sort((a,b)=>depth(a)-depth(b))
    .slice(-3)
    .map((bone,index)=>wrap(bone,.06+.02*index))

  const force=new THREE.Vector3()
  const forceVelocity=new THREE.Vector3()
  const target=new THREE.Vector3()
  const q=new THREE.Quaternion()
  const euler=new THREE.Euler()
  const phase=rng()*Math.PI*2

  const integrateBone=(
    item:SoftBone,
    targetRotation:THREE.Vector3,
    dt:number,
    stiffness:number,
    damping:number,
  )=>{
    item.velocity.addScaledVector(
      targetRotation.clone().sub(item.value),
      stiffness*dt,
    )
    item.velocity.multiplyScalar(Math.exp(-damping*dt))
    item.value.addScaledVector(item.velocity,dt)

    if (!item.animated) item.bone.quaternion.copy(item.baseQuaternion)
    euler.set(item.value.x,item.value.y,item.value.z,'XYZ')
    q.setFromEuler(euler)
    item.bone.quaternion.multiply(q)
  }

  return {
    update(delta:number,time:number,motion=new THREE.Vector3()) {
      const dt=Math.min(.05,Math.max(.001,delta))

      // A damped spring makes wind/inertia persist and settle instead of
      // snapping every strand directly to a sine-wave position.
      target.set(
        Math.sin(time*.73+phase)*.021,
        -.010-Math.abs(Math.sin(time*.41+phase))*.004,
        Math.cos(time*.57+phase*.73)*.018,
      )
      target.addScaledVector(motion,-.18)

      forceVelocity.addScaledVector(target.clone().sub(force),18*dt)
      forceVelocity.multiplyScalar(Math.exp(-5.2*dt))
      force.addScaledVector(forceVelocity,dt)

      updateRealFurPhysics(root,time,force)

      tail.forEach((item,index)=>{
        const t=index/Math.max(1,tail.length-1)
        const localTarget=new THREE.Vector3(
          force.z*item.strength*(.35+.65*t),
          force.x*item.strength*(.55+1.4*t),
          Math.sin(time*1.15+item.phase+index*.28)*.012*(.3+t),
        )
        integrateBone(item,localTarget,dt,15-4*t,5.4-1.5*t)
      })

      ears.forEach((item,index)=>{
        const side=/left|\.l|_l|l_/i.test(item.bone.name)?-1:1
        const flutter=Math.sin(time*2.2+item.phase+index)*.008
        const localTarget=new THREE.Vector3(
          force.z*.38+flutter,
          force.x*.48,
          side*(force.x*.62+flutter),
        )
        integrateBone(item,localTarget,dt,28,8.2)
      })

      headBones.forEach((item,index)=>{
        const localTarget=new THREE.Vector3(
          force.z*(.20+.07*index),
          force.x*(.24+.08*index),
          force.x*.08,
        )
        integrateBone(item,localTarget,dt,20,7.6)
      })
    },
  }
}
