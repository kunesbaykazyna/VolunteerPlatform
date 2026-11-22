import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { CATEGORIES } from '../i18n'
import Icon from '../components/Icon'
import ProjectCard from '../components/ProjectCard'

export default function Projects() {
  const { t, api } = useApp()
  const [projects, setProjects] = useState([])
  const [state, setState] = useState('loading')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [location, setLocation] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)
  const [sort, setSort] = useState('nearest')

  useEffect(() => {
    api.get('/api/projects')
      .then((r) => { setProjects(r.data); setState('ready') })
      .catch(() => setState('error'))
  }, [api])

  const locations = useMemo(() => [...new Set(projects.flatMap((p) => [p.city, p.address])
    .map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = projects.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      const start = new Date(p.start_datetime)
      const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      if (from && date < from) return false
      if (to && date > to) return false
      if (location && p.city !== location && p.address !== location) return false
      const left = Math.max(Number(p.max_capacity) - Number(p.confirmed_count || 0), 0)
      if (onlyFree && (p.status === 'full' || left === 0)) return false
      if (q && ![p.title, p.description, p.city, p.address, p.organizer_name, t(`cat_${p.category}`)]
        .filter(Boolean).some((s) => s.toLowerCase().includes(q))) return false
      return true
    })
    return matches.sort((a, b) => {
      const aLeft = Math.max(Number(a.max_capacity) - Number(a.confirmed_count || 0), 0)
      const bLeft = Math.max(Number(b.max_capacity) - Number(b.confirmed_count || 0), 0)
      const aFull = a.status === 'full' || aLeft === 0
      const bFull = b.status === 'full' || bLeft === 0
      if (aFull !== bFull) return aFull ? 1 : -1
      if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'free' && bLeft !== aLeft) return bLeft - aLeft
      return new Date(a.start_datetime) - new Date(b.start_datetime)
    })
  }, [projects, category, query, from, to, location, onlyFree, sort, t])

  const reset = () => {
    setCategory('all')
    setQuery('')
    setFrom('')
    setTo('')
    setLocation('')
    setOnlyFree(false)
    setSort('nearest')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('projects_title')}</h1>
          <p className="page-sub">{t('projects_sub')}</p>
        </div>
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_ph')}
          />
        </label>
      </div>

      <div className="chips">
        {['all', ...CATEGORIES].map((c) => (
          <button
            key={c}
            className={c === category ? 'chip active' : 'chip'}
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? t('cat_all') : t(`cat_${c}`)}
          </button>
        ))}
      </div>

      <div className="project-filters">
        <fieldset className="date-filter">
          <legend>{t('filter_date')}</legend>
          <label><span>{t('filter_from')}</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>{t('filter_to')}</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </fieldset>
        <label className="filter-field">
          <span>{t('filter_location')}</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">{t('location_all')}</option>
            {locations.map((place) => <option key={place} value={place}>{place}</option>)}
          </select>
        </label>
        <label className="filter-checkbox">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
          <span>{t('only_free')}</span>
        </label>
        <label className="filter-field">
          <span>{t('sort_by')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="nearest">{t('sort_nearest')}</option>
            <option value="newest">{t('sort_newest')}</option>
            <option value="free">{t('sort_free')}</option>
          </select>
        </label>
        <button className="btn btn-outline btn-sm" onClick={reset}>{t('reset_filters')}</button>
      </div>

      {state === 'ready' && <p className="muted results-count">{t('showing_projects', filtered.length, projects.length)}</p>}
      {state === 'loading' && <p className="muted">{t('loading')}</p>}
      {state === 'error' && <p className="notice error">{t('load_error')}</p>}
      {state === 'ready' && filtered.length === 0 && (
        <div className="empty-box">
          <p className="muted">{t('no_projects')}</p>
          <button className="btn btn-outline" onClick={reset}>{t('reset_filters')}</button>
        </div>
      )}
      <div className="grid">
        {filtered.map((p) => <ProjectCard key={p.project_id} project={p} />)}
      </div>
    </div>
  )
}
