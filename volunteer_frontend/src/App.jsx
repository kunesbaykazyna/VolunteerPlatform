import { useApp } from './context'
import Header from './components/Header'
import Home from './pages/Home'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import MyApplications from './pages/MyApplications'
import Profile from './pages/Profile'
import OrganizerPublic from './pages/OrganizerPublic'
import { EmailVerificationPage, ForgotPasswordPage, ResetPasswordPage, VerificationBanner } from './pages/AuthFlows'

export default function App() {
  const { path, user, toast } = useApp()
  const route = path.split('?')[0].replace(/\/+$/, '') || '/'
  const query = new URLSearchParams(path.split('?')[1] || '')

  let page
  if (route === '/') page = <Home />
  else if (route === '/projects') page = <Projects />
  else if (route.startsWith('/projects/')) page = <ProjectDetail key={route} id={route.split('/')[2]} />
  else if (route.startsWith('/organizers/')) page = <OrganizerPublic key={route} id={route.split('/')[2]} />
  else if (route === '/auth') page = <Auth key={path} />
  else if (route === '/verify-email') page = <EmailVerificationPage key={path} query={query} />
  else if (route === '/forgot-password') page = <ForgotPasswordPage />
  else if (route === '/reset-password') page = <ResetPasswordPage key={path} query={query} />
  else if (route === '/dashboard') {
    page = user && user.role !== 'volunteer' ? <Dashboard /> : <Auth key="guard" />
  } else if (route === '/applications') {
    page = user?.role === 'volunteer' ? <MyApplications /> : <Auth key="guard" />
  } else if (route === '/profile') {
    page = user ? <Profile /> : <Auth key="guard" />
  } else page = <Projects />

  return (
    <>
      <Header />
      {route !== '/verify-email' && <VerificationBanner />}
      <main>{page}</main>
      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.text}</div>}
    </>
  )
}
