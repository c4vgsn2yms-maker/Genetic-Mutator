export type Sex = 'male' | 'female'

export type MutationKey = 'melanism' | 'albinism' | 'leucism' | 'piebald'

export type GenePair = [number, number]

export interface Genome {
  sizePotential: GenePair
  growthDuration: GenePair
  boneMass: GenePair
  muscleMass: GenePair
  shoulderHeight: GenePair
  bodyLength: GenePair
  legLength: GenePair
  skullWidth: GenePair
  muzzleLength: GenePair
  tailLength: GenePair
  furLength: GenePair
  pigmentWarmth: GenePair
  pigmentIntensity: GenePair
  dilution: GenePair
  silver: GenePair
  rosette: GenePair
  patternDensity: GenePair
  melanism: GenePair
  albinism: GenePair
  leucism: GenePair
  piebald: GenePair
}

export interface Phenotype {
  weightKg: number
  shoulderCm: number
  bodyLengthCm: number
  legRatio: number
  skullWidth: number
  muzzleLength: number
  tailLengthCm: number
  furLength: number
  coatName: string
  coatHex: string
  pattern: 'solid' | 'spotted' | 'rosetted'
  patternDensity: number
  patternHex: string
  whiteFraction: number
  mutationLabels: string[]
}

export interface Individual {
  id: string
  name: string
  sex: Sex
  generation: number
  lineage: string
  genomeSchema: 'Feline_01'
  genome: Genome
  phenotype: Phenotype
  seed: number
  motherId?: string
  fatherId?: string
  createdAt: string
}

export interface SimulationState {
  individuals: Individual[]
  selectedMotherId?: string
  selectedFatherId?: string
  units: 'imperial' | 'metric'
  lineage: string
  currentGeneration: number
}
