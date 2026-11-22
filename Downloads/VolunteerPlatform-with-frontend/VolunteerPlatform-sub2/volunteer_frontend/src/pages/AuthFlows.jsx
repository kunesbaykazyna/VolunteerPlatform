import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { getVerificationCooldown, startVerificationCooldown } from '../authHelpers'

export function VerificationResend({ email }) {
  const { t, api, lang, showToast } = useApp()
  const [until, setUntil] = useState(() => (email ? getVerificationCooldown(email) : 0))
  const [remaining, setRemaining] = useState(until ? 60 : 0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!email || !until) return undefined
    const updateCooldown = () => {
      const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) setUntil(0)
    }
    const initialTimer = window.setTimeout(updateCooldown, 0)
    const interval = window.setInterval(updateCooldown, 1000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [email, until])

  const resend = async () => {
    if (!email || busy || remaining > 0) return
    const nextUntil = startVerificationCooldown(email)
    setRemaining(60)
    setUntil(nextUntil)
    setBusy(true)
    try {
      await api.post('/api/auth/resend-verification', { email, lang })
      showToast(t('verification_resend_done'))
    } catch {
      showToast(t('email_delivery_failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className="btn btn-outline" type="button" onClick={resend} disabled={!email || busy || remaining > 0}>
      {remaining > 0 ? t('resend_countdown', remaining) : t('resend_email')}
    </button>
  )
}

export function VerificationBanner() {
  const { t, user } = useApp()
  if (!user || user.email_verified !== false) return null
  return (
    <aside className="verify-banner" role="status">
      <p><strong>{t('verify_email_banner')}</strong> <span>{user.email}</span></p>
      <VerificationResend email={user.email} />
    </aside>
  )
}

export function EmailVerificationPage({ query }) {
  const { t, api, navigate, user, updateUser } = useApp()
  const token = query.get('token')
  const email = query.get('email') || user?.email || ''
  const [status, setStatus] = useState(token ? 'checking' : 'check')

  useEffect(() => {
    if (!token) return undefined
    let active = true
    api.post('/api/auth/verify-email', { token })
      .then(({ data }) => {
        if (!active) return
        setStatus(data.status === 'already_verified' ? 'already' : 'success')
        if (user?.email?.toLowerCase() === data.email?.toLowerCase()) updateUser({ email_verified: true })
      })
      .catch((error) => {
        if (!active) return
        setStatus(error.response?.status === 400 ? 'invalid' : 'error')
      })
    return () => { active = false }
  }, [api, token, updateUser, user?.email])

  useEffect(() => {
    if (status !== 'success' && status !== 'already') return undefined
    const timer = window.setTimeout(() => navigate('/'), 3500)
    return () => window.clearTimeout(timer)
  }, [navigate, status])

  const title = status === 'checking'
    ? t('loading')
    : status === 'success' ? t('verify_success_title')
      : status === 'already' ? t('verify_already_title')
        : status === 'invalid' ? t('verify_invalid_title')
          : status === 'error' ? t('verify_error')
            : t('email_check_title')
  const message = status === 'success'
    ? t('verify_success_message')
    : status === 'already' ? t('verify_already_message')
      : status === 'invalid' ? t('verify_invalid_message')
        : status === 'error' ? t('verify_error')
          : status === 'check' ? t('email_check_message', email)
            : ''

  return (
    <section className="auth-flow">
      <div className="card auth-flow-card">
        <h1>{title}</h1>
        {message && <p className={status === 'invalid' || status === 'error' ? 'notice error' : 'page-sub'} role={status === 'invalid' || status === 'error' ? 'alert' : undefined}>{message}</p>}
        {status === 'check' && email && <VerificationResend email={email} />}
        {(status === 'success' || status === 'already') && <a className="btn btn-primary" href="#/">{t('hero_cta1')}</a>}
        {(status === 'invalid' || status === 'error') && <VerificationResend email={email} />}
        {!email && (status === 'invalid' || status === 'error') && <a className="link-btn" href="#/auth">{t('sign_in')}</a>}
        {status === 'checking' && <span className="muted">{t('loading')}</span>}
      </div>
    </section>
  )
}

export function ForgotPasswordPage() {
  const { t, api, lang } = useApp()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/api/auth/request-password-reset', { email, lang })
    } catch {
      setError(t('load_error'))
    } finally {
      setSubmitted(true)
      setBusy(false)
    }
  }

  return (
    <section className="auth-flow">
      <form className="card auth-flow-card" onSubmit={submit}>
        <h1>{t('forgot_password_title')}</h1>
        <p className="page-sub">{t('forgot_password_sub')}</p>
        {submitted ? (
          <p className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>{error || t('reset_email_sent')}</p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">{t('email')}</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <button className="btn btn-primary" disabled={busy}>{t('forgot_password')}</button>
          </>
        )}
        <a className="link-btn" href="#/auth">{t('sign_in')}</a>
      </form>
    </section>
  )
}

function passwordQuality(password) {
  if (!password) return ''
  const meetsRequirements = password.length >= 8 && /\p{L}/u.test(password) && /\p{N}/u.test(password)
  if (!meetsRequirements) return 'password_strength_weak'
  if (password.length >= 12 && /[^\p{L}\p{N}]/u.test(password)) return 'password_strength_strong'
  return 'password_strength_medium'
}

export function ResetPasswordPage({ query }) {
  const { t, api, navigate } = useApp()
  const token = query.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const strength = useMemo(() => passwordQuality(password), [password])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => navigate('/auth'), 2500)
    return () => window.clearTimeout(timer)
  }, [navigate, success])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < 8 || !/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
      setError(t('password_weak'))
      return
    }
    if (password !== confirmation) {
      setError(t('password_mismatch'))
      return
    }
    setBusy(true)
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password })
      setSuccess(true)
    } catch (requestError) {
      setError(requestError.response?.data?.detail === 'weak_password' ? t('password_weak') : t('password_reset_invalid'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-flow">
      <form className="card auth-flow-card" onSubmit={submit}>
        <h1>{success ? t('password_reset_success') : t('reset_password_title')}</h1>
        {!success && (
          <>
            <p className="page-sub">{t('reset_password_sub')}</p>
            <label className="field">
              <span className="field-label">{t('new_password')}</span>
              <div className="password-control">
                <input type={visible ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button className="btn btn-outline btn-sm" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? t('hide_password') : t('show_password')}>
                  {visible ? t('hide_password') : t('show_password')}
                </button>
              </div>
              <span className="password-strength">{t('password_requirements')}{strength && ` · ${t('password_strength')}: ${t(strength)}`}</span>
            </label>
            <label className="field">
              <span className="field-label">{t('confirm_password')}</span>
              <input type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </label>
            {error && <p className="notice error" role="alert">{error}</p>}
            <button className="btn btn-primary" disabled={busy || !token}>{t('reset_password_title')}</button>
          </>
        )}
        {success && <a className="btn btn-primary" href="#/auth">{t('sign_in')}</a>}
        {!token && !success && <p className="notice error" role="alert">{t('password_reset_invalid')}</p>}
      </form>
    </section>
  )
}
