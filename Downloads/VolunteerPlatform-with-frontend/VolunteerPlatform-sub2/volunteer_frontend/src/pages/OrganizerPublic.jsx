import { useEffect, useState } from 'react'
import { useApp } from '../context'
import Avatar from '../components/Avatar'
import ProjectCard from '../components/ProjectCard'

export default function OrganizerPublic({ id }) {
  const { t, api } = useApp()
  const [organizer, setOrganizer] = useState(null)
  const [projects, setProjects] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    Promise.all([
      api.get(`/api/organizers/${id}/public`),
      api.get(`/api/organizers/${id}/projects`),
    ]).then(([org, list]) => {
      setOrganizer(org.data)
      setProjects(list.data.filter((project) => project.status === 'open'))
      setState('ready')
    }).catch(() => setState('error'))
  }, [api, id])

  if (state === 'loading') return <div className="page"><p className="muted">{t('loading')}</p></div>
  if (state === 'error' || !organizer) return <div className="page"><p className="notice error">{t('organizer_not_found')}</p></div>

  return (
    <div className="page">
      <section className="card public-organizer">
        <Avatar name={organizer.full_name} src={organizer.avatar_url} size="xl" />
        <div>
          <h1 className="page-title">{organizer.company_name || organizer.full_name}</h1>
          <p className="muted">{organizer.full_name}</p>
          {organizer.description && <p className="detail-text">{organizer.description}</p>}
          {organizer.website && <p><a className="organizer-link" href={organizer.website} target="_blank" rel="noopener noreferrer">{organizer.website}</a></p>}
          {organizer.contact_phone && <p><strong>{t('profile_contact_phone')}:</strong> {organizer.contact_phone}</p>}
        </div>
      </section>
      <h2 className="section-title">{t('organizer_open_projects')}</h2>
      {projects.length ? <div className="grid">{projects.map((project) => <ProjectCard key={project.project_id} project={project} />)}</div> : <p className="muted">{t('no_projects_org')}</p>}
    </div>
  )
}
