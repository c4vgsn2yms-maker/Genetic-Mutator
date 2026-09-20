export type CatReferenceSource = 'realistic-adult' | 'family'

const SOURCES = {
  'realistic-adult': {
    title:'CAT - Realistic 3D Model',
    src:'https://sketchfab.com/models/db26e7ace5264438bbe6a2f070bc7fcf/embed',
    modelUrl:'https://sketchfab.com/3d-models/cat-realistic-3d-model-db26e7ace5264438bbe6a2f070bc7fcf',
    modelName:'CAT - Realistic 3D Model',
    authorUrl:'https://sketchfab.com/WildMesh_3D',
    author:'WildMesh 3D',
    note:'Adult anatomy reference · not genetics-driven yet',
  },
  family: {
    title:'Cat Family',
    src:'https://sketchfab.com/models/0f2f9b9ac7694ce1b82f5b0cd386d8b1/embed',
    modelUrl:'https://sketchfab.com/3d-models/cat-family-0f2f9b9ac7694ce1b82f5b0cd386d8b1',
    modelName:'Cat Family',
    authorUrl:'https://sketchfab.com/billl90',
    author:'RedDeer',
    note:'Age / family anatomy reference · useful for kitten-to-adult proportions',
  },
} satisfies Record<CatReferenceSource,{
  title:string
  src:string
  modelUrl:string
  modelName:string
  authorUrl:string
  author:string
  note:string
}>

export function SketchfabCatReference({source}:{source:CatReferenceSource}) {
  const item=SOURCES[source]
  return (
    <div className="sketchfab-reference">
      <iframe
        title={item.title}
        src={item.src}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />
      <div className="sketchfab-credit">
        <span>{item.note}</span>
        <span>
          <a href={item.modelUrl} target="_blank" rel="noreferrer nofollow">
            {item.modelName}
          </a>
          {' by '}
          <a href={item.authorUrl} target="_blank" rel="noreferrer nofollow">
            {item.author}
          </a>
          {' on Sketchfab'}
        </span>
      </div>
    </div>
  )
}
