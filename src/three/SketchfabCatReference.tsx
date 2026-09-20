export function SketchfabCatReference() {
  return (
    <div className="sketchfab-reference">
      <iframe
        title="CAT - Realistic 3D Model"
        src="https://sketchfab.com/models/db26e7ace5264438bbe6a2f070bc7fcf/embed"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />
      <div className="sketchfab-credit">
        <span>Realistic anatomy reference · not genetics-driven yet</span>
        <span>
          <a
            href="https://sketchfab.com/3d-models/cat-realistic-3d-model-db26e7ace5264438bbe6a2f070bc7fcf"
            target="_blank"
            rel="noreferrer nofollow"
          >
            CAT - Realistic 3D Model
          </a>
          {' by '}
          <a
            href="https://sketchfab.com/WildMesh_3D"
            target="_blank"
            rel="noreferrer nofollow"
          >
            WildMesh 3D
          </a>
          {' on Sketchfab'}
        </span>
      </div>
    </div>
  )
}
