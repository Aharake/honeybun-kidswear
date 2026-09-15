import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem' }}>Page not found</h1>
      <p className="shop-empty">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Back home</Link>
    </div>
  )
}
