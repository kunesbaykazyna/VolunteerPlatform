import { Leaf } from './Icons'

export default function Navbar({ user, page, go, onSignOut }) {
  const link = (id, label) => (
    <button className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => go(id)}>
      {label}
    </button>
  )

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <button className="logo" onClick={() => go('home')}>
          <span className="logo-mark"><Leaf width={18} height={18} /></span>
          <span className="logo-text">Helping Hands</span>
        </button>

        <nav className="nav-links">
          {link('home', 'Projects')}
          {user?.role === 'volunteer' && link('my', 'My registrations')}
          {user?.role === 'organizer' && link('organizer', 'Organizer')}
        </nav>

        <div className="nav-right">
          {user ? (
            <>
              <span className="nav-user">{user.full_name}</span>
              <button className="btn btn-outline btn-sm" onClick={onSignOut}>Sign out</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => go('auth')}>Sign in</button>
          )}
        </div>
      </div>
    </header>
  )
}
