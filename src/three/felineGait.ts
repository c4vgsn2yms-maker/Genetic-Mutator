export type FelineGait = 'idle' | 'walk' | 'trot' | 'run' | 'rest'

export interface LimbPose {
  upper: number
  lower: number
  pastern: number
  paw: number
  lift: number
  shoulder: number
}

const TAU=Math.PI*2

function phaseOffset(gait:FelineGait,side:1|-1,hind:boolean) {
  if (gait==='trot') {
    return (side===1 && !hind) || (side===-1 && hind) ? 0 : .5
  }
  if (gait==='run') {
    if (hind) return side===1 ? 0 : .10
    return side===1 ? .53 : .61
  }
  if (hind) return side===1 ? .18 : .68
  return side===1 ? .43 : .93
}

export function gaitRate(gait:FelineGait,legLength:number,bodyLength:number) {
  if (gait==='idle' || gait==='rest') return .55
  const sizeFactor=Math.max(.68,Math.min(1.25,1.05/Math.sqrt(Math.max(.45,legLength))))
  const bodyFactor=Math.max(.82,Math.min(1.15,2.5/Math.max(1.7,bodyLength)))
  const base=gait==='walk'?1.15:gait==='trot'?1.85:2.65
  return base*sizeFactor*bodyFactor
}

export function limbPose(
  gait:FelineGait,
  elapsed:number,
  side:1|-1,
  hind:boolean,
  legLength:number,
  bodyLength:number,
):LimbPose {
  if (gait==='rest') {
    const breathe=Math.sin(elapsed*.82+(hind?.8:0)+(side===1?0:.5))
    return {
      upper:hind?-.74:-.47,
      lower:hind?1.02:.88,
      pastern:hind?-.55:-.34,
      paw:hind?.18:.12,
      lift:-.38 + breathe*.004,
      shoulder:hind?-.10:.08,
    }
  }

  if (gait==='idle') {
    const settle=Math.sin(elapsed*.75+(hind?1.1:0)+(side===1?0:.8))
    return {
      upper:(hind?-.16:.06)+settle*.012,
      lower:(hind?.25:-.04)-settle*.008,
      pastern:hind?-.12:.025,
      paw:0,
      lift:Math.max(0,settle)*.008,
      shoulder:settle*.008,
    }
  }

  const rate=gaitRate(gait,legLength,bodyLength)
  const phase=(elapsed*rate+phaseOffset(gait,side,hind))%1
  const wave=Math.sin(phase*TAU)
  const forward=Math.cos(phase*TAU)
  const swingLift=Math.pow(Math.max(0,wave),1.65)
  const amp=gait==='walk'?.22:gait==='trot'?.34:.47

  const upperBase=hind?-.18:.06
  const lowerBase=hind?.25:-.04
  const upper=upperBase+forward*amp*(hind?.95:1)
  const lower=lowerBase+swingLift*(gait==='run'?.62:gait==='trot'?.48:.34)-(1-swingLift)*amp*.16
  const pastern=(hind?-.12:.025)-swingLift*(hind?.28:.18)
  const paw=-upper*.18-lower*.08

  return {
    upper,
    lower,
    pastern,
    paw,
    lift:swingLift*(gait==='run'?.19:gait==='trot'?.12:.075),
    shoulder:forward*amp*.10,
  }
}

export function bodyLocomotion(gait:FelineGait,elapsed:number,legLength:number,bodyLength:number) {
  const rate=gaitRate(gait,legLength,bodyLength)
  if (gait==='rest') {
    return {bob:-.46+Math.sin(elapsed*.82)*.008,pitch:-.035,roll:.055}
  }
  if (gait==='idle') {
    return {bob:Math.sin(elapsed*1.45)*.006,pitch:0,roll:Math.sin(elapsed*.7)*.004}
  }
  const stride=elapsed*rate*TAU
  const strength=gait==='walk'?.012:gait==='trot'?.026:.045
  return {
    bob:Math.abs(Math.sin(stride))*strength,
    pitch:Math.sin(stride)*strength*.36,
    roll:Math.sin(stride*.5)*strength*.26,
  }
}
