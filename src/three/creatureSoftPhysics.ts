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

interface WindGust {
  start:number
  duration:number
  strength:number
  direction:THREE.Vector3
  turbulence:number
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

  // Semi-random automatic wind. Each creature gets a deterministic random
  // stream from its seed, but individual gust timing/strength/direction varies
  // continuously while the viewer is open.
  let gust:WindGust|null=null
  let nextGustAt=.8+rng()*2.8
  const gustVector=new THREE.Vector3()
  const ambientWind=new THREE.Vector3()

  const scheduleNextGust=(time:number)=>{
    // Calm gaps are intentionally irregular. Occasionally gusts arrive close
    // together, but most have a few seconds of quiet between them.
    const clustered=rng()<.18
    nextGustAt=time+(clustered ? .65+rng()*1.5 : 2.2+rng()*5.8)
  }

  const beginGust=(time:number)=>{
    const roll=rng()
    // Weighted strengths: mostly gentle/moderate, with occasional stronger gusts.
    const strength=
      roll<.58 ? .018+rng()*.027 :
      roll<.90 ? .045+rng()*.040 :
                 .085+rng()*.055

    const angle=rng()*Math.PI*2
    const vertical=(rng()-.5)*.10
    gust={
      start:time,
      duration:1.0+rng()*3.6,
      strength,
      direction:new THREE.Vector3(
        Math.cos(angle),
        vertical,
        Math.sin(angle),
      ).normalize(),
      turbulence:.20+rng()*.55,
    }
  }

  const smooth01=(v:number)=>{
    const x=Math.max(0,Math.min(1,v))
    return x*x*(3-2*x)
  }

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

      // Quiet ambient air keeps the coat from looking frozen between gusts.
      ambientWind.set(
        Math.sin(time*.31+phase)*.0045,
        -.0015-Math.abs(Math.sin(time*.23+phase))*.0012,
        Math.cos(time*.27+phase*.73)*.0040,
      )

      if (!gust && time>=nextGustAt) beginGust(time)

      gustVector.set(0,0,0)
      if (gust) {
        const age=time-gust.start
        const progress=age/gust.duration

        if (progress>=1) {
          gust=null
          scheduleNextGust(time)
        } else {
          // Smooth attack/release envelope, with a small irregular pulse riding
          // on top so gusts do not feel like identical bell curves.
          const attack=smooth01(Math.min(1,progress/.22))
          const release=smooth01(Math.min(1,(1-progress)/.30))
          const envelope=Math.min(attack,release)
          const pulse=
            1+
            Math.sin(age*(5.1+gust.turbulence*4.5)+phase)*(.10*gust.turbulence)+
            Math.sin(age*(10.7+gust.turbulence*5.0)+phase*.41)*(.055*gust.turbulence)

          gustVector
            .copy(gust.direction)
            .multiplyScalar(gust.strength*envelope*Math.max(.70,pulse))

          // Mild crosswind turbulence changes the exact bend during the gust.
          gustVector.x+=Math.sin(age*7.3+phase)*gust.strength*.16*gust.turbulence*envelope
          gustVector.z+=Math.cos(age*6.1+phase*.63)*gust.strength*.14*gust.turbulence*envelope
        }
      }

      target.copy(ambientWind).add(gustVector)
      target.addScaledVector(motion,-.18)

      // Expose the active gust for diagnostics/UI without putting React state
      // in the per-frame physics loop.
      root.userData.windGustStrength=gustVector.length()
      root.userData.windGustActive=Boolean(gust && gustVector.length()>.003)

      forceVelocity.addScaledVector(target.clone().sub(force),18*dt)
      forceVelocity.multiplyScalar(Math.exp(-5.2*dt))
      force.addScaledVector(forceVelocity,dt)

      updateRealFurPhysics(root,time,force,dt)

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
