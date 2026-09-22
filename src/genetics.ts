import type {
  CoatPattern,
  EarShape,
  EnvironmentSettings,
  GenePair,
  Genome,
  Individual,
  MutationKey,
  Phenotype,
  Sex,
  Species,
} from './types'

const LOCI: (keyof Genome)[] = [
  'sizePotential','growthDuration','boneMass','muscleMass','shoulderHeight',
  'bodyLength','legLength','skullWidth','muzzleLength','canineLength','earSize',
  'earShape','tailLength','furLength','pigmentWarmth','pigmentIntensity',
  'dilution','silver','rosette','patternDensity','melanism','albinism',
  'leucism','piebald'
]

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  name:'Temperate mixed habitat',
  temperatureC:18,
  terrain:'forest',
  foodAvailability:.65,
  preySpeed:.55,
  coverDensity:.60,
  selectionStrength:.65,
}

export const COLORS = [
  'black','charcoal','blue-gray','silver','white','cream','ivory','dark brown',
  'chocolate','cinnamon','tan','beige','gold','orange','red','rust','copper','fawn'
] as const

function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = h << 13 | h >>> 19
  }
  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507)
    h = Math.imul(h ^ h >>> 13, 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

export function rngFromSeed(seedText: string) {
  let state = xmur3(seedText)()
  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const avg = (p: GenePair) => (p[0] + p[1]) / 2
const finite = (n: number, fallback = 0) => Number.isFinite(n) ? n : fallback
const technicalClamp = (n: number) => Math.max(0, Math.min(100, finite(n)))
const unitClamp = (n:number) => Math.max(0,Math.min(1,finite(n,.5)))

function pair(v: number, spread: number, r: () => number): GenePair {
  return [technicalClamp(v + (r() - .5) * spread), technicalClamp(v + (r() - .5) * spread)]
}

function normalizePair(value: unknown, fallback: GenePair): GenePair {
  if (!Array.isArray(value) || value.length < 2) return fallback
  const a=Number(value[0])
  const b=Number(value[1])
  return [
    technicalClamp(Number.isFinite(a)?a:fallback[0]),
    technicalClamp(Number.isFinite(b)?b:fallback[1]),
  ]
}

export function upgradeGenome(input: Partial<Genome> | Genome): Genome {
  return {
    sizePotential:normalizePair(input.sizePotential,[.60,.60]),
    growthDuration:normalizePair(input.growthDuration,[.60,.60]),
    boneMass:normalizePair(input.boneMass,[.60,.60]),
    muscleMass:normalizePair(input.muscleMass,[.62,.62]),
    shoulderHeight:normalizePair(input.shoulderHeight,[.60,.60]),
    bodyLength:normalizePair(input.bodyLength,[.62,.62]),
    legLength:normalizePair(input.legLength,[.58,.58]),
    skullWidth:normalizePair(input.skullWidth,[.56,.56]),
    muzzleLength:normalizePair(input.muzzleLength,[.52,.52]),
    canineLength:normalizePair(input.canineLength,[.50,.50]),
    earSize:normalizePair(input.earSize,[.52,.52]),
    earShape:normalizePair(input.earShape,[.58,.58]),
    tailLength:normalizePair(input.tailLength,[.68,.68]),
    furLength:normalizePair(input.furLength,[.45,.45]),
    pigmentWarmth:normalizePair(input.pigmentWarmth,[.50,.50]),
    pigmentIntensity:normalizePair(input.pigmentIntensity,[.68,.68]),
    dilution:normalizePair(input.dilution,[.22,.22]),
    silver:normalizePair(input.silver,[.28,.28]),
    rosette:normalizePair(input.rosette,[.45,.45]),
    patternDensity:normalizePair(input.patternDensity,[.66,.66]),
    melanism:normalizePair(input.melanism,[0,0]),
    albinism:normalizePair(input.albinism,[0,0]),
    leucism:normalizePair(input.leucism,[0,0]),
    piebald:normalizePair(input.piebald,[0,0]),
  }
}

export type FounderBreed =
  | 'Bengal' | 'Maine Coon' | 'Siberian' | 'Custom'
  | 'Red Fox' | 'Arctic Fox' | 'Fennec Fox' | 'Silver Fox' | 'Custom Fox'
export type FounderMutation = 'none' | MutationKey

export interface FounderCustomization {
  mutations: MutationKey[]
  pattern: 'auto' | CoatPattern
  furLength: number
  tailLength: number
  bodyLength: number
  canineLength: number
  legLength: number
  earSize: number
  earShape: EarShape
}

interface FounderProfile {
  species:Species
  size:number
  height:number
  length:number
  muscle:number
  fur:number
  rosette:number
  tail:number
  leg:number
  ear:number
  earShape:EarShape
  skull:number
  muzzle:number
  canine:number
  warmth:number
  intensity:number
  dilution:number
  silver:number
}

export const FOUNDER_PROFILES:Record<FounderBreed,FounderProfile> = {
  Bengal:{species:'cat',size:.58,height:.58,length:.62,muscle:.65,fur:.20,rosette:.90,tail:.72,leg:.66,ear:.56,earShape:'pointed',skull:.56,muzzle:.55,canine:.58,warmth:.58,intensity:.72,dilution:.18,silver:.42},
  'Maine Coon':{species:'cat',size:.80,height:.78,length:.84,muscle:.70,fur:.90,rosette:.15,tail:.78,leg:.60,ear:.72,earShape:'pointed',skull:.72,muzzle:.48,canine:.58,warmth:.48,intensity:.68,dilution:.22,silver:.28},
  Siberian:{species:'cat',size:.76,height:.74,length:.76,muscle:.78,fur:.82,rosette:.12,tail:.72,leg:.61,ear:.54,earShape:'balanced',skull:.63,muzzle:.49,canine:.60,warmth:.50,intensity:.68,dilution:.22,silver:.25},
  Custom:{species:'cat',size:.60,height:.60,length:.60,muscle:.60,fur:.45,rosette:.45,tail:.68,leg:.58,ear:.52,earShape:'balanced',skull:.56,muzzle:.52,canine:.50,warmth:.50,intensity:.68,dilution:.22,silver:.28},

  'Red Fox':{species:'fox',size:.62,height:.64,length:.70,muscle:.60,fur:.60,rosette:.08,tail:.82,leg:.67,ear:.64,earShape:'pointed',skull:.46,muzzle:.78,canine:.60,warmth:.92,intensity:.72,dilution:.16,silver:.10},
  'Arctic Fox':{species:'fox',size:.52,height:.46,length:.54,muscle:.56,fur:.94,rosette:.05,tail:.80,leg:.52,ear:.28,earShape:'rounded',skull:.58,muzzle:.60,canine:.54,warmth:.58,intensity:.38,dilution:.90,silver:.88},
  'Fennec Fox':{species:'fox',size:.14,height:.15,length:.25,muscle:.32,fur:.28,rosette:.05,tail:.66,leg:.54,ear:.98,earShape:'pointed',skull:.36,muzzle:.62,canine:.42,warmth:.80,intensity:.38,dilution:.78,silver:.08},
  'Silver Fox':{species:'fox',size:.64,height:.63,length:.69,muscle:.61,fur:.64,rosette:.06,tail:.84,leg:.65,ear:.60,earShape:'pointed',skull:.48,muzzle:.77,canine:.60,warmth:.24,intensity:.82,dilution:.25,silver:.82},
  'Custom Fox':{species:'fox',size:.58,height:.58,length:.64,muscle:.58,fur:.58,rosette:.08,tail:.78,leg:.64,ear:.62,earShape:'pointed',skull:.48,muzzle:.72,canine:.56,warmth:.76,intensity:.66,dilution:.28,silver:.18},
}

export function breedsForSpecies(species:Species):FounderBreed[] {
  return (Object.keys(FOUNDER_PROFILES) as FounderBreed[]).filter(breed=>FOUNDER_PROFILES[breed].species===species)
}

function shapeGene(shape:EarShape) {
  return shape==='rounded'?.18:shape==='pointed'?.86:.52
}

function founderOptions(
  customization:FounderMutation | Partial<FounderCustomization>,
  profile:FounderProfile,
):FounderCustomization {
  if (typeof customization==='string') {
    return {
      mutations:customization==='none'?[]:[customization],
      pattern:'auto',
      furLength:profile.fur,
      tailLength:profile.tail,
      bodyLength:profile.length,
      canineLength:profile.canine,
      legLength:profile.leg,
      earSize:profile.ear,
      earShape:profile.earShape,
    }
  }
  return {
    mutations:customization.mutations || [],
    pattern:customization.pattern || 'auto',
    furLength:unitClamp(customization.furLength ?? profile.fur),
    tailLength:unitClamp(customization.tailLength ?? profile.tail),
    bodyLength:unitClamp(customization.bodyLength ?? profile.length),
    canineLength:unitClamp(customization.canineLength ?? profile.canine),
    legLength:unitClamp(customization.legLength ?? profile.leg),
    earSize:unitClamp(customization.earSize ?? profile.ear),
    earShape:customization.earShape || profile.earShape,
  }
}

export function createFounder(
  name: string,
  sex: Sex,
  breed: FounderBreed,
  lineage: string,
  colorBias = 0.5,
  customization: FounderMutation | Partial<FounderCustomization> = 'none',
): Individual {
  const p=FOUNDER_PROFILES[breed]
  const species=p.species
  const seedText = `${name}-${sex}-${species}-${breed}-${Date.now()}-${Math.random()}`
  const r = rngFromSeed(seedText)
  const options=founderOptions(customization,p)
  const patternGene =
    options.pattern==='solid'?.10:
    options.pattern==='spotted'?.48:
    options.pattern==='rosetted'?.90:
    p.rosette

  const genome: Genome = {
    sizePotential: pair(p.size,.16,r),
    growthDuration: pair(p.size,.18,r),
    boneMass: pair(Math.max(.18,p.size),.16,r),
    muscleMass: pair(p.muscle,.16,r),
    shoulderHeight: pair(p.height,.16,r),
    bodyLength: pair(options.bodyLength,.08,r),
    legLength: pair(options.legLength,.08,r),
    skullWidth: pair(p.skull,.12,r),
    muzzleLength: pair(p.muzzle,.12,r),
    canineLength:pair(options.canineLength,.08,r),
    earSize:pair(options.earSize,.08,r),
    earShape:pair(shapeGene(options.earShape),.06,r),
    tailLength: pair(options.tailLength,.08,r),
    furLength: pair(options.furLength,.08,r),
    pigmentWarmth: pair((p.warmth+colorBias)/2,.16,r),
    pigmentIntensity: pair(p.intensity,.16,r),
    dilution: pair(p.dilution,.14,r),
    silver: pair(p.silver,.18,r),
    rosette: pair(patternGene,.08,r),
    patternDensity: pair(species==='fox'?.24:.66,.18,r),
    melanism: [0, 0],
    albinism: [0, 0],
    leucism: [0, 0],
    piebald: [0, r() < (species==='fox'?.03:.08) ? 1 : 0],
  }

  for (const mutation of options.mutations) {
    if (mutation==='melanism') genome.melanism=[1,0]
    if (mutation==='albinism') genome.albinism=[1,1]
    if (mutation==='leucism') genome.leucism=[1,0]
    if (mutation==='piebald') genome.piebald=[1,1]
  }

  const seed = Math.floor(r() * 2_147_483_647)
  const individual: Individual = {
    id: crypto.randomUUID(),
    name,
    sex,
    species,
    generation: 0,
    lineage,
    genomeSchema: species==='fox'?'Vulpine_01':'Feline_01',
    genome,
    phenotype: {} as Phenotype,
    seed,
    createdAt: new Date().toISOString(),
  }
  individual.phenotype = calculatePhenotype(individual)
  return individual
}

function inheritedMutation(pair: GenePair, mode: 'recessive'|'dominant') {
  return mode === 'dominant' ? pair[0] >= .5 || pair[1] >= .5 : pair[0] >= .5 && pair[1] >= .5
}

function coatFromGenome(g: Genome) {
  const warm = avg(g.pigmentWarmth)
  const intensity = avg(g.pigmentIntensity)
  const dilution = avg(g.dilution)
  const silver = avg(g.silver)
  let name = 'brown'
  let hex = '#75513b'

  if (silver > .68) { name = 'silver'; hex = '#a9adb1' }
  else if (warm > .80) { name = intensity > .7 ? 'copper' : 'orange'; hex = intensity > .7 ? '#a95f34' : '#ca7b43' }
  else if (warm > .66) { name = 'gold'; hex = '#b48a45' }
  else if (warm > .48) { name = intensity > .72 ? 'dark brown' : 'chocolate'; hex = intensity > .72 ? '#4b352d' : '#67483c' }
  else if (warm > .32) { name = dilution > .58 ? 'blue-gray' : 'charcoal'; hex = dilution > .58 ? '#69727b' : '#3d4146' }
  else { name = intensity > .65 ? 'black' : 'charcoal'; hex = intensity > .65 ? '#17191c' : '#3d4146' }

  if (dilution > .78 && silver < .68) {
    name = warm > .58 ? 'cream' : 'blue-gray'
    hex = warm > .58 ? '#d7c6a1' : '#87909a'
  }
  return {name, hex}
}

function earShapeFromGene(v:number):EarShape {
  return v<.34?'rounded':v>.68?'pointed':'balanced'
}

export function calculatePhenotype(individual: Pick<Individual,'genome'|'sex'|'seed'>): Phenotype {
  const g = upgradeGenome(individual.genome)
  const sexScale = individual.sex === 'male' ? 1.08 : .96

  const structural = avg(g.sizePotential) * .34 + avg(g.growthDuration) * .20 + avg(g.boneMass) * .18 + avg(g.muscleMass) * .28
  const weightKg = Math.max(.2, (2.6 + 10.8 * structural ** 2 + 3.8 * avg(g.boneMass) + 4.2 * avg(g.muscleMass)) * sexScale)
  const shoulderCm = Math.max(8, (19 + 23 * avg(g.shoulderHeight) + 4 * structural) * Math.sqrt(sexScale))
  const bodyLengthCm = Math.max(15, 35 + 42 * avg(g.bodyLength) + 8 * structural)
  const tailLengthCm = Math.max(5, bodyLengthCm * (.40 + .55 * avg(g.tailLength)))
  const canineLengthCm = .65 + 1.75*avg(g.canineLength)

  const melanism = inheritedMutation(g.melanism,'dominant')
  const albinism = inheritedMutation(g.albinism,'recessive')
  const leucism = inheritedMutation(g.leucism,'dominant')
  const piebald = inheritedMutation(g.piebald,'dominant')

  let {name: coatName, hex: coatHex} = coatFromGenome(g)
  let patternHex = '#29241f'
  let whiteFraction = 0

  const mutations: string[] = []

  // Pigmentation epistasis:
  // Albinism prevents normal melanin expression, so a cat can genetically
  // carry melanism (and other pigment loci) without visibly expressing them.
  // Visible mutation labels describe phenotype, not every carried allele.
  if (albinism) {
    mutations.push('Albinism')
    coatName = 'albino'
    coatHex = '#f1e7dc'
    patternHex = '#ead9d2'
    whiteFraction = 0
  } else {
    if (leucism) {
      mutations.push('Leucism')
      coatName = 'leucistic ' + coatName
      whiteFraction = Math.max(whiteFraction, .72)
    } else if (melanism) {
      mutations.push('Melanism')
      coatName = 'melanistic ' + coatName
      coatHex = '#17191b'
      patternHex = '#090a0b'
    }

    if (piebald) {
      mutations.push('Piebald')
      coatName = 'piebald ' + coatName
      whiteFraction = Math.max(whiteFraction, .18 + .65 * avg(g.piebald))
    }
  }

  const r = rngFromSeed(String(individual.seed))
  const rosetteScore = avg(g.rosette)
  const pattern: Phenotype['pattern'] =
    rosetteScore > .66 ? 'rosetted' : rosetteScore > .32 ? 'spotted' : 'solid'

  return {
    weightKg: finite(weightKg, 4),
    shoulderCm: finite(shoulderCm, 25),
    bodyLengthCm: finite(bodyLengthCm, 45),
    legRatio: .42 + avg(g.legLength) * .34,
    skullWidth: .75 + avg(g.skullWidth) * .55,
    muzzleLength: .65 + avg(g.muzzleLength) * .55,
    canineLengthCm:finite(canineLengthCm,1.4),
    earSize:.72+avg(g.earSize)*.72,
    earShape:earShapeFromGene(avg(g.earShape)),
    tailLengthCm: finite(tailLengthCm, 30),
    furLength: avg(g.furLength),
    coatName,
    coatHex,
    pattern,
    patternDensity: Math.min(1, Math.max(0, avg(g.patternDensity) + (r()-.5)*.05)),
    patternHex,
    whiteFraction: Math.min(.96, whiteFraction),
    mutationLabels: mutations,
  }
}

function match(value:number,target:number,width=.55) {
  return Math.max(0,1-Math.abs(value-target)/Math.max(.08,width))
}

export function environmentFitness(individual:Individual,environment:EnvironmentSettings) {
  const g=upgradeGenome(individual.genome)
  const p=individual.phenotype
  const cold=unitClamp((12-environment.temperatureC)/28)
  const heat=unitClamp((environment.temperatureC-20)/22)
  const foodScarcity=1-unitClamp(environment.foodAvailability)
  const prey=unitClamp(environment.preySpeed)
  const cover=unitClamp(environment.coverDensity)

  let score=0
  let weight=0
  const add=(value:number,w:number)=>{score+=Math.max(0,Math.min(1,value))*w;weight+=w}

  // Thermal selection: cold favors insulation, compact ears and somewhat
  // heavier frames; heat favors shorter coats, larger ears and leaner frames.
  if (cold>.05) {
    add(match(p.furLength,.85,.55),1.0+cold)
    add(match(p.earSize,.82,.55),.55+cold*.45)
    add(match(unitClamp(p.weightKg/14),.68,.65),.55+cold*.35)
  } else if (heat>.05) {
    add(match(p.furLength,.16,.52),1.0+heat)
    add(match(p.earSize,1.25,.55),.55+heat*.45)
    add(match(unitClamp(p.weightKg/14),.34,.62),.45+heat*.30)
  } else {
    add(match(p.furLength,.48,.70),.55)
  }

  if (environment.terrain==='open') {
    add(match(p.legRatio,.72,.34),1.15)
    add(match(avg(g.muscleMass),.68,.55),.75)
    add(match(p.furLength,.35,.72),.30)
  } else if (environment.terrain==='forest') {
    add(match(p.patternDensity,.72,.62),.80)
    add(match(p.legRatio,.60,.42),.55)
    add(match(avg(g.tailLength),.70,.55),.35)
  } else if (environment.terrain==='rocky') {
    add(match(avg(g.boneMass),.78,.55),1.0)
    add(match(p.legRatio,.64,.42),.72)
    add(match(avg(g.muscleMass),.72,.52),.72)
  } else {
    add(match(p.furLength,.34,.65),.55)
    add(match(p.legRatio,.66,.45),.55)
    add(match(avg(g.tailLength),.74,.55),.50)
  }

  // Faster prey favors cursorial build and stronger predatory dentition.
  add(match(p.legRatio,.55+prey*.22,.40),.45+prey*.75)
  add(match(avg(g.muscleMass),.52+prey*.30,.55),.35+prey*.60)
  add(match(unitClamp((p.canineLengthCm-.65)/1.75),.40+prey*.48,.55),.30+prey*.58)

  // Dense cover rewards disruptive/spotted patterning. Open cover relaxes it.
  if (cover>.35) {
    const patternValue=p.pattern==='rosetted'?.92:p.pattern==='spotted'?.68:.18
    add(match(patternValue,.55+cover*.40,.62),.35+cover*.65)
  }

  // Scarce food penalizes very large, expensive bodies.
  if (foodScarcity>.08) {
    add(match(unitClamp(p.weightKg/16),.25+(1-foodScarcity)*.40,.70),.40+foodScarcity*.85)
    add(match(avg(g.sizePotential),.34+(1-foodScarcity)*.38,.66),.30+foodScarcity*.55)
  }

  return weight?score/weight:.5
}

export function describeAdaptations(individual:Individual,environment:EnvironmentSettings) {
  const labels:string[]=[]
  const p=individual.phenotype
  const g=upgradeGenome(individual.genome)
  if (environment.temperatureC<=5 && p.furLength>.68) labels.push('cold-insulated coat')
  if (environment.temperatureC>=28 && p.furLength<.32 && p.earSize>1.05) labels.push('heat-dissipating build')
  if (environment.terrain==='open' && p.legRatio>.66) labels.push('cursorial long legs')
  if (environment.terrain==='rocky' && avg(g.boneMass)>.68) labels.push('robust rocky-terrain frame')
  if (environment.preySpeed>.65 && p.canineLengthCm>1.55) labels.push('long predatory canines')
  if (environment.coverDensity>.65 && p.pattern!=='solid') labels.push('cover camouflage')
  if (environment.foodAvailability<.35 && p.weightKg<8) labels.push('low-resource body economy')
  return labels
}

function mutateAllele(v: number, r: () => number, rate: number) {
  if (r() > rate) return v
  const step = (r() - .48) * .10
  return technicalClamp(v + step)
}

function gameteValue(pair: GenePair, r: () => number, rate: number) {
  return mutateAllele(r() < .5 ? pair[0] : pair[1], r, rate)
}

function makeChild(
  mother:Individual,
  father:Individual,
  lineage:string,
  name:string|undefined,
  mutationRate:number,
  seedSalt:string,
):Individual {
  if (mother.sex !== 'female' || father.sex !== 'male') throw new Error('Breeding requires a female mother and male father.')
  if (mother.genomeSchema !== father.genomeSchema) throw new Error('Genome schemas are incompatible.')

  const motherGenome=upgradeGenome(mother.genome)
  const fatherGenome=upgradeGenome(father.genome)
  const seedText = `${mother.id}|${father.id}|${mother.generation}|${father.generation}|${seedSalt}|${crypto.randomUUID()}`
  const r = rngFromSeed(seedText)
  const genome = {} as Genome

  for (const locus of LOCI) {
    genome[locus] = [
      gameteValue(motherGenome[locus], r, mutationRate),
      gameteValue(fatherGenome[locus], r, mutationRate),
    ]
  }

  // Mutation remains random. The environment does not direct mutations;
  // natural selection acts afterward on the inherited variation they create.
  if (r() < mutationRate * .12) genome.melanism[Math.floor(r()*2) as 0|1] = 1
  if (r() < mutationRate * .08) genome.albinism[Math.floor(r()*2) as 0|1] = 1
  if (r() < mutationRate * .10) genome.leucism[Math.floor(r()*2) as 0|1] = 1
  if (r() < mutationRate * .20) genome.piebald[Math.floor(r()*2) as 0|1] = 1

  const generation = Math.max(mother.generation, father.generation) + 1
  const seed = Math.floor(r() * 2_147_483_647)
  const child: Individual = {
    id: crypto.randomUUID(),
    name: name || `G${generation}-${Math.floor(r()*9999).toString().padStart(4,'0')}`,
    sex: r() < .5 ? 'female' : 'male',
    generation,
    lineage,
    genomeSchema: 'Feline_01',
    genome,
    phenotype: {} as Phenotype,
    seed,
    motherId: mother.id,
    fatherId: father.id,
    createdAt: new Date().toISOString(),
  }
  child.phenotype = calculatePhenotype(child)
  return child
}

export function breed(
  mother: Individual,
  father: Individual,
  lineage: string,
  name?: string,
  mutationRate = .012,
  seedSalt = '',
  environment?:EnvironmentSettings,
): Individual {
  if (!environment || environment.selectionStrength<=.01) {
    return makeChild(mother,father,lineage,name,mutationRate,seedSalt)
  }

  // A manual breeding represents a litter raised in the active environment.
  // Higher-fitness kittens are more likely to survive to the playable animal.
  const litterSize=4+Math.round(environment.selectionStrength*4)
  const candidates=Array.from({length:litterSize},(_,i)=>
    makeChild(mother,father,lineage,name,mutationRate,`${seedSalt}-litter-${i}`)
  )
  const r=rngFromSeed(`${mother.id}|${father.id}|${seedSalt}|environment`)
  return candidates
    .map(child=>({
      child,
      score:environmentFitness(child,environment)*environment.selectionStrength+r()*(1-environment.selectionStrength)*.45,
    }))
    .sort((a,b)=>b.score-a.score)[0].child
}

export function autoBreed(
  starting: Individual[],
  generations: number,
  lineage: string,
  populationSize = 24,
  mutationRate = .012,
  environment:EnvironmentSettings=DEFAULT_ENVIRONMENT,
): Individual[] {
  if (!Number.isInteger(generations) || generations < 1) throw new Error('Generation count must be at least 1.')
  if (starting.length < 2) throw new Error('At least two animals are required.')

  let population = starting.map(animal=>({
    ...animal,
    genome:upgradeGenome(animal.genome),
    phenotype:calculatePhenotype({...animal,genome:upgradeGenome(animal.genome)}),
  }))

  for (let gen = 0; gen < generations; gen++) {
    const females = population.filter(a => a.sex === 'female')
    const males = population.filter(a => a.sex === 'male')
    if (!females.length || !males.length) throw new Error('Auto Breed needs at least one female and one male.')

    const selection=unitClamp(environment.selectionStrength)
    const r=rngFromSeed(`${lineage}|${gen}|${environment.name}|${population.length}`)
    const rank=(animals:Individual[])=>[...animals]
      .map(a=>({
        a,
        score:environmentFitness(a,environment)*selection+r()*(1-selection)*.55,
      }))
      .sort((x,y)=>y.score-x.score)
      .map(x=>x.a)

    const rankedF=rank(females).slice(0,Math.max(2,Math.ceil(females.length*(.62-selection*.28))))
    const rankedM=rank(males).slice(0,Math.max(2,Math.ceil(males.length*(.62-selection*.28))))
    const candidateCount=Math.max(populationSize,Math.round(populationSize*(1.6+selection*2.2)))
    const candidates:Individual[]=[]

    for (let i=0;i<candidateCount;i++) {
      const mother=rankedF[i%rankedF.length]
      const father=rankedM[(i*3+gen)%rankedM.length]
      candidates.push(makeChild(mother,father,lineage,undefined,mutationRate,`auto-${gen}-${i}`))
    }

    population=candidates
      .map(a=>({
        a,
        score:environmentFitness(a,environment)*selection+r()*(1-selection)*.50,
      }))
      .sort((x,y)=>y.score-x.score)
      .slice(0,populationSize)
      .map(x=>x.a)

    if (!population.some(a => a.sex === 'female') && population[0]) {
      population[0].sex = 'female'
      population[0].phenotype = calculatePhenotype(population[0])
    }
    if (!population.some(a => a.sex === 'male') && population[1]) {
      population[1].sex = 'male'
      population[1].phenotype = calculatePhenotype(population[1])
    }
  }
  return population
}
