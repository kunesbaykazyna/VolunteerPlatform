import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { errorText } from '../api'
import Icon from '../components/Icon'
import { categoryLabel } from '../categoryLabel'
import { VerificationResend } from './AuthFlows'

export default function ProjectDetail({ id }) {
  const { t, api, user, fmtDate, fmtTime, showToast } = useApp()
  const [project, setProject] = useState(null)
  const [state, setState] = useState('loading')
  const [myApp, setMyApp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [motivation, setMotivation] = useState('')
  const [organizer, setOrganizer] = useState(null)

  const load = useCallback(() => {
    api.get(`/api/projects/${id}`)
      .then((r) => { setProject(r.data); setState('ready') })
      .catch((e) => setState(e.response?.status === 404 ? 'missing' : 'error'))
  }, [api, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!project?.organizer_id) return
    api.get(`/api/organizers/${project.organizer_id}/public`)
      .then((r) => setOrganizer(r.data))
      .catch(() => setOrganizer(null))
  }, [api, project])

  // has this volunteer already applied?
  useEffect(() => {
    if (user?.role !== 'volunteer') return
    api.get(`/api/users/${user.user_id}/applications`)
      .then((r) => setMyApp(r.data.find((a) => String(a.project_id) === String(id)) || null))
      .catch(() => {})
  }, [api, user, id])

  const apply = async () => {
    const value = motivation.trim()
    if (value.length < 20 || value.length > 1000) {
      showToast(t('motivation_length_error'), 'error')
      return
    }
    setBusy(true)
    try {
      await api.post(`/api/projects/${id}/apply`, { motivation: value })
      showToast(t('apply_ok'))
      setMyApp({ status: 'pending', motivation: value })
      load()
    } catch (e) {
      const msg = errorText(e, '')
      if (/duplicate|already|uq_user_project/i.test(msg)) showToast(t('apply_dup'), 'error')
      else if (/full/i.test(msg)) showToast(t('apply_full'), 'error')
      else if (/applications.*closed/i.test(msg)) showToast(t('apply_closed'), 'error')
      else showToast(msg || t('load_error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <div className="page"><p className="muted">{t('loading')}</p></div>
  if (state === 'missing') return <div className="page"><a href="#/projects" className="back-link"><Icon name="arrowLeft" /> {t('back_all')}</a><p className="notice error">{t('not_found')}</p></div>
  if (state === 'error') return <div className="page"><p className="notice error">{t('load_error')}</p></div>

  const taken = Number(project.confirmed_count || 0)
  const place = [project.address, project.city].filter(Boolean).join(', ')
  const full = project.status === 'full' || taken >= project.max_capacity

  let action
  if (project.status === 'cancelled') {
    action = (
      <>
        <p className="notice error">{t('project_cancelled')}</p>
        {project.cancellation_reason && <p className="muted">{t('cancellation_reason_text', project.cancellation_reason)}</p>}
      </>
    )
  } else if (!project.applications_open && !(user?.role === 'volunteer' && myApp)) {
    action = <p className="muted">{t('apply_closed')}</p>
  } else if (!user) {
    action = (
      <>
        <p className="muted">{t('join_anon')}</p>
        <a href="#/auth" className="btn btn-primary btn-block">{t('join_signin')}</a>
      </>
    )
  } else if (user.role !== 'volunteer') {
    action = <p className="muted">{t('organizer_cant')}</p>
  } else if (myApp) {
    action = (
      <>
        <p className="muted">{t('applied_status')}</p>
        <span className={`status status-${myApp.status}`}>{t(`st_${myApp.status}`)}</span>
        {myApp.status === 'cancelled' && myApp.rejection_reason && <p className="rejection-copy">{t('rejected_reason', myApp.rejection_reason)}</p>}
        {myApp.motivation && <div className="submitted-motivation"><strong>{t('your_motivation')}</strong><p>{myApp.motivation}</p></div>}
      </>
    )
  } else if (user.email_verified === false) {
    action = (
      <>
        <p className="notice">{t('verify_email_banner')}</p>
        <VerificationResend email={user.email} />
      </>
    )
  } else {
    action = (
      <>
        <p className="muted">{full ? t('apply_full') : t('join_volunteer')}</p>
        <label className="field"><span className="field-label">{t('motivation_label')}</span><textarea rows={5} value={motivation} onChange={(e) => setMotivation(e.target.value)} minLength={20} maxLength={1000} required /></label>
        <div className="counter">{motivation.length}/1000</div>
        <button className="btn btn-primary btn-block" onClick={apply} disabled={busy || full || motivation.trim().length < 20}>
          {busy ? t('applying') : t('apply')}
        </button>
      </>
    )
  }

  return (
    <div className="page detail">
      <a href="#/projects" className="back-link"><Icon name="arrowLeft" /> {t('back_all')}</a>

      <div className="detail-layout">
        <div>
          <div className="project-detail-badges">
            <span className="chip-tag">{categoryLabel(t, project.category)}</span>
            {project.status === 'cancelled' && <span className="status status-cancelled">{t('cancelled_badge')}</span>}
            {full && project.status !== 'cancelled' && <span className="status status-full">{t('full')}</span>}
          </div>
          <h1 className="detail-title">{project.title}</h1>
          <p className="detail-org"><Icon name="building" /> {t('organizer_label')}: <a className="organizer-link" href={`#/organizers/${project.organizer_id}`}>{project.organizer_name}</a></p>

          <div className="info-grid">
            <div className="info-box"><Icon name="calendar" size={22} /><div><span className="info-label">{t('d_date')}</span><strong>{fmtDate(project.start_datetime)}</strong></div></div>
            <div className="info-box"><Icon name="clock" size={22} /><div><span className="info-label">{t('d_start')}</span><strong>{fmtTime(project.start_datetime)}</strong></div></div>
            <div className="info-box"><Icon name="pin" size={22} /><div><span className="info-label">{t('d_place')}</span><strong>{place || '—'}</strong></div></div>
            <div className="info-box"><Icon name="users" size={22} /><div><span className="info-label">{t('d_approved')}</span><strong>{t('of', taken, project.max_capacity)}</strong></div></div>
          </div>

          <h2 className="section-title">{t('about')}</h2>
          <p className="detail-text">{project.description}</p>
          {organizer && (
            <div className="organizer-about">
              <h2 className="section-title">{t('about_organizer')}</h2>
              <strong>{organizer.company_name || project.organizer_name}</strong>
              {organizer.description && <p className="detail-text">{organizer.description}</p>}
            </div>
          )}
        </div>

        <aside className="card join-card">
          <h3 className="card-title">{t('join_q')}</h3>
          {action}
        </aside>
      </div>
    </div>
  )
}
