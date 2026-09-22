import * as THREE from 'three'

type LifeBone = {
  bone:THREE.Bone
  baseQuaternion:THREE.Quaternion
  animated:boolean
}

type BlinkCover = {
  object:THREE.Object3D
  baseScale:THREE.Vector3
}

export interface CatLifeController {
  update:(delta:number)=>void
}

function makeRng(seed:number) {
  let state=(seed>>>0) || 0x12345678
  return ()=>{
    state+=0x6D2B79F5
    let t=state
    t=Math.imul(t^(t>>>15),t|1)
    t^=t+Math.imul(t^(t>>>7),t|61)
    return ((t^(t>>>14))>>>0)/4294967296
  }
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

function trackNodeName(trackName:string) {
  const dot=trackName.indexOf('.')
  return dot>=0 ? trackName.slice(0,dot) : trackName
}

export function createCatLifeController(
  root:THREE.Group,
  clips:THREE.AnimationClip[],
  seed:number,
):CatLifeController {
  const rng=makeRng(seed ^ 0x51f15e)
  const animatedNames=new Set<string>()
  for (const clip of clips) {
    for (const track of clip.tracks) animatedNames.add(trackNodeName(track.name))
  }

  const allBones:THREE.Bone[]=[]
  const blinkCovers:BlinkCover[]=[]
  root.traverse(object=>{
    const bone=object as THREE.Bone
    if (bone.isBone) allBones.push(bone)
    if (object.userData.generatedEyelid) {
      blinkCovers.push({
        object,
        baseScale:object.scale.clone(),
      })
    }
  })

  const findBest=(patterns:RegExp[])=>{
    let best:THREE.Bone|null=null
    let score=-1
    for (const bone of allBones) {
      const name=bone.name.toLowerCase()
      for (let i=0;i<patterns.length;i++) {
        if (patterns[i].test(name)) {
          const candidate=patterns.length-i
          if (candidate>score) {
            score=candidate
            best=bone
          }
          break
        }
      }
    }
    return best
  }

  const wrap=(bone:THREE.Bone|null):LifeBone|null=>bone ? {
    bone,
    baseQuaternion:bone.quaternion.clone(),
    animated:animatedNames.has(bone.name),
  } : null

  const head=wrap(findBest([/head/,/skull/,/cranium/]))
  const neck=wrap(findBest([/^neck/i,/neck/,/cerv/]))

  const tail=allBones
    .filter(b=>/tail|caudal/i.test(b.name))
    .sort((a,b)=>depth(a)-depth(b))
    .map(b=>wrap(b)!)
    .slice(0,14)

  const ears=allBones
    .filter(b=>/ear|auricle|pinna/i.test(b.name))
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(b=>wrap(b)!)
    .slice(0,4)

  const spine=allBones
    .filter(b=>/spine|chest|thorax/i.test(b.name))
    .sort((a,b)=>depth(a)-depth(b))
    .map(b=>wrap(b)!)
    .slice(0,5)

  const rootBasePosition=root.position.clone()
  const rootBaseRotation=root.rotation.clone()
  const rootBaseScale=root.scale.clone()

  let elapsed=0
  const phase=rng()*Math.PI*2

  let headYaw=0
  let headPitch=0
  let targetHeadYaw=(rng()-.5)*.08
  let targetHeadPitch=(rng()-.5)*.035
  let nextLook=1.2+rng()*2.4

  let nextBlink=.8+rng()*2.8
  let blinkStart=-10
  let blinkDuration=.12
  let doubleBlink=false

  let nextEarFlick=1.0+rng()*3.0
  let earFlickStart=-10
  let earFlickDuration=.18
  let earFlickIndex=0

  const q=new THREE.Quaternion()
  const euler=new THREE.Euler()

  const applyDelta=(target:LifeBone|null,x:number,y:number,z:number)=>{
    if (!target) return
    euler.set(x,y,z,'XYZ')
    q.setFromEuler(euler)
    if (target.animated) {
      // The AnimationMixer refreshed this bone immediately before the life
      // layer runs, so this is a small additive motion over the authored pose.
      target.bone.quaternion.multiply(q)
    } else {
      target.bone.quaternion.copy(target.baseQuaternion).multiply(q)
    }
  }

  const blinkPulse=(now:number)=>{
    const since=now-blinkStart
    const one=(offset:number)=>{
      const x=(since-offset)/blinkDuration
      if (x<0 || x>1) return 0
      return Math.sin(Math.PI*x)
    }
    return Math.max(one(0),doubleBlink?one(.20):0)
  }

  return {
    update(delta:number) {
      const dt=Math.min(.05,Math.max(0,delta))
      elapsed+=dt

      if (elapsed>=nextLook) {
        targetHeadYaw=(rng()-.5)*.18
        targetHeadPitch=(rng()-.5)*.075
        nextLook=elapsed+1.6+rng()*3.3
      }

      const lookEase=Math.min(1,dt*1.25)
      headYaw+= (targetHeadYaw-headYaw)*lookEase
      headPitch+=(targetHeadPitch-headPitch)*lookEase

      if (elapsed>=nextBlink) {
        blinkStart=elapsed
        blinkDuration=.105+rng()*.045
        doubleBlink=rng()<.20
        nextBlink=elapsed+2.2+rng()*4.4
      }

      if (elapsed>=nextEarFlick) {
        earFlickStart=elapsed
        earFlickDuration=.14+rng()*.10
        earFlickIndex=ears.length ? Math.floor(rng()*ears.length) : 0
        nextEarFlick=elapsed+1.8+rng()*4.2
      }

      const breath=Math.sin(elapsed*(Math.PI*2/3.7)+phase)
      const slowShift=Math.sin(elapsed*.55+phase*.71)
      root.position.copy(rootBasePosition)
      root.position.y+=breath*.0045
      root.rotation.copy(rootBaseRotation)
      root.rotation.z+=slowShift*.0045
      root.scale.copy(rootBaseScale)
      root.scale.y*=1+breath*.0028

      // Head/neck attention drift: subtle enough to read as awareness rather
      // than a looping animation.
      applyDelta(neck,headPitch*.28,headYaw*.35,slowShift*.003)
      applyDelta(head,headPitch,headYaw,Math.sin(elapsed*.43+phase)*.006)

      // Breathing is mostly visible through the torso, with a tiny spinal
      // articulation rather than exaggerated whole-body scaling.
      spine.forEach((segment,index)=>{
        const influence=(index+1)/Math.max(1,spine.length)
        applyDelta(segment,breath*.0045*influence,0,slowShift*.0015*influence)
      })

      // Tail bones receive a low-frequency travelling wave plus a tiny
      // independent tip twitch. Later segments move more than the base.
      tail.forEach((segment,index)=>{
        const t=index/Math.max(1,tail.length-1)
        const sway=Math.sin(elapsed*.92+phase+index*.36)*(.018+.050*t)
        const lift=Math.sin(elapsed*.57+phase*.8+index*.24)*(.008+.020*t)
        const tip=Math.sin(elapsed*2.35+phase+index*.53)*(.003+.008*t*t)
        applyDelta(segment,lift,sway,tip)
      })

      // Ear flicks are event-like rather than a constant repetitive wiggle.
      ears.forEach((ear,index)=>{
        const since=elapsed-earFlickStart
        const x=since/earFlickDuration
        const pulse=index===earFlickIndex && x>=0 && x<=1 ? Math.sin(Math.PI*x) : 0
        const side=/left|\.l|_l|l_/i.test(ear.bone.name)?-1:/right|\.r|_r|r_/i.test(ear.bone.name)?1:(index%2?1:-1)
        const micro=Math.sin(elapsed*1.35+phase+index*1.7)*.004
        applyDelta(ear,micro,pulse*.075,pulse*.105*side)
      })

      const blink=blinkPulse(elapsed)
      for (const cover of blinkCovers) {
        cover.object.visible=blink>.015
        cover.object.scale.copy(cover.baseScale)
        cover.object.scale.y*=Math.max(.03,blink)
      }
    },
  }
}
