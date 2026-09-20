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

  const bones=[pelvis,spine,chest,neck,head]
  const skeleton=new THREE.Skeleton(bones)
  return {bones,skeleton,pelvis,spine,chest,neck,head}
}

export function animateFelineRig(rig:FelineRig,elapsed:number,seed:number) {
  const phase=(seed%997)/997*Math.PI*2
  const breath=Math.sin(elapsed*1.45+phase)
  const watch=Math.sin(elapsed*.42+phase*.7)
  const settle=Math.sin(elapsed*.68+phase)*.5+.5

  rig.spine.rotation.z=breath*.005
  rig.chest.rotation.z=-breath*.007
  rig.neck.rotation.z=breath*.009 + watch*.006
  rig.neck.rotation.y=watch*.014
  rig.head.rotation.z=-breath*.006
  rig.head.rotation.y=watch*.018
  rig.pelvis.rotation.z=(settle-.5)*.004
}
