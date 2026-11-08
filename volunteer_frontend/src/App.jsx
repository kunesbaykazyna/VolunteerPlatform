import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [projects, setProjects] = useState([])

  useEffect(() => {
    // GET request to FastAPI backend
    axios.get('http://localhost:8000/api/projects')
      .then(response => {
        setProjects(response.data)
      })
      .catch(error => {
        console.error("Error loading projects:", error)
      })
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1>Helping Hands 🌿</h1>
        <h2>Available projects</h2>
        <p>Pick one and make a difference this month.</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {projects.map(project => (
          <div key={project.project_id} style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '20px',
            width: '300px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ marginTop: 0 }}>{project.title}</h3>
            <p style={{ color: '#555', fontSize: '14px' }}>{project.description}</p>

            <div style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
              <p>📅 {new Date(project.start_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <p>📍 {project.city}</p>
              <p>👥 Capacity: {project.max_capacity}</p>
              <p>👤 Organizer: {project.organizer_name}</p>
            </div>

            <button style={{
              marginTop: '15px',
              padding: '10px',
              width: '100%',
              backgroundColor: '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Apply Now
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App