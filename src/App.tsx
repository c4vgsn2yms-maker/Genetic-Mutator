import { FormEvent, useEffect, useMemo, useState } from 'react'
import { autoBreed, breed, createFounder, type FounderBreed } from './genetics'
import { CatPreview } from './CatPreview'
import { Cat3DViewer } from './three/Cat3DViewer'
import type { Individual, SimulationState } from './types'

const STORAGE_KEY = 'genetic-mutator-v1'

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
  }
}

function loadState(): SimulationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeInitialState()
    const parsed = JSON.parse(raw) as SimulationState
    if (!Array.isArray(parsed.individuals) || !parsed.individuals.length) return makeInitialState()
    return parsed
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

export function App() {
  const [state, setState] = useState<SimulationState>(loadState)
  const [selectedId, setSelectedId] = useState<string>(() => loadState().individuals[0]?.id || '')
  const [status, setStatus] = useState('Ready')
  const [autoGenerations, setAutoGenerations] = useState(10)
  const [populationSize, setPopulationSize] = useState(24)
  const [mutationRate, setMutationRate] = useState(.012)
  const [founderName, setFounderName] = useState('New Founder')
  const [founderSex, setFounderSex] = useState<'male'|'female'>('female')
  const [founderBreed, setFounderBreed] = useState<FounderBreed>('Custom')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const selected = state.individuals.find(a => a.id === selectedId) || state.individuals[0]
  const females = state.individuals.filter(a => a.sex === 'female')
  const males = state.individuals.filter(a => a.sex === 'male')
  const mother = females.find(a => a.id === state.selectedMotherId)
  const father = males.find(a => a.id === state.selectedFatherId)

  const stats = useMemo(() => {
    const animals = state.individuals
    const avgWeight = animals.reduce((sum,a) => sum + a.phenotype.weightKg,0) / Math.max(1,animals.length)
    const avgHeight = animals.reduce((sum,a) => sum + a.phenotype.shoulderCm,0) / Math.max(1,animals.length)
    const largest = [...animals].sort((a,b) => b.phenotype.weightKg-a.phenotype.weightKg)[0]
    const mutationCount = animals.filter(a => a.phenotype.mutationLabels.length).length
    return {avgWeight,avgHeight,largest,mutationCount}
  }, [state.individuals])

  function addChild() {
    if (!mother || !father) {
      setStatus('Choose one female and one male parent.')
      return
    }
    try {
      const child = breed(mother,father,state.lineage,undefined,mutationRate)
      setState(s => ({
        ...s,
        individuals:[child,...s.individuals],
        currentGeneration: Math.max(s.currentGeneration,child.generation),
      }))
      setSelectedId(child.id)
      setStatus(`${child.name} was born in generation ${child.generation}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Breeding failed.')
    }
  }

  function runAutoBreed() {
    const requested = Math.max(1,Math.floor(autoGenerations))
    const batch = Math.min(requested,5000)
    const breedingPool = state.individuals.filter(a => a.lineage === state.lineage)
    setStatus(`Running ${batch.toLocaleString()} generations…`)
    try {
      const finalPopulation = autoBreed(
        breedingPool.length >= 2 ? breedingPool : state.individuals,
        batch,
        state.lineage,
        Math.max(4,Math.min(200,Math.floor(populationSize))),
        Math.max(0,Math.min(.25,mutationRate)),
      )
      const highestGeneration = Math.max(...finalPopulation.map(a => a.generation))
      setState(s => ({
        ...s,
        individuals:[...finalPopulation,...s.individuals],
        currentGeneration: Math.max(s.currentGeneration,highestGeneration),
      }))
      setSelectedId(finalPopulation[0]?.id || selectedId)
      setStatus(`Auto Breed completed ${batch.toLocaleString()} generations. The lineage is now at generation ${highestGeneration.toLocaleString()}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Auto Breed failed.')
    }
  }

  function addFounder(event: FormEvent) {
    event.preventDefault()
    const founder = createFounder(founderName.trim() || 'Founder',founderSex,founderBreed,state.lineage)
    setState(s => ({...s,individuals:[founder,...s.individuals]}))
    setSelectedId(founder.id)
    setStatus(`${founder.name} added as a new unrelated founder.`)
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
          <div className="eyebrow">FELINE_01 GENOME LAB</div>
          <h1>Genetic Mutator</h1>
          <p>Breed real inherited genomes, select across generations, and watch phenotype change.</p>
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
                <small>Phase 5 habitat + expanded anatomy rig</small>
              </div>
              <Cat3DViewer animal={selected} />
              <div className="animal-facts">
                <div><span>Sex</span><strong>{selected.sex}</strong></div>
                <div><span>Generation</span><strong>{selected.generation.toLocaleString()}</strong></div>
                <div><span>Weight</span><strong>{weight(selected.phenotype.weightKg,state.units)}</strong></div>
                <div><span>Shoulder</span><strong>{length(selected.phenotype.shoulderCm,state.units)}</strong></div>
                <div><span>Body length</span><strong>{length(selected.phenotype.bodyLengthCm,state.units)}</strong></div>
                <div><span>Tail length</span><strong>{length(selected.phenotype.tailLengthCm,state.units)}</strong></div>
              </div>
              <div className="tag-row">
                <span className="tag">{selected.lineage}</span>
                <span className="tag">{selected.phenotype.coatName}</span>
                <span className="tag">{selected.phenotype.pattern}</span>
                {selected.phenotype.mutationLabels.map(m => <span className="tag mutation" key={m}>{m}</span>)}
              </div>
            </>
          ) : <p>No animal selected.</p>}
        </section>

        <aside className="control-stack">
          <section className="panel">
            <div className="section-title">
              <div><span>MANUAL BREEDING</span><h2>Choose parents</h2></div>
            </div>
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
            <button className="primary wide" onClick={addChild}>Breed one offspring</button>
          </section>

          <section className="panel">
            <div className="section-title">
              <div><span>AUTOMATED SELECTION</span><h2>Auto Breed</h2></div>
            </div>
            <p className="helper">Current selection goal: larger body mass while retaining multiple breeders. Batch runs are limited to 5,000 generations for browser responsiveness; generation numbering itself is not capped.</p>
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
            <button className="primary wide" onClick={runAutoBreed}>Start Auto Breed</button>
          </section>

          <section className="panel">
            <div className="section-title"><div><span>FOUNDERS</span><h2>Add unrelated animal</h2></div></div>
            <form onSubmit={addFounder}>
              <label>Name<input value={founderName} onChange={e=>setFounderName(e.target.value)} /></label>
              <div className="two-col">
                <label>Sex
                  <select value={founderSex} onChange={e=>setFounderSex(e.target.value as 'male'|'female')}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
                <label>Starting type
                  <select value={founderBreed} onChange={e=>setFounderBreed(e.target.value as FounderBreed)}>
                    <option>Bengal</option><option>Maine Coon</option><option>Siberian</option><option>Custom</option>
                  </select>
                </label>
              </div>
              <button className="secondary wide" type="submit">Add founder</button>
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
          {state.individuals.slice(0,120).map(animal => (
            <button key={animal.id} className={`animal-card ${animal.id===selected?.id?'selected':''}`} onClick={()=>setSelectedId(animal.id)}>
              <CatPreview animal={animal} compact />
              <div className="card-copy">
                <strong>{animal.name}</strong>
                <span>{animal.sex} · G{animal.generation.toLocaleString()}</span>
                <span>{weight(animal.phenotype.weightKg,state.units)} · {length(animal.phenotype.shoulderCm,state.units)} shoulder</span>
                {animal.phenotype.mutationLabels.length > 0 && <span className="mutation-text">{animal.phenotype.mutationLabels.join(', ')}</span>}
              </div>
            </button>
          ))}
        </div>
        {state.individuals.length > 120 && <p className="helper">Showing the newest 120 animals to keep the interface responsive. All {state.individuals.length.toLocaleString()} remain saved.</p>}
      </section>
    </div>
  )
}
