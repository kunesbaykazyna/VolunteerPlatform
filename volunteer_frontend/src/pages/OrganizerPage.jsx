import { useCallback, useEffect, useState } from 'react'
import { api, errMsg, fmtDate } from '../api'
import { statusLabel } from '../components/ProjectCard'

const empty = { title: '', description: '', category: 'Environment', city: '', address: '', start: '', end: '', max_capacity: 10 }

export default function OrganizerPage({ user, toast, onProjectCreated }) {
  const [regs, setRegs] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get(`/api/organizers/${user.user_id}/registrations`)
      .then((r) => setRegs(r.data))
      .catch((e) => { toast(errMsg(e), 'error'); setRegs([]) })
  }, [user.user_id, toast])

  useEffect(load, [load])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/api/projects', {
        organizer_id: user.user_id,
        title: form.title,
        description: form.description,
        category: form.category,
        city: form.city,
        address: form.address,
        start_datetime: form.start,
        end_datetime: form.end,
        max_capacity: Number(form.max_capacity),
      })
      toast('Project published!')
      setForm(empty)
      onProjectCreated()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (id, status) => {
    try {
      await api.patch(`/api/registrations/${id}/status`, { organizer_id: user.user_id, status })
      toast(status === 'confirmed' ? 'Registration approved' : 'Registration declined')
      load()
      onProjectCreated()
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  return (
    <section className="container page">
      <h2>Organizer dashboard</h2>
      <p className="muted section-sub">Publish projects and review volunteer registrations.</p>

      <div className="org-grid">
        <form className="card form" onSubmit={create}>
          <h3>New project</h3>
          <label className="field"><span>Title</span><input value={form.title} onChange={set('title')} required /></label>
          <label className="field"><span>Description</span><textarea rows={3} value={form.description} onChange={set('description')} /></label>
          <div className="two">
            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={set('category')}>
                {['Environment', 'Social', 'Education', 'Animals', 'Health', 'Community'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>Max volunteers</span><input type="number" min={1} value={form.max_capacity} onChange={set('max_capacity')} required /></label>
          </div>
          <div className="two">
            <label className="field"><span>City</span><input value={form.city} onChange={set('city')} required /></label>
            <label className="field"><span>Address</span><input value={form.address} onChange={set('address')} /></label>
          </div>
          <div className="two">
            <label className="field"><span>Starts</span><input type="datetime-local" value={form.start} onChange={set('start')} required /></label>
            <label className="field"><span>Ends</span><input type="datetime-local" value={form.end} onChange={set('end')} required /></label>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish project'}</button>
        </form>

        <div>
          <h3 className="list-title">Registrations</h3>
          {regs === null ? (
            <p className="empty">Loading…</p>
          ) : regs.length === 0 ? (
            <p className="empty">No registrations yet.</p>
          ) : (
            <div className="reg-list">
              {regs.map((r) => (
                <div className="card reg" key={r.registration_id}>
                  <div className="reg-head">
                    <div>
                      <strong>{r.volunteer_name}</strong>
                      <div className="muted small">{r.volunteer_email} · {fmtDate(r.registered_at)}</div>
                    </div>
                    <span className={`status status-${r.status}`}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="small">Project: <strong>{r.project_title}</strong></div>
                  {r.note && <p className="note">“{r.note}”</p>}
                  {r.status === 'pending' && (
                    <div className="reg-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => decide(r.registration_id, 'confirmed')}>Approve</button>
                      <button className="btn btn-outline btn-sm" onClick={() => decide(r.registration_id, 'cancelled')}>Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
