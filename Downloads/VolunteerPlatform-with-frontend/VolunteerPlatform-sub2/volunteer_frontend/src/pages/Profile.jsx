import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { errorText } from '../api'
import Avatar from '../components/Avatar'

const VOLUNTEER_FIELDS = [
  { name: 'phone', label: 'profile_phone', placeholder: 'profile_phone_ph' },
  { name: 'skills', label: 'profile_skills', placeholder: 'profile_skills_ph' },
  { name: 'bio', label: 'profile_bio', placeholder: 'profile_bio_ph', multiline: true },
]
const ORGANIZER_FIELDS = [
  { name: 'company_name', label: 'profile_company', placeholder: 'profile_company_ph' },
  { name: 'website', label: 'profile_website', placeholder: 'profile_website_ph' },
  { name: 'contact_phone', label: 'profile_contact_phone', placeholder: 'profile_contact_phone_ph' },
  { name: 'description', label: 'profile_description', placeholder: 'profile_description_ph', multiline: true },
]

function makeForm(profile, fields) {
  return Object.fromEntries(fields.map(({ name }) => [name, profile[name] ?? '']))
}

function validWebsite(value) {
  if (!value.trim()) return true
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')
  } catch {
    return false
  }
}

function ChangePassword() {
  const { t, api, showToast } = useApp()
  const [values, setValues] = useState({ current_password: '', new_password: '', confirmation: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const setValue = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (values.new_password.length < 8 || !/\p{L}/u.test(values.new_password) || !/\p{N}/u.test(values.new_password)) {
      setError(t('password_weak'))
      return
    }
    if (values.new_password !== values.confirmation) {
      setError(t('password_mismatch'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password,
      })
      setValues({ current_password: '', new_password: '', confirmation: '' })
      showToast(t('password_changed'))
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(detail === 'current_password_wrong' ? t('current_password_wrong') : detail === 'weak_password' ? t('password_weak') : t('password_change_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card profile-form" onSubmit={submit}>
      <h2 className="section-title profile-section-title">{t('change_password_title')}</h2>
      <p className="page-sub">{t('change_password_sub')}</p>
      <label className="field"><span className="field-label">{t('current_password')}</span><input type="password" autoComplete="current-password" value={values.current_password} onChange={setValue('current_password')} required /></label>
      <label className="field"><span className="field-label">{t('new_password')}</span><input type="password" autoComplete="new-password" value={values.new_password} onChange={setValue('new_password')} required /></label>
      <label className="field"><span className="field-label">{t('confirm_password')}</span><input type="password" autoComplete="new-password" value={values.confirmation} onChange={setValue('confirmation')} required /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="profile-actions"><button className="btn btn-primary" disabled={saving}>{t('change_password_title')}</button></div>
    </form>
  )
}

export default function Profile() {
  const { t, api, user, showToast, logout, navigate, updateUser } = useApp()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [savedForm, setSavedForm] = useState({})
  const [savedAvatar, setSavedAvatar] = useState(null)
  const [previewAvatar, setPreviewAvatar] = useState(null)
  const [state, setState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/api/profile/${user.user_id}`)
      .then(({ data }) => {
        if (!active) return
        const fields = data.role === 'volunteer' ? VOLUNTEER_FIELDS : ORGANIZER_FIELDS
        const nextForm = makeForm(data, fields)
        setProfile(data)
        setForm(nextForm)
        setSavedForm(nextForm)
        setSavedAvatar(data.avatar_url || null)
        setPreviewAvatar(data.avatar_url || null)
        setState('ready')
      })
      .catch(() => active && setState('error'))
    return () => { active = false }
  }, [api, user.user_id])

  const fields = profile?.role === 'volunteer' ? VOLUNTEER_FIELDS : ORGANIZER_FIELDS
  const setValue = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }))
    setError('')
  }
  const changed = Object.keys(savedForm).some((name) => form[name] !== savedForm[name]) || previewAvatar !== savedAvatar

  const processAvatar = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(t('avatar_type_error'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('avatar_size_error'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const side = Math.min(image.width, image.height)
        const sx = (image.width - side) / 2
        const sy = (image.height - side) / 2
        canvas.getContext('2d').drawImage(image, sx, sy, side, side, 0, 0, 256, 256)
        setPreviewAvatar(canvas.toDataURL('image/jpeg', 0.85))
        setError('')
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const save = async (event) => {
    event.preventDefault()
    const phoneFields = profile.role === 'volunteer' ? ['phone'] : ['contact_phone']
    if (phoneFields.some((name) => !/^[0-9+()\s-]*$/.test(form[name] || ''))) {
      setError(t('profile_err_phone'))
      return
    }
    if (profile.role === 'organizer' && !validWebsite(form.website)) {
      setError(t('profile_err_website'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.put(`/api/profile/${user.user_id}`, { ...form, avatar_url: previewAvatar })
      setSavedForm({ ...form })
      setSavedAvatar(previewAvatar)
      updateUser({ avatar_url: previewAvatar })
      showToast(t('profile_saved'))
    } catch (e) {
      showToast(errorText(e, t('load_error')), 'error')
    } finally {
      setSaving(false)
    }
  }

  const signOut = () => {
    logout()
    navigate('/')
  }

  const deleteAccount = async (event) => {
    event.preventDefault()
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete('/api/account', { data: { password } })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      logout()
      showToast(t('account_deleted'))
      navigate('/')
    } catch (e) {
      setDeleteError(errorText(e, t('account_delete_error')))
    } finally {
      setDeleting(false)
    }
  }

  if (state === 'loading') return <div className="page"><p className="muted">{t('loading')}</p></div>
  if (state === 'error') return <div className="page"><p className="notice error">{t('profile_load_error')}</p></div>

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">{t('profile_title')}</h1><p className="page-sub">{t('profile_sub')}</p></div></div>
      <section className="card profile-card">
        <div className="profile-identity">
          <div className="avatar-editor">
            <Avatar name={profile.full_name} src={previewAvatar} size="xl" />
            <label className="btn btn-outline btn-sm avatar-upload">
              {t('upload_photo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={processAvatar} />
            </label>
            {previewAvatar && <button type="button" className="link-btn" onClick={() => setPreviewAvatar(null)}>{t('remove_photo')}</button>}
          </div>
          <div className="profile-meta"><h2 className="profile-name">{profile.full_name}</h2><span className="status">{t(`role_${profile.role}`)}</span></div>
        </div>
      </section>

      <form className="card profile-form" onSubmit={save}>
        <h2 className="section-title profile-section-title">{t('contact_info')}</h2>
        <div className="two-col">
          <label className="field"><span className="field-label">{t('full_name')}</span><input value={profile.full_name || ''} readOnly /></label>
          <label className="field"><span className="field-label">{t('email')}</span><input type="email" value={profile.email || ''} readOnly /></label>
        </div>
        <h2 className="section-title profile-section-title">{t('profile_details')}</h2>
        {fields.map(({ name, label, placeholder, multiline }) => (
          <label className="field" key={name}>
            <span className="field-label">{t(label)}</span>
            {multiline ? <textarea rows={4} value={form[name] ?? ''} onChange={setValue(name)} placeholder={t(placeholder)} /> : <input value={form[name] ?? ''} onChange={setValue(name)} placeholder={t(placeholder)} />}
          </label>
        ))}
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="profile-actions">
          <button type="button" className="btn btn-outline" onClick={() => { setForm({ ...savedForm }); setPreviewAvatar(savedAvatar); setError('') }} disabled={!changed || saving}>{t('profile_reset')}</button>
          <button type="submit" className="btn btn-primary" disabled={!changed || saving}>{t('profile_save')}</button>
        </div>
      </form>

      <ChangePassword />

      <section className="card profile-actions-card">
        <h2 className="section-title profile-section-title">{t('account_actions')}</h2>
        <div className="profile-actions">
          <button type="button" className="btn btn-outline" onClick={signOut}>{t('sign_out')}</button>
          <button type="button" className="btn btn-danger" onClick={() => setDeleteModal(true)}>{t('delete_account')}</button>
        </div>
      </section>

      {deleteModal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDeleteModal(false)}>
          <form className="modal card" onSubmit={deleteAccount}>
            <div className="modal-head"><h2 className="section-title">{t('delete_account')}</h2><button type="button" className="icon-btn" onClick={() => setDeleteModal(false)}>×</button></div>
            <p>{t('delete_warning')}</p>
            {profile.role === 'organizer' && <p className="notice error">{t('delete_org_warning')}</p>}
            <label className="field"><span className="field-label">{t('password')}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {deleteError && <p className="notice error" role="alert">{deleteError}</p>}
            <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setDeleteModal(false)}>{t('cancel')}</button><button className="btn btn-danger" disabled={deleting}>{t('delete_account')}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
