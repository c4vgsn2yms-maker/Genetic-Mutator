export type Sex = 'male' | 'female'
export type Species = 'cat' | 'fox'
export type GenomeSchema = 'Feline_01' | 'Vulpine_01'

export type MutationKey = 'melanism' | 'albinism' | 'leucism' | 'piebald'
export type CoatPattern = 'solid' | 'spotted' | 'rosetted'
export type EarShape = 'rounded' | 'balanced' | 'pointed'
export type TerrainType = 'open' | 'forest' | 'rocky' | 'wetland'

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
  canineLength: GenePair
  earSize: GenePair
  earShape: GenePair
  tailLength: GenePair
  furLength: GenePair
  furDensity: GenePair
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
  canineLengthCm: number
  earSize: number
  earShape: EarShape
  tailLengthCm: number
  furLength: number
  furDensityPerSqIn: number
  coatName: string
  coatHex: string
  pattern: CoatPattern
  patternDensity: number
  patternHex: string
  whiteFraction: number
  mutationLabels: string[]
}

export interface Individual {
  id: string
  name: string
  sex: Sex
  species: Species
  generation: number
  lineage: string
  genomeSchema: GenomeSchema
  genome: Genome
  phenotype: Phenotype
  seed: number
  motherId?: string
  fatherId?: string
  createdAt: string
}

export interface EnvironmentSettings {
  name: string
  temperatureC: number
  terrain: TerrainType
  foodAvailability: number
  preySpeed: number
  coverDensity: number
  selectionStrength: number
}

export interface SimulationState {
  individuals: Individual[]
  selectedMotherId?: string
  selectedFatherId?: string
  units: 'imperial' | 'metric'
  lineage: string
  currentGeneration: number
  environment: EnvironmentSettings
}
