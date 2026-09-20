import type { GenePair, Genome, Individual, Phenotype, Sex } from './types'

const LOCI: (keyof Genome)[] = [
  'sizePotential','growthDuration','boneMass','muscleMass','shoulderHeight',
  'bodyLength','legLength','skullWidth','muzzleLength','tailLength','furLength',
  'pigmentWarmth','pigmentIntensity','dilution','silver','rosette','patternDensity',
  'melanism','albinism','leucism','piebald'
]

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

function pair(v: number, spread: number, r: () => number): GenePair {
  return [technicalClamp(v + (r() - .5) * spread), technicalClamp(v + (r() - .5) * spread)]
}

export type FounderBreed = 'Bengal' | 'Maine Coon' | 'Siberian' | 'Custom'

export function createFounder(
  name: string,
  sex: Sex,
  breed: FounderBreed,
  lineage: string,
  colorBias = 0.5,
): Individual {
  const seedText = `${name}-${sex}-${breed}-${Date.now()}-${Math.random()}`
  const r = rngFromSeed(seedText)
  const profiles: Record<FounderBreed, {size:number; height:number; length:number; muscle:number; fur:number; rosette:number}> = {
    Bengal: { size:.58, height:.58, length:.62, muscle:.65, fur:.2, rosette:.9 },
    'Maine Coon': { size:.80, height:.78, length:.84, muscle:.70, fur:.9, rosette:.15 },
    Siberian: { size:.76, height:.74, length:.76, muscle:.78, fur:.82, rosette:.12 },
    Custom: { size:.60, height:.60, length:.60, muscle:.60, fur:.45, rosette:.45 },
  }
  const p = profiles[breed]
  const genome: Genome = {
    sizePotential: pair(p.size,.16,r),
    growthDuration: pair(p.size,.18,r),
    boneMass: pair(p.size,.16,r),
    muscleMass: pair(p.muscle,.16,r),
    shoulderHeight: pair(p.height,.16,r),
    bodyLength: pair(p.length,.16,r),
    legLength: pair(.58,.16,r),
    skullWidth: pair(breed === 'Maine Coon' ? .72 : .56,.17,r),
    muzzleLength: pair(breed === 'Bengal' ? .55 : .48,.16,r),
    tailLength: pair(breed === 'Bengal' ? .72 : .66,.16,r),
    furLength: pair(p.fur,.14,r),
    pigmentWarmth: pair(colorBias,.25,r),
    pigmentIntensity: pair(.68,.20,r),
    dilution: pair(.22,.18,r),
    silver: pair(breed === 'Bengal' ? .42 : .25,.30,r),
    rosette: pair(p.rosette,.16,r),
    patternDensity: pair(.66,.20,r),
    melanism: [0, 0],
    albinism: [0, 0],
    leucism: [0, 0],
    piebald: [0, r() < .08 ? 1 : 0],
  }
  const seed = Math.floor(r() * 2_147_483_647)
  const individual: Individual = {
    id: crypto.randomUUID(),
    name,
    sex,
    generation: 0,
    lineage,
    genomeSchema: 'Feline_01',
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

export function calculatePhenotype(individual: Pick<Individual,'genome'|'sex'|'seed'>): Phenotype {
  const g = individual.genome
  const sexScale = individual.sex === 'male' ? 1.08 : .96

  // No gameplay weight cap. Gene values are only bounded by a very broad technical safety range.
  const structural = avg(g.sizePotential) * .34 + avg(g.growthDuration) * .20 + avg(g.boneMass) * .18 + avg(g.muscleMass) * .28
  const weightKg = Math.max(.2, (2.6 + 10.8 * structural ** 2 + 3.8 * avg(g.boneMass) + 4.2 * avg(g.muscleMass)) * sexScale)
  const shoulderCm = Math.max(8, (19 + 23 * avg(g.shoulderHeight) + 4 * structural) * Math.sqrt(sexScale))
  const bodyLengthCm = Math.max(15, 35 + 42 * avg(g.bodyLength) + 8 * structural)
  const tailLengthCm = Math.max(5, bodyLengthCm * (.48 + .38 * avg(g.tailLength)))

  const melanism = inheritedMutation(g.melanism,'dominant')
  const albinism = inheritedMutation(g.albinism,'recessive')
  const leucism = inheritedMutation(g.leucism,'dominant')
  const piebald = inheritedMutation(g.piebald,'dominant')

  let {name: coatName, hex: coatHex} = coatFromGenome(g)
  let patternHex = '#29241f'
  let whiteFraction = 0

  const mutations: string[] = []
  if (melanism) {
    mutations.push('Melanism')
    coatName = 'melanistic ' + coatName
    coatHex = '#17191b'
    patternHex = '#090a0b'
  }
  if (albinism) {
    mutations.push('Albinism')
    coatName = 'albino'
    coatHex = '#f1e7dc'
    patternHex = '#ead9d2'
  } else if (leucism) {
    mutations.push('Leucism')
    whiteFraction = Math.max(whiteFraction, .72)
  }
  if (piebald) {
    mutations.push('Piebald')
    whiteFraction = Math.max(whiteFraction, .18 + .65 * avg(g.piebald))
  }

  const r = rngFromSeed(String(individual.seed))
  const rosetteScore = avg(g.rosette)
  const pattern: Phenotype['pattern'] =
    albinism ? 'solid' : rosetteScore > .66 ? 'rosetted' : rosetteScore > .32 ? 'spotted' : 'solid'

  return {
    weightKg: finite(weightKg, 4),
    shoulderCm: finite(shoulderCm, 25),
    bodyLengthCm: finite(bodyLengthCm, 45),
    legRatio: .44 + avg(g.legLength) * .28,
    skullWidth: .75 + avg(g.skullWidth) * .55,
    muzzleLength: .65 + avg(g.muzzleLength) * .55,
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

function mutateAllele(v: number, r: () => number, rate: number) {
  if (r() > rate) return v
  const step = (r() - .48) * .10
  return technicalClamp(v + step)
}

function gameteValue(pair: GenePair, r: () => number, rate: number) {
  return mutateAllele(r() < .5 ? pair[0] : pair[1], r, rate)
}

export function breed(
  mother: Individual,
  father: Individual,
  lineage: string,
  name?: string,
  mutationRate = .012,
  seedSalt = '',
): Individual {
  if (mother.sex !== 'female' || father.sex !== 'male') throw new Error('Breeding requires a female mother and male father.')
  if (mother.genomeSchema !== father.genomeSchema) throw new Error('Genome schemas are incompatible.')

  const seedText = `${mother.id}|${father.id}|${mother.generation}|${father.generation}|${seedSalt}|${crypto.randomUUID()}`
  const r = rngFromSeed(seedText)
  const genome = {} as Genome

  for (const locus of LOCI) {
    genome[locus] = [
      gameteValue(mother.genome[locus], r, mutationRate),
      gameteValue(father.genome[locus], r, mutationRate),
    ]
  }

  // Rare named pigmentation mutations. These alter real inherited loci.
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

export function autoBreed(
  starting: Individual[],
  generations: number,
  lineage: string,
  populationSize = 24,
  mutationRate = .012,
): Individual[] {
  if (!Number.isInteger(generations) || generations < 1) throw new Error('Generation count must be at least 1.')
  if (starting.length < 2) throw new Error('At least two animals are required.')

  let population = [...starting]
  for (let gen = 0; gen < generations; gen++) {
    const females = population.filter(a => a.sex === 'female')
    const males = population.filter(a => a.sex === 'male')
    if (!females.length || !males.length) throw new Error('Auto Breed needs at least one female and one male.')

    // Select larger animals while retaining several breeders to avoid collapsing immediately onto one pair.
    const rankedF = [...females].sort((a,b) => b.phenotype.weightKg - a.phenotype.weightKg).slice(0, Math.max(2, Math.ceil(females.length*.45)))
    const rankedM = [...males].sort((a,b) => b.phenotype.weightKg - a.phenotype.weightKg).slice(0, Math.max(2, Math.ceil(males.length*.45)))
    const next: Individual[] = []

    for (let i = 0; i < populationSize; i++) {
      const mother = rankedF[i % rankedF.length]
      const father = rankedM[(i * 3 + gen) % rankedM.length]
      next.push(breed(mother, father, lineage, undefined, mutationRate, `auto-${gen}-${i}`))
    }
    population = next
  }
  return population
}
