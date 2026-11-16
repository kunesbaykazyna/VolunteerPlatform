import HeroArt from './HeroArt'

export default function Hero({ openCount, user, go }) {
  const scrollToProjects = () => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-text">
          <span className="pill">
            <span className="pill-dot" />
            {openCount} open {openCount === 1 ? 'project' : 'projects'} this season
          </span>
          <h1>
            Lend a hand. <em>Grow</em> your community.
          </h1>
          <p className="hero-sub">
            Find a project that matters to you, register in seconds and track your approval — all in one place.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={scrollToProjects}>Browse projects</button>
            {!user && (
              <button className="btn btn-outline btn-lg" onClick={() => go('auth', 'register')}>Create an account</button>
            )}
          </div>
        </div>
        <div className="hero-image">
          <HeroArt />
        </div>
      </div>
    </section>
  )
}
