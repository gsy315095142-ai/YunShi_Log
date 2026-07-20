import { CHANGELOG } from '../data/changelog'
import './ChangelogModal.css'

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

export default function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  if (!open) return null

  return (
    <div className="changelog-backdrop" onClick={onClose}>
      <div className="changelog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="changelog-header">
          <h2>更新说明</h2>
          <button type="button" className="changelog-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="changelog-body">
          {CHANGELOG.map((entry) => (
            <section key={entry.version} className="changelog-entry">
              <div className="changelog-version-row">
                <span className="changelog-version">{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </div>
              <h3 className="changelog-title">{entry.title}</h3>
              <ul className="changelog-list">
                {entry.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
