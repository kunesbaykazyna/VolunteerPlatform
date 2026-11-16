import { useState } from 'react'
import { api, errMsg } from '../api'

export default function AuthPage({ initialMode = 'login', onAuth, toast }) {
  const [mode, setMode] = useState(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('volunteer')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res =
        mode === 'login'
          ? await api.post('/api/login', { email, password_hash: password })
          : await api.post('/api/register', { full_name: fullName, email, password_hash: password, role })
      onAuth(res.data.user)
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="container auth">
      <div className="auth-side">
        <h1>Every small act <em>grows</em> something bigger.</h1>
        <p className="hero-sub">Join as a volunteer to find projects, or as an organizer to gather a team for your cause.</p>
      </div>

      <div className="card auth-card">
        <div className="tabs">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')} type="button">Sign in</button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')} type="button">Register</button>
        </div>

        <form onSubmit={submit} className="form">
          {mode === 'register' && (
            <>
              <label className="field">
                <span>Full name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </label>
              <div className="field">
                <span>I want to join as</span>
                <div className="role-switch">
                  <button type="button" className={role === 'volunteer' ? 'active' : ''} onClick={() => setRole('volunteer')}>Volunteer</button>
                  <button type="button" className={role === 'organizer' ? 'active' : ''} onClick={() => setRole('organizer')}>Organizer</button>
                </div>
              </div>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  )
}
