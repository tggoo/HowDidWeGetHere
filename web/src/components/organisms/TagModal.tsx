import { Tags, X } from 'lucide-react'

type TagModalItem = {
  id: string
  slug: string
  name: string
  entryCount: number | string
}

type TagModalModel = {
  label: string
  items: TagModalItem[]
}

type TagModalLabels = {
  closeTags: string
  tags: string
}

type TagModalProps = {
  labels: TagModalLabels
  model: TagModalModel
  selectedTags: string[]
  onClose: () => void
  onToggleTag: (tag: string) => void
}

export function TagModal({ labels, model, onClose, onToggleTag, selectedTags }: TagModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-label={`${model.label} ${labels.tags}`}
        aria-modal="true"
        className="tag-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <span>
            <Tags aria-hidden="true" />
            {model.label}
          </span>
          <button className="panel-close" type="button" aria-label={labels.closeTags} title={labels.closeTags} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="tag-modal-grid">
          {model.items.map((tag) => (
            <button
              className={selectedTags.includes(tag.slug) ? 'tag active' : 'tag'}
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.slug)}
            >
              {tag.name}
              {Number(tag.entryCount) > 0 && <small>{tag.entryCount}</small>}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
