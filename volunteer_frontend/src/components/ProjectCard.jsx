import { useApp } from '../context'
import Icon from './Icon'
import { categoryLabel } from '../categoryLabel'

export default function ProjectCard({ project }) {
  const { t, fmtDate, fmtTime, navigate } = useApp()
  const taken = Number(project.confirmed_count || 0)
  const left = Math.max(project.max_capacity - taken, 0)
  const pct = Math.min(100, Math.round((taken / project.max_capacity) * 100))
  const full = project.status === 'full' || left === 0
  const place = [project.address, project.city].filter(Boolean).join(', ')

  return (
    <article
      className="card project-card"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.project_id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${project.project_id}`)}
    >
      <div className="card-top">
        <span className="chip-tag">{categoryLabel(t, project.category)}</span>
        {full ? <span className="status status-full">{t('full')}</span> : <span className="muted small">{project.organizer_name}</span>}
      </div>
      <h3 className="card-title">{project.title}</h3>
      <p className="card-desc">{project.description}</p>
      <ul className="meta-list">
        <li><Icon name="calendar" /> {fmtDate(project.start_datetime)} · {fmtTime(project.start_datetime)}</li>
        {place && <li><Icon name="pin" /> {place}</li>}
      </ul>
      <div className="card-bottom">
        <div className="capacity-row">
          <span className="capacity-count">
            <Icon name="users" size={16} /> {taken}/{project.max_capacity} {t('volunteers_word')}
          </span>
          <span className="muted small">{t('spots_left', left)}</span>
        </div>
        <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="project-card-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={full || project.status === 'cancelled' || !project.applications_open}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/projects/${project.project_id}`)
          }}
        >
          {t('apply')}
        </button>
      </div>
    </article>
  )
}
