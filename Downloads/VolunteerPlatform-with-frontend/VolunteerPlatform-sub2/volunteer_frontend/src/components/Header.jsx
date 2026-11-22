import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { LANGS } from '../i18n'
import Icon from './Icon'
import Avatar from './Avatar'

export default function Header() {
  const { t, lang, setLang, changeTheme, theme, user, path } = useApp()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeControlRef = useRef(null)
  const themeButtonRef = useRef(null)

  const links = [{ to: '/projects', label: t('nav_projects') }]
  if (user?.role === 'organizer' || user?.role === 'admin')
    links.push({ to: '/dashboard', label: t('nav_dashboard') })
  if (user?.role === 'volunteer') links.push({ to: '/applications', label: t('nav_applications') })
  if (user) links.push({ to: '/profile', label: t('nav_profile') })

  const isActive = (to) => (to === '/projects' ? path.startsWith('/projects') : path.startsWith(to))
  const roleLabel = { volunteer: t('role_volunteer'), organizer: t('role_organizer'), admin: t('role_admin') }
  const themeOptions = [
    { value: 'green', label: t('theme_green_name') },
    { value: 'pink', label: t('theme_pink_name') },
    { value: 'dark', label: t('theme_dark_name') },
  ]

  useEffect(() => {
    if (!themeMenuOpen) return undefined

    const closeOnOutsidePointer = (event) => {
      if (!themeControlRef.current?.contains(event.target)) setThemeMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setThemeMenuOpen(false)
        themeButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [themeMenuOpen])

  return (
    <header className="header">
      <div className="header-inner">
        <a href="#/" className="brand">
          <span className="brand-mark"><Icon name="leaf" size={22} /></span>
          <span className="brand-name">Helping Hands</span>
        </a>

        <nav className="nav">
          {links.map((l) => (
            <a key={l.to} href={`#${l.to}`} className={isActive(l.to) ? 'nav-link active' : 'nav-link'}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="header-right">
          <div className="lang-switch" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l}
                className={l === lang ? 'lang-btn active' : 'lang-btn'}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="theme-control" ref={themeControlRef}>
            <button
              ref={themeButtonRef}
              type="button"
              className="icon-btn"
              onClick={() => setThemeMenuOpen((open) => !open)}
              title={t('change_theme')}
              aria-label={t('change_theme')}
              aria-expanded={themeMenuOpen}
              aria-controls="theme-menu"
            >
              <Icon name="palette" size={20} />
            </button>
            <div id="theme-menu" className="theme-menu" role="group" aria-label={t('change_theme')} hidden={!themeMenuOpen}>
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={theme === option.value ? 'theme-option active' : 'theme-option'}
                  onClick={() => {
                    changeTheme(option.value)
                    setThemeMenuOpen(false)
                    themeButtonRef.current?.focus()
                  }}
                  aria-pressed={theme === option.value}
                >
                  <span className="theme-preview" data-theme-preview={option.value} aria-hidden="true" />
                  <span>{option.label}</span>
                  <span className="theme-check">
                    {theme === option.value && <Icon name="check" size={16} />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {user ? (
            <a href="#/profile" className={isActive('/profile') ? 'user-box active' : 'user-box'} aria-current={isActive('/profile') ? 'page' : undefined}>
              <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
              <span className="user-name">{user.full_name}</span>
              <span className="user-role">{roleLabel[user.role]}</span>
            </a>
          ) : (
            <a href="#/auth" className="btn btn-primary btn-sm">{t('sign_in')}</a>
          )}
        </div>
      </div>
    </header>
  )
}
