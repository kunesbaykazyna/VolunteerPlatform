import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [projects, setProjects] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')

  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (currentUser) {
      axios.get('http://localhost:8000/api/projects')
        .then(response => {
          setProjects(response.data)
        })
        .catch(error => {
          console.error("Error loading projects:", error)
        })
    }
  }, [currentUser])

  const handleLogin = (e) => {
    e.preventDefault()
    axios.post('http://localhost:8000/api/login', {
      email: email,
      password_hash: password
    })
    .then(response => {
      setCurrentUser(response.data.user)
    })
    .catch(error => {
      alert("Login failed: " + (error.response?.data?.detail || error.message))
    })
  }

  const handleRegister = (e) => {
    e.preventDefault()
    axios.post('http://localhost:8000/api/register', {
      full_name: fullName,
      email: email,
      password_hash: password,
      role: 'volunteer'
    })
    .then(response => {
      setCurrentUser(response.data.user)
    })
    .catch(error => {
      alert("Registration failed: " + (error.response?.data?.detail || error.message))
    })
  }

  const handleApply = (projectId) => {
    axios.post(`http://localhost:8000/api/projects/${projectId}/apply`, {
      user_id: currentUser.user_id
    })
    .then(response => {
      alert("Success! " + response.data.message);
    })
    .catch(error => {
      alert("Error: " + error.response.data.detail);
    });
  }

  // --- AUTH SCREEN (Full Screen) ---
  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100vw',
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8fafc',
        boxSizing: 'border-box',
        position: 'fixed',
        top: 0,
        left: 0
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          width: '100%',
          maxWidth: '400px',
          border: '1px solid #e2e8f0',
          margin: '20px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '32px' }}>🌿</span>
            <h2 style={{ margin: '10px 0 5px 0', color: '#0f172a', fontSize: '24px' }}>Helping Hands</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              {authMode === 'login' ? 'Sign in to your account' : 'Join our volunteer community'}
            </p>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authMode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '6px' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '6px' }}>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
              />
            </div>
            <button type="submit" style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '15px'
            }}>
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#64748b' }}>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <span
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              style={{ color: '#059669', cursor: 'pointer', fontWeight: '600' }}
            >
              {authMode === 'login' ? 'Register' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    )
  }

  // --- MAIN APP SCREEN (Full Width) ---
  const categories = ['All', 'Environment', 'Social', 'Education', 'Animals', 'Health'];
  const filteredProjects = selectedCategory === 'All'
    ? projects
    : projects.filter(project => project.category === selectedCategory);

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', overflowX: 'hidden' }}>

      {/* Navigation Header (Full Width) */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🌿</span>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: '700' }}>Helping Hands</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{currentUser.full_name}</span>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{currentUser.role}</span>
          </div>
          <button
            onClick={() => setCurrentUser(null)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area (Stretched) */}
      <div style={{ width: '100%', padding: '40px', boxSizing: 'border-box' }}>

        <header style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', color: '#0f172a', margin: '0 0 8px 0', fontWeight: '700' }}>Explore Volunteer Projects</h2>
          <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Choose a cause that matters and make an impact this month.</p>
        </header>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '36px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 18px',
                borderRadius: '20px',
                border: selectedCategory === cat ? '1px solid #059669' : '1px solid #cbd5e1',
                backgroundColor: selectedCategory === cat ? '#059669' : 'white',
                color: selectedCategory === cat ? 'white' : '#475569',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                boxShadow: selectedCategory === cat ? '0 4px 6px -1px rgba(5, 150, 105, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Project Cards Grid (Stretched across full width) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', width: '100%' }}>
          {filteredProjects.length > 0 ? (
            filteredProjects.map(project => (
              <div key={project.project_id} style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -2px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontWeight: '600'
                    }}>
                      {project.category || 'General'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>📍 {project.city}</span>
                  </div>

                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a', fontWeight: '600' }}>{project.title}</h3>
                  <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>{project.description}</p>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>📅 <strong>Date:</strong> {new Date(project.start_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    <div>👥 <strong>Capacity:</strong> {project.max_capacity} volunteers</div>
                    <div>👤 <strong>Organizer:</strong> {project.organizer_name}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleApply(project.project_id)}
                  style={{
                    padding: '12px',
                    width: '100%',
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                }}>
                  Apply Now
                </button>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
              <p style={{ fontSize: '16px' }}>No projects found in this category.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default App