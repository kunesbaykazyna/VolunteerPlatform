import { useState, useEffect } from 'react'
import axios from 'axios'

// 1. Перехватчик запросов: автоматически подставляет JWT-токен из LocalStorage в каждый запрос
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 2. Перехватчик ответов: если токен протух или невалиден (401), сбрасываем сессию
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      alert("Session expired or invalid token. Please log in again.")
      window.location.reload() // Перезагружаем страницу, чтобы вернуть пользователя на экран входа
    }
    return Promise.reject(error)
  }
)

// Үш тілді локализация сөздігі (English / Русский / Қазақша)
const translations = {
  en: {
    appName: "Helping Hands",
    signInTitle: "Sign in to your account",
    registerTitle: "Join our volunteer community",
    fullName: "Full Name",
    email: "Email",
    password: "Password",
    signInBtn: "Sign In",
    createAccountBtn: "Create Account",
    switchToRegister: "Create an account",
    switchToLogin: "Sign in instead",
    exploreTab: "Explore Projects",
    applicationsTab: "My Applications",
    signOut: "Sign Out",
    exploreHeader: "Explore Volunteer Projects",
    allCategories: "All",
    date: "Date",
    organizer: "Organizer",
    applyBtn: "Apply Now",
    appliedBtn: "Applied ✅",
    myAppsHeader: "My Applications",
    myAppsSubtitle: "Projects you have successfully joined.",
    confirmed: "Confirmed ✅",
    noApps: "You haven't applied to any projects yet.",
    successApply: "Success! "
  },
  ru: {
    appName: "Helping Hands",
    signInTitle: "Вход в аккаунт",
    registerTitle: "Регистрация волонтера",
    fullName: "Полное имя",
    email: "Электронная почта",
    password: "Пароль",
    signInBtn: "Войти",
    createAccountBtn: "Создать аккаунт",
    switchToRegister: "Создать аккаунт",
    switchToLogin: "Уже есть аккаунт? Войти",
    exploreTab: "Каталог проектов",
    applicationsTab: "Мои заявки",
    signOut: "Выйти",
    exploreHeader: "Доступные волонтерские проекты",
    allCategories: "Все",
    date: "Дата",
    organizer: "Организатор",
    applyBtn: "Подать заявку",
    appliedBtn: "Уже подано ✅",
    myAppsHeader: "Мои заявки",
    myAppsSubtitle: "Проекты, к которым вы успешно присоединились.",
    confirmed: "Подтверждено ✅",
    noApps: "Вы еще не подали ни одной заявки.",
    successApply: "Успешно! "
  },
  kk: {
    appName: "Helping Hands",
    signInTitle: "Аккаунтқа кіру",
    registerTitle: "Волонтерлер қауымдастығына қосылу",
    fullName: "Толық аты-жөні",
    email: "Электрондық пошта",
    password: "Құпия сөз",
    signInBtn: "Кіру",
    createAccountBtn: "Аккаунт құру",
    switchToRegister: "Аккаунт құру",
    switchToLogin: "Аккаунт бар ма? Кіру",
    exploreTab: "Жобаларды шолу",
    applicationsTab: "Менің өтінімдерім",
    signOut: "Шығу",
    exploreHeader: "Қолжетімді волонтерлік жобалар",
    allCategories: "Барлығы",
    date: "Күні",
    organizer: "Ұйымдастырушы",
    applyBtn: "Өтінім беру",
    appliedBtn: "Өтінім берілді ✅",
    myAppsHeader: "Менің өтінімдерім",
    myAppsSubtitle: "Сіз сәтті қосылған жобалар.",
    confirmed: "Расталды ✅",
    noApps: "Сіз әлі ешқандай жобаға өтінім бермедіңіз.",
    successApply: "Сәтті! "
  }
}

function App() {
  const [projects, setProjects] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')

  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const [activeTab, setActiveTab] = useState('explore')
  const [myApplications, setMyApplications] = useState([])

  // Состояния для темы и языка ('en', 'ru', 'kk')
  const [theme, setTheme] = useState('light')
  const [lang, setLang] = useState('en')

  const t = (key) => translations[lang][key] || key

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))

  // Тілді циклімен ауыстыру: EN -> RU -> KK -> EN
  const cycleLang = () => {
    if (lang === 'en') setLang('ru')
    else if (lang === 'ru') setLang('kk')
    else setLang('en')
  }

  // Загружаем проекты и заявки сразу при входе пользователя (для проверки уникальности на клиенте)
  useEffect(() => {
    if (currentUser) {
      axios.get('http://localhost:8000/api/projects')
        .then(response => setProjects(response.data))
        .catch(error => console.error("Error loading projects:", error))

      axios.get(`http://localhost:8000/api/users/${currentUser.user_id}/applications`)
        .then(response => setMyApplications(response.data))
        .catch(error => console.error("Error loading applications:", error))
    }
  }, [currentUser])

  // Обновление списка заявок при переключении вкладок
  useEffect(() => {
    if (currentUser && activeTab === 'applications') {
      axios.get(`http://localhost:8000/api/users/${currentUser.user_id}/applications`)
        .then(response => setMyApplications(response.data))
        .catch(error => console.error("Error loading applications:", error))
    }
  }, [currentUser, activeTab])

  const handleLogin = (e) => {
    e.preventDefault()
    axios.post('http://localhost:8000/api/login', { email, password_hash: password })
    .then(response => {
      setCurrentUser(response.data.user)
      localStorage.setItem('token', response.data.access_token)
    })
    .catch(error => alert("Login failed: " + (error.response?.data?.detail || error.message)))
  }

  const handleRegister = (e) => {
    e.preventDefault()
    axios.post('http://localhost:8000/api/register', {
      full_name: fullName, email, password_hash: password, role: 'volunteer'
    })
    .then(response => {
      setCurrentUser(response.data.user)
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token)
      }
    })
    .catch(error => alert("Registration failed: " + (error.response?.data?.detail || error.message)))
  }

  const handleSignOut = () => {
    localStorage.removeItem('token')
    setCurrentUser(null)
    setMyApplications([])
  }

 const handleApply = (projectId) => {
    // Отправляем пустой объект, так как user_id теперь берется с сервера из JWT
    axios.post(`http://localhost:8000/api/projects/${projectId}/apply`, {})
    .then(response => {
      alert(t('successApply') + response.data.message)
      axios.get(`http://localhost:8000/api/users/${currentUser.user_id}/applications`)
        .then(res => setMyApplications(res.data))
    })
    .catch(error => alert("Error: " + (error.response?.data?.detail || error.message)));
  }

  // Список ID проектов, на которые пользователь уже подал заявку
  const appliedProjectIds = myApplications.map(app => app.project_id)

  // --- AUTH SCREEN ---
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-color)', margin: 0, transition: 'background-color 0.3s' }}>
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={cycleLang} style={{ padding: '6px 12px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            {lang === 'en' ? '🇬🇧 EN' : lang === 'ru' ? '🇷🇺 RU' : '🇰🇿 KZ'}
          </button>
          <button onClick={toggleTheme} style={{ padding: '6px 12px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', margin: '20px', color: 'var(--text-color)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '32px' }}>🌿</span>
            <h2 style={{ margin: '10px 0 5px 0', color: 'var(--text-color)', fontSize: '24px' }}>{t('appName')}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>{authMode === 'login' ? t('signInTitle') : t('registerTitle')}</p>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authMode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('fullName')}</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('password')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ marginTop: '8px', padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
              {authMode === 'login' ? t('signInBtn') : t('createAccountBtn')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
            <span onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ color: '#059669', cursor: 'pointer', fontWeight: '600' }}>
              {authMode === 'login' ? t('switchToRegister') : t('switchToLogin')}
            </span>
          </p>
        </div>
      </div>
    )
  }

  // --- MAIN APP SCREEN ---
  const categories = ['All', 'Environment', 'Social', 'Education', 'Animals', 'Health'];
  const filteredProjects = selectedCategory === 'All' ? projects : projects.filter(project => project.category === selectedCategory);

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', width: '100%', margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: 'var(--text-color)', transition: 'background-color 0.3s, color 0.3s' }}>

      {/* Navigation Header */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🌿</span>
            <h1 style={{ margin: 0, fontSize: '20px', color: 'var(--text-color)', fontWeight: '700' }}>{t('appName')}</h1>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginLeft: '20px' }}>
            <span
              onClick={() => setActiveTab('explore')}
              style={{ cursor: 'pointer', fontWeight: '600', color: activeTab === 'explore' ? '#059669' : 'var(--text-muted)', borderBottom: activeTab === 'explore' ? '2px solid #059669' : 'none', paddingBottom: '4px' }}
            >
              {t('exploreTab')}
            </span>
            <span
              onClick={() => setActiveTab('applications')}
              style={{ cursor: 'pointer', fontWeight: '600', color: activeTab === 'applications' ? '#059669' : 'var(--text-muted)', borderBottom: activeTab === 'applications' ? '2px solid #059669' : 'none', paddingBottom: '4px' }}
            >
              {t('applicationsTab')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={cycleLang} style={{ padding: '8px 12px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            {lang === 'en' ? '🇬🇧 EN' : lang === 'ru' ? '🇷🇺 RU' : '🇰🇿 KZ'}
          </button>
          <button onClick={toggleTheme} style={{ padding: '8px 12px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <div style={{ textAlign: 'right', marginLeft: '10px' }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-color)' }}>{currentUser.full_name}</span>
          </div>
          <button onClick={handleSignOut} style={{ padding: '8px 14px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{t('signOut')}</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ width: '100%', padding: '40px', boxSizing: 'border-box' }}>

        {activeTab === 'explore' ? (
          <>
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--text-color)', margin: '0 0 8px 0', fontWeight: '700' }}>{t('exploreHeader')}</h2>
            </header>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '36px', flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '8px 18px', borderRadius: '20px', border: selectedCategory === cat ? '1px solid #059669' : '1px solid var(--border-color)', backgroundColor: selectedCategory === cat ? '#059669' : 'var(--card-bg)', color: selectedCategory === cat ? 'white' : 'var(--text-color)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                  {cat === 'All' ? t('allCategories') : cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', width: '100%' }}>
              {filteredProjects.map(project => {
                const isAlreadyApplied = appliedProjectIds.includes(project.project_id);

                return (
                  <div key={project.project_id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', backgroundColor: theme === 'light' ? '#ecfdf5' : '#064e3b', color: theme === 'light' ? '#059669' : '#34d399', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>{project.category || 'General'}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>📍 {project.city}</span>
                      </div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-color)', fontWeight: '600' }}>{project.title}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>{project.description}</p>
                      <div style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>📅 <strong>{t('date')}:</strong> {new Date(project.start_datetime).toLocaleString()}</div>
                        <div>👤 <strong>{t('organizer')}:</strong> {project.organizer_name}</div>
                      </div>
                    </div>

                    {/* Проверка уникальности: если уже подал заявку, кнопка заблокирована */}
                    {isAlreadyApplied ? (
                      <button disabled style={{ padding: '12px', width: '100%', backgroundColor: theme === 'light' ? '#e2e8f0' : '#334155', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'not-allowed' }}>
                        {t('appliedBtn')}
                      </button>
                    ) : (
                      <button onClick={() => handleApply(project.project_id)} style={{ padding: '12px', width: '100%', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                        {t('applyBtn')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--text-color)', margin: '0 0 8px 0', fontWeight: '700' }}>{t('myAppsHeader')}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{t('myAppsSubtitle')}</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', width: '100%' }}>
              {myApplications.length > 0 ? (
                myApplications.map(project => (
                  <div key={project.project_id} style={{ background: 'var(--card-bg)', border: '2px solid #059669', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', backgroundColor: theme === 'light' ? '#ecfdf5' : '#064e3b', color: theme === 'light' ? '#059669' : '#34d399', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>{t('confirmed')}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>📍 {project.city}</span>
                      </div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-color)', fontWeight: '600' }}>{project.title}</h3>
                      <div style={{ background: theme === 'light' ? '#f8fafc' : '#1e293b', padding: '12px', borderRadius: '8px', marginTop: '20px', fontSize: '13px', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>📅 <strong>{t('date')}:</strong> {new Date(project.start_datetime).toLocaleString()}</div>
                        <div>👤 <strong>{t('organizer')}:</strong> {project.organizer_name}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '16px' }}>{t('noApps')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App