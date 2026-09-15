import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Admin.css'

const LINKS = [
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/analytics', label: 'Analytics' },
]

export default function AdminLayout() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-sidebar-logo">Honeybun<br />Admin</p>
        <nav className="admin-nav">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <p style={{ fontSize: '1.1rem', opacity: 0.6, padding: '0 12px 8px' }}>{user?.email}</p>
        <button className="admin-signout" onClick={handleSignOut}>Sign out</button>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
