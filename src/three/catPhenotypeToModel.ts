import type { GenePair, Individual } from '../types'

export interface CatModelParams {
  overallScale: number
  bodyLength: number
  bodyHeight: number
  bodyWidth: number
  chestScale: number
  chestDepth: number
  abdomenScale: number
  waistScale: number
  haunchScale: number
  rumpLift: number
  legLength: number
  limbThickness: number
  pawScale: number
  skullScale: number
  headLength: number
  muzzleScale: number
  cheekScale: number
  earScale: number
  neckScale: number
  tailScale: number
  tailThickness: number
  boneMass: number
  muscleMass: number
  chestWidth: number
  pelvisWidth: number
  furInflation: number
  bodyCondition: number
}

const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v))
const avg = (pair: GenePair) => (pair[0]+pair[1])/2

export function phenotypeToCatModel(animal: Individual): CatModelParams {
  const p=animal.phenotype
  const boneMass=clamp(avg(animal.genome.boneMass),0,1)
  const muscleMass=clamp(avg(animal.genome.muscleMass),0,1)
  const furGene=clamp(p.furLength,0,1)

  const sizeVolume=Math.max(.45,(p.bodyLengthCm/58)*Math.pow(p.shoulderCm/30,.72))
  const expectedWeight=Math.max(2.8,5.6*sizeVolume)
  const massRatio=clamp(p.weightKg/expectedWeight,.45,2.2)
  const bodyCondition=clamp(.94+(massRatio-1)*.28,.76,1.24)

  // Reference-calibrated feline baseline. Genetics are allowed to vary this
  // baseline, but the renderer keeps the result inside recognizably feline
  // proportions instead of scaling every body part independently.
  const overallScale=clamp(.86+Math.log2(Math.max(.35,p.shoulderCm/30))*.25,.62,2.65)
  const bodyLength=clamp(2.34*Math.sqrt(Math.max(.42,p.bodyLengthCm/58)),1.85,3.85)
  const bodyHeight=clamp(.54*Math.pow(massRatio,.12)*(.97+muscleMass*.08),.46,.82)
  const bodyWidth=clamp(.49*Math.pow(massRatio,.14)*(.96+boneMass*.06+muscleMass*.06),.40,.78)
  const legLength=clamp(1.08*(p.legRatio/.60)*Math.sqrt(Math.max(.46,p.shoulderCm/30)),.78,1.55)
  const limbThickness=clamp(.90+boneMass*.22+muscleMass*.18+(bodyCondition-.94)*.10,.88,1.28)
  const furInflation=clamp(furGene*.115,0,.115)

  return {
    overallScale,
    bodyLength,
    bodyHeight,
    bodyWidth,
    chestScale:clamp(.98+muscleMass*.10+boneMass*.025+(bodyCondition-.94)*.05,.96,1.18),
    chestDepth:clamp(.98+muscleMass*.08+(bodyCondition-.94)*.05,.96,1.16),
    abdomenScale:clamp(.88+bodyCondition*.10,.94,1.06),
    waistScale:clamp(.76+bodyCondition*.12+boneMass*.025,.84,.96),
    haunchScale:clamp(.98+muscleMass*.14+boneMass*.03+(bodyCondition-.94)*.04,.98,1.20),
    rumpLift:clamp(.018+muscleMass*.030,.018,.050),
    legLength,
    limbThickness,
    pawScale:clamp(.70+boneMass*.13+Math.sqrt(massRatio)*.035,.72,1.02),
    skullScale:clamp(.88+(p.skullWidth-1)*.58+boneMass*.035,.78,1.18),
    headLength:clamp(.90+avg(animal.genome.muzzleLength)*.035+avg(animal.genome.skullWidth)*.025,.90,.98),
    muzzleScale:clamp(.78+(p.muzzleLength-1)*.48,.68,1.05),
    cheekScale:clamp(.96+boneMass*.06+muscleMass*.035,.96,1.06),
    earScale:clamp(.92-furGene*.035-boneMass*.015,.80,1.02),
    neckScale:clamp(.90+muscleMass*.16+(bodyCondition-.94)*.05,.88,1.16),
    tailScale:clamp((p.tailLengthCm/Math.max(1,p.bodyLengthCm))/.68,.65,1.52),
    tailThickness:clamp(.96+boneMass*.06+furGene*.14,.94,1.15),
    boneMass,
    muscleMass,
    chestWidth:clamp(.98+boneMass*.05+muscleMass*.07,.98,1.12),
    pelvisWidth:clamp(.97+boneMass*.06+muscleMass*.05,.97,1.12),
    furInflation,
    bodyCondition,
  }
}
