import { useCallback, useEffect, useState } from 'react'
import { api, errMsg } from './api'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Steps from './components/Steps'
import ProjectsSection from './components/ProjectsSection'
import RegisterModal from './components/RegisterModal'
import AuthPage from './pages/AuthPage'
import MyRegistrations from './pages/MyRegistrations'
import OrganizerPage from './pages/OrganizerPage'

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hh_user')) } catch { return null }
  })
  const [page, setPage] = useState('home') // home | auth | my | organizer
  const [authMode, setAuthMode] = useState('login')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRegs, setMyRegs] = useState({}) // project_id -> status
  const [selected, setSelected] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)

  const toast = useCallback((text, type = 'ok') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 3500)
  }, [])

  const go = (target, mode) => {
    if (mode) setAuthMode(mode)
    setPage(target)
    window.scrollTo({ top: 0 })
  }

  const loadProjects = useCallback(() => {
    api.get('/api/projects')
      .then((r) => setProjects(r.data))
      .catch((e) => toast('Could not load projects: ' + errMsg(e), 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const loadMyRegs = useCallback(() => {
    if (!user || user.role !== 'volunteer') { setMyRegs({}); return }
    api.get(`/api/users/${user.user_id}/applications`)
      .then((r) => setMyRegs(Object.fromEntries(r.data.map((x) => [x.project_id, x.status]))))
      .catch(() => {})
  }, [user])

  useEffect(loadProjects, [loadProjects])
  useEffect(loadMyRegs, [loadMyRegs])

  const handleAuth = (u) => {
    localStorage.setItem('hh_user', JSON.stringify(u))
    setUser(u)
    toast(`Welcome, ${u.full_name}!`)
    go(u.role === 'organizer' ? 'organizer' : 'home')
  }

  const signOut = () => {
    localStorage.removeItem('hh_user')
    setUser(null)
    setMyRegs({})
    go('home')
  }

  const startRegister = (project) => {
    if (!user) { toast('Please sign in to register', 'error'); go('auth', 'login'); return }
    setSelected(project)
  }

  const sendRegistration = async (project, note) => {
    try {
      const res = await api.post(`/api/projects/${project.project_id}/apply`, { user_id: user.user_id, note })
      toast(res.data.message)
      setSelected(null)
      loadProjects()
      loadMyRegs()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  // Pages that need a login
  let current = page
  if ((current === 'my' || current === 'organizer') && !user) current = 'auth'

  return (
    <div className="app">
      <Navbar user={user} page={current} go={go} onSignOut={signOut} />

      <main>
        {current === 'home' && (
          <>
            <Hero openCount={projects.length} user={user} go={go} />
            <Steps />
            <ProjectsSection projects={projects} loading={loading} myRegs={myRegs} user={user} onRegister={startRegister} />
          </>
        )}
        {current === 'auth' && <AuthPage key={authMode} initialMode={authMode} onAuth={handleAuth} toast={toast} />}
        {current === 'my' && user && <MyRegistrations user={user} go={go} toast={toast} />}
        {current === 'organizer' && user && <OrganizerPage user={user} toast={toast} onProjectCreated={loadProjects} />}
      </main>

      <Footer />

      {selected && <RegisterModal project={selected} onClose={() => setSelected(null)} onSubmit={sendRegistration} />}
      {toastMsg && <div className={`toast toast-${toastMsg.type}`}>{toastMsg.text}</div>}
    </div>
  )
}

export default App
