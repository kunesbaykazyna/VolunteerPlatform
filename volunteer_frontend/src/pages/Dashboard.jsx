import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { CATEGORIES } from '../i18n'
import { errorText } from '../api'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'

const LOCAL = {
  en: {
    pending_banner: 'Your request to join the company is waiting for confirmation by the super organizer.',
    team_title: 'Company team',
    invite_label: 'Invite code for colleagues',
    copy_code: 'Copy',
    code_copied: 'Invite code copied',
    super_badge: 'Super organizer',
    member_badge: 'Organizer',
    pending_badge: 'Pending approval',
    approve_member: 'Approve',
    make_super: 'Make super',
    remove_member: 'Remove',
    member_updated: 'Team updated',
    author_label: 'Author',
    confirm_super: 'Transfer the super organizer role to this colleague? You will become a regular organizer.',
  },
  ru: {
    pending_banner: 'Ваш запрос на присоединение к компании ожидает подтверждения от главного (супер) организатора.',
    team_title: 'Команда компании',
    invite_label: 'Код приглашения для коллег',
    copy_code: 'Копировать',
    code_copied: 'Код приглашения скопирован',
    super_badge: 'Супер-организатор',
    member_badge: 'Организатор',
    pending_badge: 'Ожидает подтверждения',
    approve_member: 'Подтвердить',
    make_super: 'Сделать главным',
    remove_member: 'Удалить',
    member_updated: 'Состав команды обновлён',
    author_label: 'Автор',
    confirm_super: 'Передать права главного (супер) организатора этому коллеге? Вы станете обычным организатором.',
  },
  kz: {
    pending_banner: 'Ұйымға қосылу сұрауыңыз бас ұйымдастырушының растауын күтуде.',
    team_title: 'Ұйым командасы',
    invite_label: 'Әріптестерге арналған шақыру коды',
    copy_code: 'Көшіру',
    code_copied: 'Шақыру коды көшірілді',
    super_badge: 'Супер-ұйымдастырушы',
    member_badge: 'Ұйымдастырушы',
    pending_badge: 'Растауды күтуде',
    approve_member: 'Растау',
    make_super: 'Бас ету',
    remove_member: 'Өшіру',
    member_updated: 'Команда жаңартылды',
    author_label: 'Авторы',
    confirm_super: 'Бас ұйымдастырушы рөлін осы әріптеске бересіз бе? Сіз қарапайым ұйымдастырушы боласыз.',
  },
}

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
        await api.put(`/api/projects/${project.project_id}`, { ...payload, version: project.version })
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
      if (err.response?.status === 409) onSaved()
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
  const { t, lang, api, user, updateUser, fmtDate, fmtTime, showToast } = useApp()
  const [projects, setProjects] = useState([])
  const [apps, setApps] = useState([])
  const [orgInfo, setOrgInfo] = useState(null)
  const [members, setMembers] = useState([])
  const [state, setState] = useState('loading')
  const [open, setOpen] = useState(null)
  const [modal, setModal] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busyProject, setBusyProject] = useState(null)

  const lt = (k) => (LOCAL[lang] || LOCAL.en)[k]

  const load = useCallback(async () => {
    try {
      const [p, a, m] = await Promise.all([
        api.get(`/api/organizers/${user.user_id}/projects`),
        api.get(`/api/organizers/${user.user_id}/applications`),
        api.get('/api/organization/members'),
      ])
      setProjects(p.data)
      setApps(a.data)
      setOrgInfo(m.data.organization)
      setMembers(m.data.members || [])
      if (m.data.organization) {
        updateUser({
          org_role: m.data.organization.org_role,
          org_status: m.data.organization.org_status,
          company_name: m.data.organization.company_name,
        })
      }
      setState('ready')
    } catch {
      setState('error')
    }
  }, [api, updateUser, user.user_id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const orgRole = orgInfo?.org_role || user.org_role
  const orgStatus = orgInfo?.org_status || user.org_status
  const isSuper = orgRole === 'super_organizer'
  const isPendingMember = orgStatus === 'pending'

  const setStatus = async (regId, status, rejectionReason, expectedStatus) => {
    try {
      await api.put(`/api/applications/${regId}/status`, {
        status,
        rejection_reason: rejectionReason,
        expected_status: expectedStatus,
      })
      showToast(t('application_updated'))
      await load()
    } catch (e) {
      showToast(errorText(e, t('load_error')), 'error')
      if (e.response?.status === 409) await load()
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

  const handleMemberAction = async (targetUserId, action) => {
    if (action === 'make_super' && !window.confirm(lt('confirm_super'))) return
    try {
      await api.post(`/api/organization/members/${targetUserId}`, { action })
      showToast(lt('member_updated'))
      if (action === 'make_super') updateUser({ org_role: 'organizer' })
      await load()
    } catch (e) {
      showToast(errorText(e, t('load_error')), 'error')
    }
  }

  const copyInviteCode = async () => {
    if (!orgInfo?.invite_code) return
    try {
      await navigator.clipboard.writeText(orgInfo.invite_code)
      showToast(lt('code_copied'))
    } catch {
      showToast(orgInfo.invite_code)
    }
  }

  const approvedTotal = apps.filter((a) => a.status === 'confirmed').length
  const waitingTotal = apps.filter((a) => a.status === 'pending').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('dash_title')}</h1>
          <p className="page-sub">{orgInfo?.company_name ? `${orgInfo.company_name} · ${t('dash_sub')}` : t('dash_sub')}</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setModal(true)} disabled={user.email_verified === false || isPendingMember}>
          <Icon name="plus" /> {t('new_project')}
        </button>
      </div>

      {isPendingMember && (
        <p className="notice error" role="status" style={{ marginBottom: 24 }}>{lt('pending_banner')}</p>
      )}

      <div className="stats">
        <div className="stat"><strong>{projects.length}</strong><span>{t('stat_projects')}</span></div>
        <div className="stat"><strong>{approvedTotal}</strong><span>{t('stat_approved')}</span></div>
        <div className="stat stat-accent"><strong>{waitingTotal}</strong><span>{t('stat_waiting')}</span></div>
      </div>

      {orgInfo && !isPendingMember && (
        <section className="card team-card">
          <div className="team-head">
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>{lt('team_title')}</h2>
              <span className="muted small">{orgInfo.company_name}</span>
            </div>
            {isSuper && orgInfo.invite_code && (
              <div className="invite-box">
                <span className="muted small">{lt('invite_label')}:</span>
                <code className="invite-code">{orgInfo.invite_code}</code>
                <button type="button" className="btn btn-outline btn-xs" onClick={copyInviteCode}>{lt('copy_code')}</button>
              </div>
            )}
          </div>
          <div className="applicants">
            {members.map((m) => (
              <div key={m.user_id} className="applicant">
                <div className="applicant-info">
                  <div className="applicant-name">
                    <Avatar name={m.full_name} src={m.avatar_url} size="sm" />
                    <strong>{m.full_name}</strong>
                    <span className={`status ${m.org_role === 'super_organizer' ? 'status-confirmed' : ''}`}>
                      {m.org_role === 'super_organizer' ? lt('super_badge') : lt('member_badge')}
                    </span>
                    {m.status === 'pending' && <span className="badge-new">{lt('pending_badge')}</span>}
                  </div>
                  <span className="muted small">{m.email}</span>
                </div>
                {isSuper && String(m.user_id) !== String(user.user_id) && (
                  <div className="applicant-actions">
                    {m.status === 'pending' && (
                      <button className="btn btn-primary btn-xs" onClick={() => handleMemberAction(m.user_id, 'approve')}>
                        <Icon name="check" size={14} /> {lt('approve_member')}
                      </button>
                    )}
                    {m.status === 'active' && (
                      <button className="btn btn-outline btn-xs" onClick={() => handleMemberAction(m.user_id, 'make_super')}>
                        {lt('make_super')}
                      </button>
                    )}
                    <button className="btn btn-danger btn-xs" onClick={() => handleMemberAction(m.user_id, 'remove')}>
                      {lt('remove_member')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="section-title">{t('my_projects')}</h2>
      {state === 'loading' && <p className="muted">{t('loading')}</p>}
      {state === 'error' && <p className="notice error">{t('load_error')}</p>}
      {state === 'ready' && projects.length === 0 && !isPendingMember && <p className="muted empty">{t('no_projects_org')}</p>}

      <div className="grid grid-2">
        {projects.map((p) => {
          const list = apps.filter((a) => a.project_id === p.project_id)
          const pending = list.filter((a) => a.status === 'pending').length
          const confirmed = list.filter((a) => a.status === 'confirmed').length
          const isOpen = open === p.project_id
          const canManageProject = isSuper || String(p.organizer_id) === String(user.user_id)
          return (
            <article key={p.project_id} className="card org-card">
              <div className="card-top">
                <h3 className="card-title"><a href={`#/projects/${p.project_id}`}>{p.title}</a></h3>
                <div className="card-badges">
                  {p.status === 'cancelled' && <span className="status status-cancelled">{t('cancelled_badge')}</span>}
                  {pending > 0 && <span className="badge-new">{t('new_badge', pending)}</span>}
                </div>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{lt('author_label')}: {p.organizer_name}</p>
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
                  {canManageProject && (
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
                            <button className="btn btn-primary btn-xs" onClick={() => setStatus(a.registration_id, 'confirmed', undefined, a.status)}><Icon name="check" size={14} /> {t('approve')}</button>
                            <button className="btn btn-outline btn-xs" onClick={() => setRejecting({ id: a.registration_id, expectedStatus: a.status })}><Icon name="x" size={14} /> {t('reject')}</button>
                          </>
                        )}
                        {p.status !== 'cancelled' && (a.status === 'confirmed' || a.status === 'cancelled') && (
                          <button className="btn btn-outline btn-xs" onClick={() => setStatus(a.registration_id, 'pending', undefined, a.status)}>{t('reopen')}</button>
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
          key={`${editing.project_id}-${editing.version || 1}`}
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
            await setStatus(rejecting.id, 'cancelled', reason, rejecting.expectedStatus)
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}