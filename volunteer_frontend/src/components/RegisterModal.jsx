import { useState } from 'react'
import { fmtDate } from '../api'

export default function RegisterModal({ project, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await onSubmit(project, note)
    setBusy(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Register for “{project.title}”</h3>
        <p className="muted small">{fmtDate(project.start_datetime)} · {project.city}</p>
        <label className="field">
          <span>Short note to the organizer (optional)</span>
          <textarea
            rows={4}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tell them why you want to join or what you can help with…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send registration'}</button>
        </div>
      </form>
    </div>
  )
}
