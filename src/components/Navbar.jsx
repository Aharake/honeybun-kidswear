import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X, ShoppingBag, User } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const { totalCount } = useCart()
  const { user } = useAuth()

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const diff = y - lastY.current
      if (y < 80) {
        setHidden(false)
      } else if (diff > 4) {
        setHidden(true)
      } else if (diff < -4) {
        setHidden(false)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`navbar ${hidden && !open ? 'navbar-hidden' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo" onClick={() => setOpen(false)}>
          <img src={logo} alt="Honeybun Kidswear" />
        </Link>

        <nav className="navbar-links-desktop" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-right">
          <Link to="/account" className="navbar-account" aria-label={user ? 'My account' : 'Sign in'}>
            <User size={26} />
            <span className="navbar-cart-label">{user ? 'Account' : 'Sign in'}</span>
          </Link>
          <Link to="/cart" className="navbar-cart" aria-label="Bag">
            <ShoppingBag size={26} />
            <span className="navbar-cart-label">Bag</span>
            {totalCount > 0 && (
              <span key={totalCount} className="navbar-cart-badge">
                {totalCount}
              </span>
            )}
          </Link>
          <button
            className="navbar-hamburger"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className={`navbar-drawer-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} />
      <nav className={`navbar-mobile ${open ? 'is-open' : ''}`} aria-label="Mobile">
        <button
          className="navbar-drawer-close"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={22} />
        </button>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `navbar-mobile-link ${isActive ? 'is-active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </NavLink>
        ))}
        <NavLink
          to="/account"
          className={({ isActive }) => `navbar-mobile-link ${isActive ? 'is-active' : ''}`}
          onClick={() => setOpen(false)}
        >
          {user ? 'My account' : 'Sign in'}
        </NavLink>
      </nav>
    </header>
  )
}
