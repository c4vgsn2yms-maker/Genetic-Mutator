import * as THREE from 'three'
import type { CatModelParams } from './catPhenotypeToModel'
import { felineLandmarks } from './felineGeometry'

export interface FelineRig {
  bones: THREE.Bone[]
  skeleton: THREE.Skeleton
  pelvis: THREE.Bone
  spine: THREE.Bone
  chest: THREE.Bone
  neck: THREE.Bone
  head: THREE.Bone
  jaw: THREE.Bone
  leftEar: THREE.Bone
  rightEar: THREE.Bone
  tailBase: THREE.Bone
  leftScapula: THREE.Bone
  rightScapula: THREE.Bone
}

export function createFelineRig(model: CatModelParams): FelineRig {
  const {bodyY,shoulderX,hipX,headX,headY}=felineLandmarks(model)
  const spineX=-model.bodyLength*.08
  const neckX=model.bodyLength*.50

  const pelvis=new THREE.Bone()
  pelvis.name='pelvis'
  pelvis.position.set(hipX,bodyY,0)

  const spine=new THREE.Bone()
  spine.name='spine'
  spine.position.set(spineX-hipX,0,0)
  pelvis.add(spine)

  const chest=new THREE.Bone()
  chest.name='chest'
  chest.position.set(shoulderX-spineX,.08,0)
  spine.add(chest)

  const neck=new THREE.Bone()
  neck.name='neck'
  neck.position.set(neckX-shoulderX,.13,0)
  chest.add(neck)

  const head=new THREE.Bone()
  head.name='head'
  head.position.set(headX-neckX,headY-(bodyY+.21),0)
  neck.add(head)

  const jaw=new THREE.Bone()
  jaw.name='jaw'
  jaw.position.set(.28,-.19,0)
  head.add(jaw)

  const leftEar=new THREE.Bone()
  leftEar.name='ear.L'
  leftEar.position.set(-.03,.36,.28*model.skullScale)
  head.add(leftEar)

  const rightEar=new THREE.Bone()
  rightEar.name='ear.R'
  rightEar.position.set(-.03,.36,-.28*model.skullScale)
  head.add(rightEar)

  const tailBase=new THREE.Bone()
  tailBase.name='tail.00'
  tailBase.position.set(-model.bodyLength*.25,.12,0)
  pelvis.add(tailBase)

  const leftScapula=new THREE.Bone()
  leftScapula.name='scapula.L'
  leftScapula.position.set(.03,.34,model.bodyWidth*.46)
  chest.add(leftScapula)

  const rightScapula=new THREE.Bone()
  rightScapula.name='scapula.R'
  rightScapula.position.set(.03,.34,-model.bodyWidth*.46)
  chest.add(rightScapula)

  const bones=[
    pelvis,spine,chest,neck,head,
    jaw,leftEar,rightEar,tailBase,leftScapula,rightScapula,
  ]
  const skeleton=new THREE.Skeleton(bones)
  return {bones,skeleton,pelvis,spine,chest,neck,head,jaw,leftEar,rightEar,tailBase,leftScapula,rightScapula}
}

export function animateFelineRig(rig:FelineRig,elapsed:number,seed:number,rest=false) {
  const phase=(seed%997)/997*Math.PI*2
  const breath=Math.sin(elapsed*(rest?.82:1.45)+phase)
  const watch=Math.sin(elapsed*(rest?.22:.42)+phase*.7)
  const settle=Math.sin(elapsed*.68+phase)*.5+.5

  rig.spine.rotation.z=breath*(rest?.010:.005)
  rig.chest.rotation.z=-breath*(rest?.012:.007)
  rig.neck.rotation.z=breath*(rest?.007:.009) + watch*(rest?.002:.006)
  rig.neck.rotation.y=watch*(rest?.004:.014)
  rig.head.rotation.z=-breath*(rest?.004:.006)
  rig.head.rotation.y=watch*(rest?.005:.018)
  rig.pelvis.rotation.z=(settle-.5)*(rest?.002:.004)
  rig.jaw.rotation.z=Math.max(0,Math.sin(elapsed*.31+phase)-.96)*.10
  rig.leftEar.rotation.x=Math.sin(elapsed*.53+phase)*.025
  rig.rightEar.rotation.x=Math.sin(elapsed*.47+phase+.8)*.025
  rig.tailBase.rotation.y=Math.sin(elapsed*.36+phase)*.025
  rig.leftScapula.rotation.z=Math.sin(elapsed*.72+phase)*.012
  rig.rightScapula.rotation.z=-Math.sin(elapsed*.72+phase)*.012
}
