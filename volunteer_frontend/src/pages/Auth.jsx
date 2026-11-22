import { useState } from 'react'
import { useApp } from '../context'
import { errorText } from '../api'
import Icon from '../components/Icon'
import { startVerificationCooldown } from '../authHelpers'

const LOCAL = {
  en: {
    org_create: 'Create new company',
    org_join: 'Join existing company',
    company_name: 'Company / organization name',
    invite_code: 'Company invite code',
    invite_hint: 'Ask your super organizer for the code. Your account will wait for their approval.',
    err_invite: 'Invalid company invite code',
  },
  ru: {
    org_create: 'Создать компанию',
    org_join: 'Присоединиться по коду',
    company_name: 'Название компании / организации',
    invite_code: 'Код приглашения компании',
    invite_hint: 'Код можно взять у главного (супер) организатора. После регистрации он подтвердит ваш доступ.',
    err_invite: 'Неверный код приглашения компании',
  },
  kz: {
    org_create: 'Жаңа ұйым құру',
    org_join: 'Код арқылы қосылу',
    company_name: 'Ұйым / компания атауы',
    invite_code: 'Шақыру коды',
    invite_hint: 'Кодты бас ұйымдастырушыдан сұраңыз. Тіркелген соң ол сізді растауы керек.',
    err_invite: 'Шақыру коды жарамсыз',
  },
}

export default function Auth() {
  const { t, api, login, navigate, showToast, lang } = useApp()
  const startRegister = window.location.hash.includes('tab=register')
  const [tab, setTab] = useState(startRegister ? 'register' : 'login')
  const [role, setRole] = useState('volunteer')
  const [orgMode, setOrgMode] = useState('create')
  const [form, setForm] = useState({ full_name: '', email: '', password: '', company_name: '', invite_code: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lt = (k) => (LOCAL[lang] || LOCAL.en)[k]
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const doLogin = async (email, password) => {
    const r = await api.post('/api/login', { email, password_hash: password })
    login(r.data.access_token, r.data.user)
    if (!r.data.user.email_verified) {
      startVerificationCooldown(r.data.user.email)
      navigate(`/verify-email?email=${encodeURIComponent(r.data.user.email)}`)
    } else {
      navigate(r.data.user.role === 'volunteer' ? '/projects' : '/dashboard')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password || (tab === 'register' && !form.full_name)) {
      setError(t('err_fill'))
      return
    }
    if (tab === 'register' && role === 'organizer') {
      if (orgMode === 'create' && !form.company_name.trim()) {
        setError(t('err_fill'))
        return
      }
      if (orgMode === 'join' && !form.invite_code.trim()) {
        setError(t('err_fill'))
        return
      }
    }
    setBusy(true)
    try {
      if (tab === 'register') {
        await api.post('/api/register', {
          full_name: form.full_name,
          email: form.email,
          password_hash: form.password,
          role,
          lang,
          org_mode: orgMode,
          company_name: orgMode === 'create' ? form.company_name.trim() : null,
          invite_code: orgMode === 'join' ? form.invite_code.trim().toUpperCase() : null,
        })
        await doLogin(form.email, form.password)
        showToast(t('registered_ok'))
      } else {
        await doLogin(form.email, form.password)
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 401) setError(t('err_login'))
      else if (detail === 'email_delivery_failed') setError(t('email_delivery_failed'))
      else if (detail === 'invalid_invite_code') setError(lt('err_invite'))
      else setError(errorText(err, t('load_error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-intro">
        <span className="brand-mark big"><Icon name="leaf" size={34} /></span>
        <h1 className="auth-headline">{t('auth_headline')}</h1>
        <p className="page-sub">{t('auth_sub')}</p>
      </div>

      <form className="card auth-card" onSubmit={submit} noValidate>
        <div className="tabs">
          <button type="button" className={tab === 'login' ? 'tab active' : 'tab'} onClick={() => { setTab('login'); setError('') }}>{t('tab_login')}</button>
          <button type="button" className={tab === 'register' ? 'tab active' : 'tab'} onClick={() => { setTab('register'); setError('') }}>{t('tab_register')}</button>
        </div>

        {tab === 'register' && (
          <>
            <span className="field-label">{t('i_am')}</span>
            <div className="role-grid">
              <button type="button" className={role === 'volunteer' ? 'role-card active' : 'role-card'} onClick={() => setRole('volunteer')}>
                <Icon name="hand" size={22} />
                <strong>{t('role_vol_title')}</strong>
                <span>{t('role_vol_sub')}</span>
              </button>
              <button type="button" className={role === 'organizer' ? 'role-card active' : 'role-card'} onClick={() => setRole('organizer')}>
                <Icon name="megaphone" size={22} />
                <strong>{t('role_org_title')}</strong>
                <span>{t('role_org_sub')}</span>
              </button>
            </div>

            {role === 'organizer' && (
              <>
                <div className="tabs">
                  <button type="button" className={orgMode === 'create' ? 'tab active' : 'tab'} onClick={() => { setOrgMode('create'); setError('') }}>
                    {lt('org_create')}
                  </button>
                  <button type="button" className={orgMode === 'join' ? 'tab active' : 'tab'} onClick={() => { setOrgMode('join'); setError('') }}>
                    {lt('org_join')}
                  </button>
                </div>
                {orgMode === 'create' ? (
                  <label className="field">
                    <span className="field-label">{lt('company_name')}</span>
                    <input value={form.company_name} onChange={set('company_name')} placeholder="Green Almaty Foundation" />
                  </label>
                ) : (
                  <label className="field">
                    <span className="field-label">{lt('invite_code')}</span>
                    <input value={form.invite_code} onChange={set('invite_code')} placeholder="GREEN001" />
                    <span className="muted small">{lt('invite_hint')}</span>
                  </label>
                )}
              </>
            )}

            <label className="field">
              <span className="field-label">{t('full_name')}</span>
              <input value={form.full_name} onChange={set('full_name')} autoComplete="name" />
            </label>
          </>
        )}

        <label className="field">
          <span className="field-label">{t('email')}</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label className="field">
          <span className="field-label">{t('password')}</span>
          <input type="password" value={form.password} onChange={set('password')} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {tab === 'login' && <a className="link-btn" href="#/forgot-password">{t('forgot_password')}</a>}

        {error && <p className="notice error">{error}</p>}

        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {tab === 'login' ? t('login_btn') : role === 'volunteer' ? t('register_vol') : t('register_org')}
        </button>
      </form>
    </div>
  )
}