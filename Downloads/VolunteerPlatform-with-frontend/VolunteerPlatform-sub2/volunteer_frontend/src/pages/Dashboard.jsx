import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { CATEGORIES } from '../i18n'
import { errorText } from '../api'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'

function RejectModal({ onClose, onConfirm }) {
  const { t } = useApp()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const value = reason.trim()
    if (value.length < 5 || value.length > 500) return setError(t('rejection_length_error'))
    onConfirm(value)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <div className="modal-head"><h2 className="section-title">{t('reject_title')}</h2><button type="button" className="icon-btn" onClick={onClose}><Icon name="x" /></button></div>
        <label className="field"><span className="field-label">{t('rejection_reason')}</span><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required /></label>
        <div className="counter">{reason.length}/500</div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button><button className="btn btn-primary">{t('reject')}</button></div>
      </form>
    </div>
  )
}

function MotivationText({ text }) {
  const { t } = useApp()
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 180
  return (
    <span className="motivation-text">
      {expanded || !long ? text : `${text.slice(0, 180)}…`}
      {long && <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)}>{expanded ? t('show_less') : t('show_more')}</button>}
    </span>
  )
}

const EMPTY_FORM = {
  title: '', description: '', address: '', city: 'Almaty', category: 'Environment',
  start_datetime: '', end_datetime: '', max_capacity: 10,
}

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function NewProjectModal({ project, approvedCount = 0, onClose, onSaved }) {
  const { t, api, showToast } = useApp()
  const [form, setForm] = useState(() => project ? {
    title: project.title || '',
    description: project.description || '',
    address: project.address || '',
    city: project.city || '',
    category: project.category || 'General',
    start_datetime: localDateTime(project.start_datetime),
    end_datetime: localDateTime(project.end_datetime),
    max_capacity: project.max_capacity,
  } : EMPTY_FORM)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.title || !form.start_datetime || !form.end_datetime) return setError(t('err_fill'))
    if (new Date(form.end_datetime) <= new Date(form.start_datetime)) return setError(t('err_dates'))
    const capacity = Number(form.max_capacity)
    if (!Number.isInteger(capacity) || capacity < 1) return setError(t('capacity_integer_error'))
    if (capacity < approvedCount) return setError(t('capacity_approved_error'))
    setBusy(true)
    try {
      const payload = { ...form, max_capacity: Number(form.max_capacity) }
      if (project) {
        await api.put(`/api/projects/${project.project_id}`, payload)
        showToast(t('project_updated'))
      } else {
        await api.post('/api/projects', payload)
        showToast(t('created_ok'))
      }
      onSaved()
    } catch (err) {
      const message = errorText(err, t('project_action_error'))
      setError(message)
      showToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2 className="section-title">{t(project ? 'edit_project' : 'new_project')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('cancel')}><Icon name="x" /></button>
        </div>
        <label className="field"><span className="field-label">{t('f_title')}</span><input value={form.title} onChange={set('title')} maxLength={100} /></label>
        <label className="field"><span className="field-label">{t('f_desc')}</span><textarea rows={3} value={form.description} onChange={set('description')} /></label>
        <div className="two-col">
          <label className="field"><span className="field-label">{t('f_address')}</span><input value={form.address} onChange={set('address')} /></label>
          <label className="field"><span className="field-label">{t('f_city')}</span><input value={form.city} onChange={set('city')} /></label>
        </div>
        <div className="two-col">
          <label className="field"><span className="field-label">{t('f_category')}</span>
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">{t('f_capacity')}</span><input type="number" min={Math.max(1, approvedCount)} step="1" value={form.max_capacity} onChange={set('max_capacity')} /></label>
        </div>
        <div className="two-col">
          <label className="field"><span className="field-label">{t('f_start')}</span><input type="datetime-local" value={form.start_datetime} onChange={set('start_datetime')} /></label>
          <label className="field"><span className="field-label">{t('f_end')}</span><input type="datetime-local" value={form.end_datetime} onChange={set('end_datetime')} /></label>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={busy}>{t(project ? 'save' : 'create')}</button>
        </div>
      </form>
    </div>
  )
}

function ProjectConfirmModal({ mode, projectTitle, onClose, onConfirm }) {
  const { t } = useApp()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const cancel = mode === 'cancel'
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    const succeeded = await onConfirm(cancel ? reason.trim() : undefined)
    setBusy(false)
    if (succeeded) onClose()
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <div className="modal-head">
          <h2 className="section-title">{t(cancel ? 'cancel_project_title' : 'delete_project_title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('cancel')}><Icon name="x" /></button>
        </div>
        <strong>{projectTitle}</strong>
        <p className={cancel ? 'muted' : 'notice error'}>{t(cancel ? 'cancel_project_prompt' : 'delete_project_warning')}</p>
        {cancel && (
          <label className="field">
            <span className="field-label">{t('cancellation_reason_optional')}</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-danger" disabled={busy}>{t(cancel ? 'cancel_project_confirm' : 'delete')}</button>
        </div>
      </form>
    </div>
  )
}

export default function Dashboard() {
  const { t, api, user, fmtDate, fmtTime, showToast } = useApp()
  const [projects, setProjects] = useState([])
  const [apps, setApps] = useState([])
  const [state, setState] = useState('loading')
  const [open, setOpen] = useState(null)
  const [modal, setModal] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busyProject, setBusyProject] = useState(null)

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        api.get(`/api/organizers/${user.user_id}/projects`),
        api.get(`/api/organizers/${user.user_id}/applications`),
      ])
      setProjects(p.data)
      setApps(a.data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [api, user.user_id])

  // Initial dashboard load is intentionally triggered once with the authenticated organizer.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const setStatus = async (regId, status, rejectionReason) => {
    try {
      await api.put(`/api/applications/${regId}/status`, { status, rejection_reason: rejectionReason })
      showToast(t('application_updated'))
      await load()
    } catch (e) {
      showToast(errorText(e, t('load_error')), 'error')
    }
  }

  const updateApplicationAccess = async (project) => {
    setBusyProject(project.project_id)
    try {
      await api.put(`/api/projects/${project.project_id}/applications`, { is_open: !project.applications_open })
      showToast(t(project.applications_open ? 'applications_closed_ok' : 'applications_opened_ok'))
      await load()
    } catch (e) {
      showToast(errorText(e, t('project_action_error')), 'error')
    } finally {
      setBusyProject(null)
    }
  }

  const confirmProjectAction = async (reason) => {
    const { project, mode } = confirming
    try {
      if (mode === 'cancel') {
        await api.put(`/api/projects/${project.project_id}/cancel`, { reason })
        showToast(t('project_cancelled_ok'))
      } else {
        await api.delete(`/api/projects/${project.project_id}`)
        showToast(t('project_deleted_ok'))
      }
      await load()
      return true
    } catch (e) {
      showToast(errorText(e, t('project_action_error')), 'error')
      return false
    }
  }

  const approvedTotal = apps.filter((a) => a.status === 'confirmed').length
  const waitingTotal = apps.filter((a) => a.status === 'pending').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('dash_title')}</h1>
          <p className="page-sub">{t('dash_sub')}</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setModal(true)} disabled={user.email_verified === false}>
          <Icon name="plus" /> {t('new_project')}
        </button>
      </div>

      <div className="stats">
        <div className="stat"><strong>{projects.length}</strong><span>{t('stat_projects')}</span></div>
        <div className="stat"><strong>{approvedTotal}</strong><span>{t('stat_approved')}</span></div>
        <div className="stat stat-accent"><strong>{waitingTotal}</strong><span>{t('stat_waiting')}</span></div>
      </div>

      <h2 className="section-title">{t('my_projects')}</h2>
      {state === 'loading' && <p className="muted">{t('loading')}</p>}
      {state === 'error' && <p className="notice error">{t('load_error')}</p>}
      {state === 'ready' && projects.length === 0 && <p className="muted empty">{t('no_projects_org')}</p>}

      <div className="grid grid-2">
        {projects.map((p) => {
          const list = apps.filter((a) => a.project_id === p.project_id)
          const pending = list.filter((a) => a.status === 'pending').length
          const confirmed = list.filter((a) => a.status === 'confirmed').length
          const isOpen = open === p.project_id
          return (
            <article key={p.project_id} className="card org-card">
              <div className="card-top">
                <h3 className="card-title"><a href={`#/projects/${p.project_id}`}>{p.title}</a></h3>
                <div className="card-badges">
                  {p.status === 'cancelled' && <span className="status status-cancelled">{t('cancelled_badge')}</span>}
                  {pending > 0 && <span className="badge-new">{t('new_badge', pending)}</span>}
                </div>
              </div>
              <ul className="meta-row">
                <li><Icon name="calendar" /> {fmtDate(p.start_datetime)}</li>
                <li><Icon name="clock" /> {fmtTime(p.start_datetime)}</li>
                <li><Icon name="pin" /> {[p.address, p.city].filter(Boolean).join(', ')}</li>
              </ul>
              <div className="org-foot">
                <span className="capacity-count"><Icon name="users" size={16} /> {t('approved_of', confirmed, p.max_capacity)}</span>
                <div className="org-actions">
                  <button className="link-btn" onClick={() => setOpen(isOpen ? null : p.project_id)}>
                    {isOpen ? t('hide') : t('show')} <Icon name="chevron" size={16} className={isOpen ? 'flip' : ''} />
                  </button>
                  {String(p.organizer_id) === String(user.user_id) && (
                    <>
                      <button className="btn btn-outline btn-xs" onClick={() => setEditing(p)}>{t('edit')}</button>
                      <button
                        className="btn btn-outline btn-xs"
                        disabled={busyProject === p.project_id || p.status === 'cancelled'}
                        role="switch"
                        aria-checked={Boolean(p.applications_open)}
                        onClick={() => updateApplicationAccess(p)}
                      >
                        {t(p.applications_open ? 'close_applications' : 'open_applications')}
                      </button>
                      {p.status !== 'cancelled' && <button className="btn btn-outline btn-xs" onClick={() => setConfirming({ project: p, mode: 'cancel' })}>{t('cancel_project')}</button>}
                      <button className="btn btn-danger btn-xs" onClick={() => setConfirming({ project: p, mode: 'delete' })}>{t('delete')}</button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="applicants">
                  {list.length === 0 && <p className="muted small">{t('no_applicants')}</p>}
                  {list.map((a) => (
                    <div key={a.registration_id} className="applicant">
                      <div className="applicant-info">
                        <div className="applicant-name"><Avatar name={a.volunteer_name} src={a.volunteer_avatar_url} size="sm" /><strong>{a.volunteer_name}</strong></div>
                        <span className="muted small">{a.volunteer_email}{a.volunteer_phone ? ` · ${a.volunteer_phone}` : ''}</span>
                        {a.skills && <span className="muted small">{a.skills}</span>}
                        {a.motivation && <MotivationText text={a.motivation} />}
                      </div>
                      <div className="applicant-actions">
                        <span className={`status status-${a.status}`}>{t(`st_${a.status}`)}</span>
                        {a.status === 'pending' && p.status !== 'cancelled' && (
                          <>
                            <button className="btn btn-primary btn-xs" onClick={() => setStatus(a.registration_id, 'confirmed')}><Icon name="check" size={14} /> {t('approve')}</button>
                            <button className="btn btn-outline btn-xs" onClick={() => setRejecting(a.registration_id)}><Icon name="x" size={14} /> {t('reject')}</button>
                          </>
                        )}
                        {p.status !== 'cancelled' && (a.status === 'confirmed' || a.status === 'cancelled') && (
                          <button className="btn btn-outline btn-xs" onClick={() => setStatus(a.registration_id, 'pending')}>{t('reopen')}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {modal && <NewProjectModal onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
      {editing && (
        <NewProjectModal
          key={editing.project_id}
          project={editing}
          approvedCount={apps.filter((a) => a.project_id === editing.project_id && ['confirmed', 'attended'].includes(a.status)).length}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
      {confirming && (
        <ProjectConfirmModal
          mode={confirming.mode}
          projectTitle={confirming.project.title}
          onClose={() => setConfirming(null)}
          onConfirm={confirmProjectAction}
        />
      )}
      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await setStatus(rejecting, 'cancelled', reason)
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}
