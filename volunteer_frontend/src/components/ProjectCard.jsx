import { Pin, Calendar, Users } from './Icons'
import { fmtDate, fmtTime } from '../api'

export default function ProjectCard({ project, myStatus, onRegister, canRegister }) {
  const left = Math.max(project.max_capacity - Number(project.taken || 0), 0)
  const full = left === 0
  const cat = (project.category || 'General').toLowerCase()

  let action
  if (myStatus) {
    action = <span className={`status status-${myStatus}`}>{statusLabel(myStatus)}</span>
  } else if (full) {
    action = <button className="btn btn-outline btn-block" disabled>Project is full</button>
  } else if (!canRegister) {
    action = <button className="btn btn-outline btn-block" disabled>Volunteer accounts only</button>
  } else {
    action = <button className="btn btn-primary btn-block" onClick={() => onRegister(project)}>Register</button>
  }

  return (
    <article className="card project-card">
      <div className="card-top">
        <span className={`badge cat-${cat}`}>{project.category || 'General'}</span>
        <span className="muted small">{full ? 'Full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}</span>
      </div>
      <h3>{project.title}</h3>
      <p className="card-desc">{project.description}</p>
      <ul className="meta">
        <li><Calendar /> {fmtDate(project.start_datetime)} · {fmtTime(project.start_datetime)}–{fmtTime(project.end_datetime)}</li>
        <li><Pin /> {[project.address, project.city].filter(Boolean).join(', ')}</li>
        <li><Users /> Organized by {project.organizer_name}</li>
      </ul>
      <div className="card-action">{action}</div>
    </article>
  )
}

export function statusLabel(s) {
  if (s === 'confirmed') return 'Approved'
  if (s === 'cancelled') return 'Declined'
  return 'Pending review'
}
