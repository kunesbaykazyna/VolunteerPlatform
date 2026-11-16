import { useEffect, useState } from 'react'
import { api, errMsg, fmtDate } from '../api'
import { statusLabel } from '../components/ProjectCard'
import { Pin, Calendar } from '../components/Icons'

export default function MyRegistrations({ user, go, toast }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    api.get(`/api/users/${user.user_id}/applications`)
      .then((r) => setItems(r.data))
      .catch((e) => { toast(errMsg(e), 'error'); setItems([]) })
  }, [user.user_id, toast])

  return (
    <section className="container page">
      <h2>My registrations</h2>
      <p className="muted section-sub">Track the status of the projects you applied to.</p>

      {items === null ? (
        <p className="empty">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <p>You haven't registered for any project yet.</p>
          <button className="btn btn-primary" onClick={() => go('home')}>Browse projects</button>
        </div>
      ) : (
        <div className="grid">
          {items.map((r) => (
            <article className="card project-card" key={r.registration_id}>
              <div className="card-top">
                <span className={`badge cat-${(r.category || 'general').toLowerCase()}`}>{r.category || 'General'}</span>
                <span className={`status status-${r.status}`}>{statusLabel(r.status)}</span>
              </div>
              <h3>{r.title}</h3>
              <ul className="meta">
                <li><Calendar /> {fmtDate(r.start_datetime)}</li>
                <li><Pin /> {r.city}</li>
              </ul>
              {r.note && <p className="note">“{r.note}”</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
