import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  autoBreed,
  breed,
  calculatePhenotype,
  createFounder,
  DEFAULT_ENVIRONMENT,
  describeAdaptations,
  environmentFitness,
  upgradeGenome,
  type FounderBreed,
  type FounderCustomization,
} from './genetics'
import { CatPreview } from './CatPreview'
import { FoxPreview } from './FoxPreview'
import { Cat3DViewer } from './three/Cat3DViewer'
import type {
  CoatPattern,
  EarShape,
  EnvironmentSettings,
  Individual,
  MutationKey,
  SimulationState,
  Species,
  TerrainType,
} from './types'

const STORAGE_KEY = 'genetic-mutator-v1'

const FOUNDER_PRESETS:Record<FounderBreed,Pick<FounderCustomization,'furLength'|'tailLength'|'bodyLength'|'canineLength'|'legLength'|'earSize'|'earShape'>> = {
  Bengal:{furLength:.20,tailLength:.72,bodyLength:.62,canineLength:.58,legLength:.66,earSize:.56,earShape:'pointed'},
  'Maine Coon':{furLength:.90,tailLength:.78,bodyLength:.84,canineLength:.58,legLength:.60,earSize:.72,earShape:'pointed'},
  Siberian:{furLength:.82,tailLength:.72,bodyLength:.76,canineLength:.60,legLength:.61,earSize:.54,earShape:'balanced'},
  Custom:{furLength:.45,tailLength:.68,bodyLength:.60,canineLength:.50,legLength:.58,earSize:.52,earShape:'balanced'},
  'Red Fox':{furLength:.60,tailLength:.82,bodyLength:.70,canineLength:.60,legLength:.67,earSize:.64,earShape:'pointed'},
  'Arctic Fox':{furLength:.94,tailLength:.80,bodyLength:.54,canineLength:.54,legLength:.52,earSize:.28,earShape:'rounded'},
  'Fennec Fox':{furLength:.28,tailLength:.66,bodyLength:.25,canineLength:.42,legLength:.54,earSize:.98,earShape:'pointed'},
  'Silver Fox':{furLength:.64,tailLength:.84,bodyLength:.69,canineLength:.60,legLength:.65,earSize:.60,earShape:'pointed'},
  'Custom Fox':{furLength:.58,tailLength:.78,bodyLength:.64,canineLength:.56,legLength:.64,earSize:.62,earShape:'pointed'},
}

const BREEDS_BY_SPECIES:Record<Species,FounderBreed[]> = {
  cat:['Bengal','Maine Coon','Siberian','Custom'],
  fox:['Red Fox','Arctic Fox','Fennec Fox','Silver Fox','Custom Fox'],
}

const ENVIRONMENT_PRESETS:EnvironmentSettings[] = [
  DEFAULT_ENVIRONMENT,
  {name:'Arctic tundra',temperatureC:-12,terrain:'open',foodAvailability:.35,preySpeed:.68,coverDensity:.18,selectionStrength:.88},
  {name:'Hot desert',temperatureC:36,terrain:'rocky',foodAvailability:.25,preySpeed:.72,coverDensity:.12,selectionStrength:.86},
  {name:'Dense forest',temperatureC:16,terrain:'forest',foodAvailability:.72,preySpeed:.48,coverDensity:.92,selectionStrength:.76},
  {name:'Rocky highland',temperatureC:4,terrain:'rocky',foodAvailability:.44,preySpeed:.70,coverDensity:.24,selectionStrength:.82},
  {name:'Warm wetland',temperatureC:27,terrain:'wetland',foodAvailability:.78,preySpeed:.46,coverDensity:.74,selectionStrength:.70},
]

function makeInitialState(): SimulationState {
  const lineage = 'Foundation'
  const animals = [
    createFounder('Bengal Male A','male','Bengal',lineage,.38),
    createFounder('Bengal Male B','male','Bengal',lineage,.62),
    createFounder('Bengal Female','female','Bengal',lineage,.48),
    createFounder('Maine Coon Female','female','Maine Coon',lineage,.42),
    createFounder('Siberian Female','female','Siberian',lineage,.54),
  ]
  return {
    individuals: animals,
    selectedMotherId: animals.find(a => a.sex === 'female')?.id,
    selectedFatherId: animals.find(a => a.sex === 'male')?.id,
    units: 'imperial',
    lineage,
    currentGeneration: 0,
    environment:{...DEFAULT_ENVIRONMENT},
  }
}

function loadState(): SimulationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeInitialState()
    const parsed = JSON.parse(raw) as SimulationState
    if (!Array.isArray(parsed.individuals) || !parsed.individuals.length) return makeInitialState()

    const individuals = parsed.individuals.map(animal => {
      const genome=upgradeGenome(animal.genome)
      const species:Species = animal.species || (animal.genomeSchema==='Vulpine_01'?'fox':'cat')
      const genomeSchema = species==='fox' ? 'Vulpine_01' as const : 'Feline_01' as const
      const upgraded={...animal,species,genomeSchema,genome}
      return {
        ...upgraded,
        phenotype:calculatePhenotype(upgraded),
      }
    })

    return {
      ...parsed,
      individuals,
      environment:{...DEFAULT_ENVIRONMENT,...(parsed.environment || {})},
    }
  } catch {
    return makeInitialState()
  }
}

function weight(valueKg: number, units: SimulationState['units']) {
  return units === 'imperial' ? `${(valueKg * 2.2046226218).toFixed(1)} lb` : `${valueKg.toFixed(1)} kg`
}

function length(valueCm: number, units: SimulationState['units']) {
  return units === 'imperial' ? `${(valueCm / 2.54).toFixed(1)} in` : `${valueCm.toFixed(1)} cm`
}

const percent=(value:number)=>`${Math.round(value*100)}%`

export function App() {
  const initial=useMemo(()=>loadState(),[])
  const [state, setState] = useState<SimulationState>(initial)
  const [selectedId, setSelectedId] = useState<string>(initial.individuals[0]?.id || '')
  const [status, setStatus] = useState('Ready')
  const [autoGenerations, setAutoGenerations] = useState(10)
  const [populationSize, setPopulationSize] = useState(24)
  const [mutationRate, setMutationRate] = useState(.012)
  const [founderName, setFounderName] = useState('New Founder')
  const [founderSex, setFounderSex] = useState<'male'|'female'>('female')
  const [founderSpecies,setFounderSpecies]=useState<Species>('cat')
  const [founderBreed, setFounderBreed] = useState<FounderBreed>('Custom')
  const [breedingSpecies,setBreedingSpecies]=useState<Species>(initial.individuals[0]?.species || 'cat')
  const [founderPattern,setFounderPattern]=useState<'auto'|CoatPattern>('auto')
  const [founderMutations,setFounderMutations]=useState<MutationKey[]>([])
  const [founderFurLength,setFounderFurLength]=useState(.45)
  const [founderTailLength,setFounderTailLength]=useState(.68)
  const [founderBodyLength,setFounderBodyLength]=useState(.60)
  const [founderCanineLength,setFounderCanineLength]=useState(.50)
  const [founderLegLength,setFounderLegLength]=useState(.58)
  const [founderEarSize,setFounderEarSize]=useState(.52)
  const [founderEarShape,setFounderEarShape]=useState<EarShape>('balanced')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const selected = state.individuals.find(a => a.id === selectedId) || state.individuals[0]
  const females = state.individuals.filter(a => a.sex === 'female' && a.species===breedingSpecies)
  const males = state.individuals.filter(a => a.sex === 'male' && a.species===breedingSpecies)
  const mother = females.find(a => a.id === state.selectedMotherId)
  const father = males.find(a => a.id === state.selectedFatherId)
  const selectedFitness=selected?environmentFitness(selected,state.environment):0
  const selectedAdaptations=selected?describeAdaptations(selected,state.environment):[]

  const stats = useMemo(() => {
    const animals = state.individuals
    const avgWeight = animals.reduce((sum,a) => sum + a.phenotype.weightKg,0) / Math.max(1,animals.length)
    const avgHeight = animals.reduce((sum,a) => sum + a.phenotype.shoulderCm,0) / Math.max(1,animals.length)
    const mutationCount = animals.filter(a => a.phenotype.mutationLabels.length).length
    const avgFitness=animals.reduce((sum,a)=>sum+environmentFitness(a,state.environment),0)/Math.max(1,animals.length)
    return {avgWeight,avgHeight,mutationCount,avgFitness}
  }, [state.individuals,state.environment])

  function updateEnvironment(patch:Partial<EnvironmentSettings>) {
    setState(s=>({...s,environment:{...s.environment,...patch}}))
  }

  function applyEnvironmentPreset(name:string) {
    const preset=ENVIRONMENT_PRESETS.find(p=>p.name===name)
    if (preset) setState(s=>({...s,environment:{...preset}}))
  }

  function applyFounderSpecies(species:Species) {
    setFounderSpecies(species)
    const breed:FounderBreed=species==='fox'?'Red Fox':'Custom'
    applyBreedPreset(breed)
  }

  function applyBreedPreset(breed:FounderBreed) {
    setFounderBreed(breed)
    const p=FOUNDER_PRESETS[breed]
    setFounderFurLength(p.furLength)
    setFounderTailLength(p.tailLength)
    setFounderBodyLength(p.bodyLength)
    setFounderCanineLength(p.canineLength)
    setFounderLegLength(p.legLength)
    setFounderEarSize(p.earSize)
    setFounderEarShape(p.earShape)
  }

  function toggleFounderMutation(mutation:MutationKey) {
    setFounderMutations(current=>
      current.includes(mutation)
        ? current.filter(m=>m!==mutation)
        : [...current,mutation]
    )
  }

  function addChild() {
    if (!mother || !father) {
      setStatus('Choose one female and one male parent.')
      return
    }
    try {
      const child = breed(mother,father,state.lineage,undefined,mutationRate,'manual',state.environment)
      const fitness=environmentFitness(child,state.environment)
      setState(s => ({
        ...s,
        individuals:[child,...s.individuals],
        currentGeneration: Math.max(s.currentGeneration,child.generation),
      }))
      setSelectedId(child.id)
      setStatus(`${child.name} survived its litter in ${state.environment.name} · environmental fitness ${percent(fitness)}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Breeding failed.')
    }
  }

  function runAutoBreed() {
    const requested = Math.max(1,Math.floor(autoGenerations))
    const batch = Math.min(requested,5000)
    const breedingPool = state.individuals.filter(a => a.lineage === state.lineage && a.species===breedingSpecies)
    setStatus(`Running ${batch.toLocaleString()} ${breedingSpecies} generations under ${state.environment.name} selection…`)
    try {
      const finalPopulation = autoBreed(
        breedingPool.length >= 2 ? breedingPool : state.individuals.filter(a=>a.species===breedingSpecies),
        batch,
        state.lineage,
        Math.max(4,Math.min(200,Math.floor(populationSize))),
        Math.max(0,Math.min(.25,mutationRate)),
        state.environment,
      )
      const highestGeneration = Math.max(...finalPopulation.map(a => a.generation))
      const avgFit=finalPopulation.reduce((sum,a)=>sum+environmentFitness(a,state.environment),0)/Math.max(1,finalPopulation.length)
      setState(s => ({
        ...s,
        individuals:[...finalPopulation,...s.individuals],
        currentGeneration: Math.max(s.currentGeneration,highestGeneration),
      }))
      setSelectedId(finalPopulation[0]?.id || selectedId)
      setStatus(`Auto Breed completed ${batch.toLocaleString()} generations in ${state.environment.name}. G${highestGeneration.toLocaleString()} mean fitness: ${percent(avgFit)}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Auto Breed failed.')
    }
  }

  function addFounder(event: FormEvent) {
    event.preventDefault()
    const customization:FounderCustomization={
      mutations:founderMutations,
      pattern:founderPattern,
      furLength:founderFurLength,
      tailLength:founderTailLength,
      bodyLength:founderBodyLength,
      canineLength:founderCanineLength,
      legLength:founderLegLength,
      earSize:founderEarSize,
      earShape:founderEarShape,
    }
    const founder = createFounder(founderName.trim() || (founderSpecies==='fox'?'New Fox':'New Cat'),founderSex,founderBreed,state.lineage,.5,customization)
    setState(s => ({...s,individuals:[founder,...s.individuals]}))
    setSelectedId(founder.id)
    setStatus(`${founder.name} added with a customized inherited genome.`)
  }

  function resetSimulation() {
    const fresh = makeInitialState()
    setState(fresh)
    setSelectedId(fresh.individuals[0]?.id || '')
    setStatus('Simulation reset to the five foundation cats.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">FELINE_01 + VULPINE_01 GENOME LAB</div>
          <h1>Genetic Mutator</h1>
          <p>Breed cats and foxes with inherited genomes, mutations, customization, and environment-driven natural selection.</p>
        </div>
        <div className="header-actions">
          <div className="segmented" aria-label="Measurement system">
            <button className={state.units==='imperial'?'active':''} onClick={() => setState(s=>({...s,units:'imperial'}))}>Imperial</button>
            <button className={state.units==='metric'?'active':''} onClick={() => setState(s=>({...s,units:'metric'}))}>Metric</button>
          </div>
          <button className="ghost" onClick={resetSimulation}>Reset</button>
        </div>
      </header>

      <section className="stat-strip">
        <div><span>Animals</span><strong>{state.individuals.length.toLocaleString()}</strong></div>
        <div><span>Generation</span><strong>{state.currentGeneration.toLocaleString()}</strong></div>
        <div><span>Avg. weight</span><strong>{weight(stats.avgWeight,state.units)}</strong></div>
        <div><span>Avg. shoulder</span><strong>{length(stats.avgHeight,state.units)}</strong></div>
        <div><span>Mutation phenotypes</span><strong>{stats.mutationCount}</strong></div>
        <div><span>Mean habitat fitness</span><strong>{percent(stats.avgFitness)}</strong></div>
      </section>

      <main className="main-grid">
        <section className="viewer-panel panel">
          {selected ? (
            <>
              <div className="viewer-3d-heading">
                <div>
                  <span>LIVE 3D PHENOTYPE</span>
                  <strong>{selected.name}</strong>
                </div>
                <small>Phase 8.1.1 cats + foxes · visible cat idle life motion</small>
              </div>
              <Cat3DViewer animal={selected} environment={state.environment} />
              <div className="animal-facts">
                <div><span>Species</span><strong>{selected.species}</strong></div>
                <div><span>Sex</span><strong>{selected.sex}</strong></div>
                <div><span>Generation</span><strong>{selected.generation.toLocaleString()}</strong></div>
                <div><span>Weight</span><strong>{weight(selected.phenotype.weightKg,state.units)}</strong></div>
                <div><span>Shoulder</span><strong>{length(selected.phenotype.shoulderCm,state.units)}</strong></div>
                <div><span>Body length</span><strong>{length(selected.phenotype.bodyLengthCm,state.units)}</strong></div>
                <div><span>Tail length</span><strong>{length(selected.phenotype.tailLengthCm,state.units)}</strong></div>
                <div><span>Canine length</span><strong>{length(selected.phenotype.canineLengthCm,state.units)}</strong></div>
                <div><span>Ears</span><strong>{selected.phenotype.earShape} · {selected.phenotype.earSize.toFixed(2)}×</strong></div>
                <div><span>Habitat fitness</span><strong>{percent(selectedFitness)}</strong></div>
              </div>
              <div className="tag-row">
                <span className="tag species-tag">{selected.species}</span>
                <span className="tag">{selected.lineage}</span>
                <span className="tag">{selected.phenotype.coatName}</span>
                <span className="tag">{selected.phenotype.pattern}</span>
                {selected.phenotype.mutationLabels.map(m => <span className="tag mutation" key={m}>{m}</span>)}
                {selectedAdaptations.map(a=><span className="tag adaptation" key={a}>{a}</span>)}
              </div>
            </>
          ) : <p>No animal selected.</p>}
        </section>

        <aside className="control-stack">
          <section className="panel environment-panel">
            <div className="section-title">
              <div><span>RAISED ENVIRONMENT</span><h2>Natural selection</h2></div>
            </div>
            <p className="helper">The environment does not create directed mutations. Random inherited variation still occurs; this habitat changes which young survive and which adults contribute most strongly to later generations.</p>
            <label>Environment preset
              <select value={ENVIRONMENT_PRESETS.some(p=>p.name===state.environment.name)?state.environment.name:''} onChange={e=>applyEnvironmentPreset(e.target.value)}>
                <option value="">Custom environment</option>
                {ENVIRONMENT_PRESETS.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <div className="two-col">
              <label>Temperature <span className="inline-value">{state.environment.temperatureC}°C</span>
                <input type="range" min="-25" max="45" step="1" value={state.environment.temperatureC} onChange={e=>updateEnvironment({name:'Custom environment',temperatureC:Number(e.target.value)})} />
              </label>
              <label>Terrain
                <select value={state.environment.terrain} onChange={e=>updateEnvironment({name:'Custom environment',terrain:e.target.value as TerrainType})}>
                  <option value="open">Open</option>
                  <option value="forest">Forest</option>
                  <option value="rocky">Rocky</option>
                  <option value="wetland">Wetland</option>
                </select>
              </label>
            </div>
            <label>Food availability <span className="inline-value">{percent(state.environment.foodAvailability)}</span>
              <input type="range" min="0" max="1" step=".01" value={state.environment.foodAvailability} onChange={e=>updateEnvironment({name:'Custom environment',foodAvailability:Number(e.target.value)})} />
            </label>
            <label>Prey speed / chase pressure <span className="inline-value">{percent(state.environment.preySpeed)}</span>
              <input type="range" min="0" max="1" step=".01" value={state.environment.preySpeed} onChange={e=>updateEnvironment({name:'Custom environment',preySpeed:Number(e.target.value)})} />
            </label>
            <label>Vegetation / cover density <span className="inline-value">{percent(state.environment.coverDensity)}</span>
              <input type="range" min="0" max="1" step=".01" value={state.environment.coverDensity} onChange={e=>updateEnvironment({name:'Custom environment',coverDensity:Number(e.target.value)})} />
            </label>
            <label>Natural-selection strength <span className="inline-value">{percent(state.environment.selectionStrength)}</span>
              <input type="range" min="0" max="1" step=".01" value={state.environment.selectionStrength} onChange={e=>updateEnvironment({selectionStrength:Number(e.target.value)})} />
            </label>
          </section>

          <section className="panel">
            <div className="section-title">
              <div><span>MANUAL BREEDING</span><h2>Choose parents</h2></div>
            </div>
            <label>Breeding species
              <select value={breedingSpecies} onChange={e=>{
                const species=e.target.value as Species
                setBreedingSpecies(species)
                setState(s=>({...s,selectedMotherId:undefined,selectedFatherId:undefined}))
              }}>
                <option value="cat">Cats</option>
                <option value="fox">Foxes</option>
              </select>
            </label>
            <label>Female
              <select value={state.selectedMotherId || ''} onChange={e=>setState(s=>({...s,selectedMotherId:e.target.value}))}>
                <option value="">Select female</option>
                {females.map(a=><option key={a.id} value={a.id}>{a.name} · G{a.generation}</option>)}
              </select>
            </label>
            <label>Male
              <select value={state.selectedFatherId || ''} onChange={e=>setState(s=>({...s,selectedFatherId:e.target.value}))}>
                <option value="">Select male</option>
                {males.map(a=><option key={a.id} value={a.id}>{a.name} · G{a.generation}</option>)}
              </select>
            </label>
            <label>Lineage
              <input value={state.lineage} onChange={e=>setState(s=>({...s,lineage:e.target.value || 'Foundation'}))} />
            </label>
            <button className="primary wide" onClick={addChild}>Breed litter + select survivor</button>
          </section>

          <section className="panel">
            <div className="section-title">
              <div><span>AUTOMATED SELECTION</span><h2>Auto Breed</h2></div>
            </div>
            <p className="helper">Each generation produces excess offspring. Survival and breeding rank are weighted by the active environment, so traits can shift over many generations as new random variation appears.</p>
            <div className="two-col">
              <label>Generations
                <input type="number" min="1" value={autoGenerations} onChange={e=>setAutoGenerations(Number(e.target.value)||1)} />
              </label>
              <label>Population
                <input type="number" min="4" max="200" value={populationSize} onChange={e=>setPopulationSize(Number(e.target.value)||24)} />
              </label>
            </div>
            <label>Mutation rate <span className="inline-value">{(mutationRate*100).toFixed(2)}%</span>
              <input type="range" min="0" max=".08" step=".001" value={mutationRate} onChange={e=>setMutationRate(Number(e.target.value))} />
            </label>
            <button className="primary wide" onClick={runAutoBreed}>Start environmental Auto Breed</button>
          </section>

          <section className="panel founder-editor">
            <div className="section-title"><div><span>FOUNDERS</span><h2>Customize unrelated animal</h2></div></div>
            <form onSubmit={addFounder}>
              <label>Name<input value={founderName} onChange={e=>setFounderName(e.target.value)} /></label>
              <div className="two-col">
                <label>Species
                  <select value={founderSpecies} onChange={e=>applyFounderSpecies(e.target.value as Species)}>
                    <option value="cat">Cat</option>
                    <option value="fox">Fox</option>
                  </select>
                </label>
                <label>Sex
                  <select value={founderSex} onChange={e=>setFounderSex(e.target.value as 'male'|'female')}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
              </div>
              <label>Starting type
                <select value={founderBreed} onChange={e=>applyBreedPreset(e.target.value as FounderBreed)}>
                  {BREEDS_BY_SPECIES[founderSpecies].map(breed=><option key={breed} value={breed}>{breed}</option>)}
                </select>
              </label>

              <label>Coat pattern
                <select value={founderPattern} onChange={e=>setFounderPattern(e.target.value as 'auto'|CoatPattern)}>
                  <option value="auto">Breed / genome default</option>
                  <option value="solid">Solid</option>
                  <option value="spotted">Spotted</option>
                  <option value="rosetted">Rosetted</option>
                </select>
              </label>

              <div className="mutation-selector">
                <span>Expressed mutations</span>
                <div className="mutation-grid">
                  {([
                    ['melanism','Melanistic'],
                    ['albinism','Albino'],
                    ['leucism','Leucistic'],
                    ['piebald','Piebald'],
                  ] as [MutationKey,string][]).map(([key,label])=>(
                    <button
                      type="button"
                      key={key}
                      className={founderMutations.includes(key)?'active':''}
                      onClick={()=>toggleFounderMutation(key)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div className="trait-editor-grid">
                <label>Fur length <span className="inline-value">{percent(founderFurLength)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderFurLength} onChange={e=>setFounderFurLength(Number(e.target.value))} />
                </label>
                <label>Tail length <span className="inline-value">{percent(founderTailLength)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderTailLength} onChange={e=>setFounderTailLength(Number(e.target.value))} />
                </label>
                <label>Body length <span className="inline-value">{percent(founderBodyLength)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderBodyLength} onChange={e=>setFounderBodyLength(Number(e.target.value))} />
                </label>
                <label>Canine length <span className="inline-value">{percent(founderCanineLength)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderCanineLength} onChange={e=>setFounderCanineLength(Number(e.target.value))} />
                </label>
                <label>Leg length <span className="inline-value">{percent(founderLegLength)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderLegLength} onChange={e=>setFounderLegLength(Number(e.target.value))} />
                </label>
                <label>Ear size <span className="inline-value">{percent(founderEarSize)}</span>
                  <input type="range" min=".05" max=".98" step=".01" value={founderEarSize} onChange={e=>setFounderEarSize(Number(e.target.value))} />
                </label>
              </div>

              <label>Ear shape
                <select value={founderEarShape} onChange={e=>setFounderEarShape(e.target.value as EarShape)}>
                  <option value="rounded">Rounded</option>
                  <option value="balanced">Balanced</option>
                  <option value="pointed">Long / pointed</option>
                </select>
              </label>

              <p className="helper">These controls seed inherited genes, not permanent presets. Cats use Feline_01 and foxes use Vulpine_01, so they breed only within their own species. Descendants recombine and mutate traits normally; albinism remains epistatic over melanin-dependent coat effects.</p>
              <button className="secondary wide" type="submit">Add customized founder</button>
            </form>
          </section>
        </aside>
      </main>

      <section className="panel population-panel">
        <div className="section-title population-heading">
          <div><span>POPULATION</span><h2>Animals</h2></div>
          <div className="status" aria-live="polite">{status}</div>
        </div>
        <div className="animal-grid">
          {state.individuals.slice(0,120).map(animal => {
            const fitness=environmentFitness(animal,state.environment)
            return (
              <button key={animal.id} className={`animal-card ${animal.id===selected?.id?'selected':''}`} onClick={()=>{
                setSelectedId(animal.id)
                setBreedingSpecies(animal.species)
              }}>
                {animal.species==='fox' ? <FoxPreview animal={animal} compact /> : <CatPreview animal={animal} compact />}
                <div className="card-copy">
                  <strong>{animal.name}</strong>
                  <span>{animal.species} · {animal.sex} · G{animal.generation.toLocaleString()}</span>
                  <span>{weight(animal.phenotype.weightKg,state.units)} · {length(animal.phenotype.shoulderCm,state.units)} shoulder</span>
                  <span>{percent(fitness)} habitat fitness</span>
                  {animal.phenotype.mutationLabels.length > 0 && <span className="mutation-text">{animal.phenotype.mutationLabels.join(', ')}</span>}
                </div>
              </button>
            )
          })}
        </div>
        {state.individuals.length > 120 && <p className="helper">Showing the newest 120 animals to keep the interface responsive. All {state.individuals.length.toLocaleString()} remain saved.</p>}
      </section>
    </div>
  )
}
