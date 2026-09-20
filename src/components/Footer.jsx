import { Link } from 'react-router-dom'
import { useCollections } from '../hooks/useCollections'
import logo from '../assets/logo.png'
import './Footer.css'

export default function Footer() {
  const { collections } = useCollections()

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <img src={logo} alt="Honeybun Kidswear" className="footer-logo" />
          <p className="footer-tagline">Sweet, comfy clothing for little ones — sized newborn to 6 years.</p>
        </div>

        <div className="footer-col">
          <p className="footer-col-title">Shop</p>
          <Link to="/shop">All products</Link>
          {collections.map((col) => (
            <Link key={col.id} to={`/shop?category=${encodeURIComponent(col.name)}`}>{col.name}</Link>
          ))}
        </div>

        <div className="footer-col">
          <p className="footer-col-title">Honeybun</p>
          <Link to="/">Home</Link>
          <Link to="/shop">Shop all</Link>
          <Link to="/contact">Contact us</Link>
          <Link to="/admin/login">Admin</Link>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Honeybun Kidswear. All rights reserved.</p>
    </footer>
  )
}
