import { useEffect, useState } from 'react'
import { useApp } from '../context'

export default function Home() {
  const { t, api, user } = useApp()
  const [count, setCount] = useState(null)

  useEffect(() => {
    api.get('/api/projects').then((r) => setCount(r.data.length)).catch(() => setCount(null))
  }, [api])

  return (
    <section className="hero">
      <div className="hero-inner">
        {count !== null && <span className="hero-badge">{t('hero_badge', count)}</span>}
        <h1 className="hero-title">
          {t('hero_t1')}<br />
          <em>{t('hero_t2')}</em> {t('hero_t3')}
        </h1>
        <p className="hero-sub">{t('hero_sub')}</p>
        <div className="hero-actions">
          <a href="#/projects" className="btn btn-light btn-lg">{t('hero_cta1')}</a>
          {!user && <a href="#/auth?tab=register" className="btn btn-ghost btn-lg">{t('hero_cta2')}</a>}
        </div>
      </div>
    </section>
  )
}
