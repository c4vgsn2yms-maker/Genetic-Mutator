import type { CatModelParams } from './catPhenotypeToModel'

export type CatAgeStage = 'kitten' | 'juvenile' | 'adult' | 'senior'

export function applyAgeMorph(model: CatModelParams, stage: CatAgeStage): CatModelParams {
  if (stage==='adult') return model

  if (stage==='kitten') {
    return {
      ...model,
      overallScale:model.overallScale*.62,
      bodyLength:model.bodyLength*.72,
      bodyHeight:model.bodyHeight*.78,
      bodyWidth:model.bodyWidth*.86,
      chestScale:model.chestScale*.86,
      chestDepth:model.chestDepth*.88,
      abdomenScale:model.abdomenScale*.96,
      waistScale:model.waistScale*.95,
      haunchScale:model.haunchScale*.83,
      rumpLift:model.rumpLift*.58,
      legLength:model.legLength*.74,
      limbThickness:model.limbThickness*.88,
      pawScale:model.pawScale*1.10,
      skullScale:model.skullScale*1.17,
      headLength:model.headLength*.96,
      muzzleScale:model.muzzleScale*.72,
      cheekScale:model.cheekScale*.96,
      earScale:model.earScale*1.12,
      neckScale:model.neckScale*.76,
      tailScale:model.tailScale*.84,
      tailThickness:model.tailThickness*.86,
      chestWidth:model.chestWidth*.88,
      pelvisWidth:model.pelvisWidth*.84,
      furInflation:model.furInflation*.86,
      bodyCondition:model.bodyCondition*.96,
    }
  }

  if (stage==='juvenile') {
    return {
      ...model,
      overallScale:model.overallScale*.82,
      bodyLength:model.bodyLength*.88,
      bodyHeight:model.bodyHeight*.92,
      bodyWidth:model.bodyWidth*.93,
      chestScale:model.chestScale*.92,
      chestDepth:model.chestDepth*.94,
      abdomenScale:model.abdomenScale*.98,
      waistScale:model.waistScale*.97,
      haunchScale:model.haunchScale*.92,
      rumpLift:model.rumpLift*.78,
      legLength:model.legLength*.94,
      limbThickness:model.limbThickness*.94,
      pawScale:model.pawScale*1.04,
      skullScale:model.skullScale*1.08,
      headLength:model.headLength*.98,
      muzzleScale:model.muzzleScale*.88,
      cheekScale:model.cheekScale*.98,
      earScale:model.earScale*1.06,
      neckScale:model.neckScale*.88,
      tailScale:model.tailScale*.95,
      tailThickness:model.tailThickness*.93,
      chestWidth:model.chestWidth*.94,
      pelvisWidth:model.pelvisWidth*.92,
      furInflation:model.furInflation*.93,
      bodyCondition:model.bodyCondition*.98,
    }
  }

  return {
    ...model,
    overallScale:model.overallScale*.98,
    bodyLength:model.bodyLength*.98,
    bodyHeight:model.bodyHeight*.96,
    bodyWidth:model.bodyWidth*1.03,
    chestScale:model.chestScale*.95,
    chestDepth:model.chestDepth*.96,
    abdomenScale:model.abdomenScale*1.05,
    waistScale:model.waistScale*1.03,
    haunchScale:model.haunchScale*.94,
    rumpLift:model.rumpLift*.75,
    legLength:model.legLength*.96,
    limbThickness:model.limbThickness*.95,
    pawScale:model.pawScale,
    skullScale:model.skullScale*1.01,
    headLength:model.headLength,
    muzzleScale:model.muzzleScale*.98,
    cheekScale:model.cheekScale*.98,
    earScale:model.earScale*.98,
    neckScale:model.neckScale*.92,
    tailScale:model.tailScale*.97,
    tailThickness:model.tailThickness*.96,
    chestWidth:model.chestWidth*.98,
    pelvisWidth:model.pelvisWidth*.98,
    furInflation:model.furInflation*1.03,
    bodyCondition:model.bodyCondition*1.03,
  }
}
