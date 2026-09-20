import type { Individual } from '../types'

export interface CatModelParams {
  overallScale: number
  bodyLength: number
  bodyHeight: number
  bodyWidth: number
  chestScale: number
  haunchScale: number
  legLength: number
  pawScale: number
  skullScale: number
  muzzleScale: number
  earScale: number
  neckScale: number
  tailScale: number
}

const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v))

export function phenotypeToCatModel(animal: Individual): CatModelParams {
  const p = animal.phenotype
  const typicalWeight = Math.max(2.5, (p.bodyLengthCm / 55) * 5.5)
  const massRatio = Math.max(.2, p.weightKg / typicalWeight)

  // Rendering guards keep extreme phenotypes drawable without limiting genetics.
  const overallScale = clamp(.82 + Math.log2(Math.max(.3,p.shoulderCm / 30)) * .30,.58,2.8)
  const bodyLength = clamp(2.45 * Math.sqrt(Math.max(.35,p.bodyLengthCm / 58)),1.75,4.25)
  const bodyHeight = clamp(.72 * Math.pow(massRatio,.20),.52,1.15)
  const bodyWidth = clamp(.68 * Math.pow(massRatio,.23),.48,1.20)
  const legLength = clamp(1.10 * (p.legRatio / .60) * Math.sqrt(Math.max(.4,p.shoulderCm / 30)),.68,1.85)

  return {
    overallScale,
    bodyLength,
    bodyHeight,
    bodyWidth,
    chestScale: clamp(.92 + massRatio*.10,.90,1.22),
    haunchScale: clamp(.94 + massRatio*.08,.92,1.20),
    legLength,
    pawScale: clamp(.88 + Math.sqrt(massRatio)*.10,.86,1.28),
    skullScale: clamp(p.skullWidth,.78,1.38),
    muzzleScale: clamp(p.muzzleLength,.68,1.34),
    earScale: clamp(1.06 - p.furLength*.10,.88,1.12),
    neckScale: clamp(.90 + massRatio*.12,.88,1.28),
    tailScale: clamp((p.tailLengthCm / Math.max(1,p.bodyLengthCm)) / .68,.58,1.72),
  }
}
