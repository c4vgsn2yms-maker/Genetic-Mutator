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
  const p = animal.phenotype
  const boneMass = clamp(avg(animal.genome.boneMass),0,1)
  const muscleMass = clamp(avg(animal.genome.muscleMass),0,1)
  const furGene = clamp(p.furLength,0,1)

  // Expected mass uses structural length and height so a heavy, short cat
  // looks stockier while a similarly heavy long/tall cat stays athletic.
  const sizeVolume = Math.max(.45,(p.bodyLengthCm/58) * Math.pow(p.shoulderCm/30,.72))
  const expectedWeight = Math.max(2.8,5.6*sizeVolume)
  const massRatio = clamp(p.weightKg/expectedWeight,.45,2.2)
  const bodyCondition = clamp(.92+(massRatio-1)*.34,.72,1.30)

  // Renderer guards preserve a feline silhouette even when the simulator
  // produces extreme genetics. They do not alter the stored genome.
  const overallScale = clamp(.84 + Math.log2(Math.max(.35,p.shoulderCm / 30)) * .27,.60,2.75)
  const bodyLength = clamp(2.50 * Math.sqrt(Math.max(.38,p.bodyLengthCm / 58)),1.82,4.20)
  const bodyHeight = clamp(.66 * Math.pow(massRatio,.14) * (.95+muscleMass*.11),.50,1.08)
  const bodyWidth = clamp(.58 * Math.pow(massRatio,.16) * (.94+boneMass*.08+muscleMass*.08),.43,1.12)
  const legLength = clamp(1.12 * (p.legRatio / .60) * Math.sqrt(Math.max(.42,p.shoulderCm / 30)),.70,1.82)
  const limbThickness = clamp(.76 + boneMass*.25 + muscleMass*.18 + (bodyCondition-.92)*.12,.76,1.26)
  const furInflation = clamp(furGene*.16,0,.16)

  return {
    overallScale,
    bodyLength,
    bodyHeight,
    bodyWidth,
    chestScale: clamp(.93 + muscleMass*.16 + boneMass*.04 + (bodyCondition-.92)*.08,.92,1.28),
    chestDepth: clamp(.97 + muscleMass*.12 + (bodyCondition-.92)*.07,.94,1.22),
    abdomenScale: clamp(.82 + bodyCondition*.16,.90,1.08),
    waistScale: clamp(.73 + bodyCondition*.14 + boneMass*.035,.80,1.00),
    haunchScale: clamp(.94 + muscleMass*.20 + boneMass*.04 + (bodyCondition-.92)*.05,.94,1.30),
    rumpLift: clamp(.035 + muscleMass*.055,.035,.09),
    legLength,
    limbThickness,
    pawScale: clamp(.82 + boneMass*.22 + Math.sqrt(massRatio)*.06,.84,1.34),
    skullScale: clamp(p.skullWidth * (.94+boneMass*.08),.78,1.42),
    headLength: clamp(.92 + avg(animal.genome.skullWidth)*.08 + avg(animal.genome.muzzleLength)*.04,.92,1.06),
    muzzleScale: clamp(p.muzzleLength,.70,1.30),
    cheekScale: clamp(.92 + boneMass*.10 + muscleMass*.05,.92,1.08),
    earScale: clamp(1.08 - furGene*.07 - boneMass*.025,.88,1.14),
    neckScale: clamp(.86 + muscleMass*.24 + (bodyCondition-.92)*.08,.86,1.34),
    tailScale: clamp((p.tailLengthCm / Math.max(1,p.bodyLengthCm)) / .68,.60,1.68),
    tailThickness: clamp(.92 + boneMass*.08 + furGene*.20,.92,1.20),
    boneMass,
    muscleMass,
    chestWidth: clamp(.93 + boneMass*.07 + muscleMass*.10,.93,1.16),
    pelvisWidth: clamp(.94 + boneMass*.09 + muscleMass*.07,.94,1.16),
    furInflation,
    bodyCondition,
  }
}
