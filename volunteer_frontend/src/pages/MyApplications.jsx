import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { errorText } from '../api'
import Icon from '../components/Icon'
import { categoryLabel } from '../categoryLabel'

export default function MyApplications() {
  const { t, api, user, fmtDate, fmtTime, showToast } = useApp()
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')

  const load = useCallback(() => {
    api.get(`/api/users/${user.user_id}/applications`)
      .then((r) => { setItems(r.data); setState('ready') })
      .catch(() => setState('error'))
  }, [api, user.user_id])

  useEffect(() => { load() }, [load])

  const withdraw = async (id) => {
    try {
      await api.delete(`/api/applications/${id}`)
      showToast(t('apps_withdrawn'))
      load()
    } catch (e) {
      showToast(errorText(e, t('load_error')), 'error')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('apps_title')}</h1>
          <p className="page-sub">{t('apps_sub')}</p>
        </div>
      </div>

      {state === 'loading' && <p className="muted">{t('loading')}</p>}
      {state === 'error' && <p className="notice error">{t('load_error')}</p>}
      {state === 'ready' && items.length === 0 && (
        <div className="empty-box">
          <p className="muted">{t('apps_none')}</p>
          <a href="#/projects" className="btn btn-primary">{t('apps_find')}</a>
        </div>
      )}

      <div className="grid grid-2">
        {items.map((a) => (
          <article key={a.registration_id} className="card">
            <div className="card-top">
              <span className="chip-tag">{categoryLabel(t, a.category)}</span>
              <div className="card-badges">
                {a.project_status === 'cancelled' && <span className="status status-cancelled">{t('cancelled_badge')}</span>}
                <span className={`status status-${a.status}`}>{t(`st_${a.status}`)}</span>
              </div>
            </div>
            <h3 className="card-title"><a href={`#/projects/${a.project_id}`}>{a.title}</a></h3>
            <p className="muted small">{a.organizer_name}</p>
            {a.motivation && <div className="submitted-motivation"><strong>{t('your_motivation')}</strong><p>{a.motivation}</p></div>}
            {a.status === 'cancelled' && a.rejection_reason && <p className="rejection-copy">{t('rejected_reason', a.rejection_reason)}</p>}
            {a.project_status === 'cancelled' && a.cancellation_reason && <p className="rejection-copy">{t('cancellation_reason_text', a.cancellation_reason)}</p>}
            <ul className="meta-list">
              <li><Icon name="calendar" /> {fmtDate(a.start_datetime)} · {fmtTime(a.start_datetime)}</li>
              {a.city && <li><Icon name="pin" /> {a.city}</li>}
            </ul>
            <div className="card-bottom">
              <button className="btn btn-outline btn-sm" onClick={() => withdraw(a.registration_id)}>{t('apps_withdraw')}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
