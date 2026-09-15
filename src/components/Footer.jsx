import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <p className="footer-logo">HONEYBUN KIDSWEAR</p>
          <p className="footer-tagline">Sweet, comfy clothing for little ones.</p>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link to="/shop">Shop</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/admin/login">Admin</Link>
        </nav>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Honeybun Kidswear. All rights reserved.</p>
    </footer>
  )
}
