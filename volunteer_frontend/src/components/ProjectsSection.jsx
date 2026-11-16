import { useState } from 'react'
import ProjectCard from './ProjectCard'
import { CATEGORIES } from '../api'

export default function ProjectsSection({ projects, loading, myRegs, user, onRegister }) {
  const [category, setCategory] = useState('All')
  const shown = category === 'All' ? projects : projects.filter((p) => p.category === category)

  return (
    <section id="projects" className="container projects">
      <h2>Available projects</h2>
      <p className="muted section-sub">Pick one and make a difference this month.</p>

      <div className="chips">
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">Loading projects…</p>
      ) : shown.length === 0 ? (
        <p className="empty">No projects in this category yet. Check back soon!</p>
      ) : (
        <div className="grid">
          {shown.map((p) => (
            <ProjectCard
              key={p.project_id}
              project={p}
              myStatus={myRegs[p.project_id]}
              canRegister={!user || user.role === 'volunteer'}
              onRegister={onRegister}
            />
          ))}
        </div>
      )}
    </section>
  )
}
