import type { Individual } from '../types'
import { SketchfabCatReference } from './SketchfabCatReference'

export function Cat3DViewer({animal}:{animal:Individual}) {
  return (
    <div className="viewer-3d-shell wildmesh-live-viewer">
      <div className="render-status active">3D BUILD 7.1 · WildMesh realistic cat visual</div>
      <SketchfabCatReference source="realistic-adult" live />
      <div className="viewer-3d-hint">
        Viewing {animal.name} · realistic cat visual active · gait simulation disabled until the actual rigged mesh file is available
      </div>
    </div>
  )
}
