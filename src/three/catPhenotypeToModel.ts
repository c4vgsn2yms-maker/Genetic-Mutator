import type { GenePair, Individual } from '../types'

export interface CatModelParams {
  overallScale: number
  bodyLength: number
  bodyHeight: number
  bodyWidth: number
  chestScale: number
  haunchScale: number
  legLength: number
  limbThickness: number
  pawScale: number
  skullScale: number
  muzzleScale: number
  earScale: number
  neckScale: number
  tailScale: number
  boneMass: number
  muscleMass: number
  chestWidth: number
  pelvisWidth: number
}

const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v))
const avg = (pair: GenePair) => (pair[0]+pair[1])/2

export function phenotypeToCatModel(animal: Individual): CatModelParams {
  const p = animal.phenotype
  const boneMass = clamp(avg(animal.genome.boneMass),0,1)
  const muscleMass = clamp(avg(animal.genome.muscleMass),0,1)
  const typicalWeight = Math.max(2.5, (p.bodyLengthCm / 55) * 5.5)
  const massRatio = Math.max(.2, p.weightKg / typicalWeight)

  // These are renderer guards only. They prevent impossible GPU geometry;
  // they do not cap the genetic values stored by the simulator.
  const overallScale = clamp(.82 + Math.log2(Math.max(.3,p.shoulderCm / 30)) * .30,.58,2.8)
  const bodyLength = clamp(2.45 * Math.sqrt(Math.max(.35,p.bodyLengthCm / 58)),1.75,4.25)
  const bodyHeight = clamp(.70 * Math.pow(massRatio,.18) * (.94+muscleMass*.12),.50,1.20)
  const bodyWidth = clamp(.63 * Math.pow(massRatio,.20) * (.92+boneMass*.10+muscleMass*.10),.46,1.25)
  const legLength = clamp(1.10 * (p.legRatio / .60) * Math.sqrt(Math.max(.4,p.shoulderCm / 30)),.68,1.85)
  const limbThickness = clamp(.78 + boneMass*.28 + muscleMass*.20,.78,1.28)

  return {
    overallScale,
    bodyLength,
    bodyHeight,
    bodyWidth,
    chestScale: clamp(.88 + massRatio*.08 + muscleMass*.16 + boneMass*.05,.88,1.34),
    haunchScale: clamp(.88 + massRatio*.07 + muscleMass*.19 + boneMass*.04,.88,1.34),
    legLength,
    limbThickness,
    pawScale: clamp(.80 + Math.sqrt(massRatio)*.08 + boneMass*.22,.82,1.38),
    skullScale: clamp(p.skullWidth * (.94+boneMass*.09),.76,1.45),
    muzzleScale: clamp(p.muzzleLength,.68,1.34),
    earScale: clamp(1.08 - p.furLength*.10 - boneMass*.035,.86,1.14),
    neckScale: clamp(.84 + massRatio*.08 + muscleMass*.24,.84,1.38),
    tailScale: clamp((p.tailLengthCm / Math.max(1,p.bodyLengthCm)) / .68,.58,1.72),
    boneMass,
    muscleMass,
    chestWidth: clamp(.90 + boneMass*.08 + muscleMass*.11,.90,1.20),
    pelvisWidth: clamp(.91 + boneMass*.10 + muscleMass*.08,.90,1.19),
  }
}
