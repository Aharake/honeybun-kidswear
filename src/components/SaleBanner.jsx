import { Link } from 'react-router-dom'
import './SaleBanner.css'

export default function SaleBanner({ title, text, cta, percent, to = '/shop?sale=1' }) {
  return (
    <section className="sale-banner">
      <div className="sale-banner-inner">
        {percent > 0 && <span className="sale-banner-badge">Up to {percent}% off</span>}
        <h2 className="sale-banner-title">{title}</h2>
        {text && <p className="sale-banner-text">{text}</p>}
        {cta && (
          <Link to={to} className="btn sale-banner-cta">
            {cta} →
          </Link>
        )}
      </div>
    </section>
  )
}
