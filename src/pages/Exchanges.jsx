import { Link } from 'react-router-dom'
import { EXCHANGE_DAYS } from '../lib/policy'
import { WHATSAPP_DISPLAY, WHATSAPP_LINK } from '../lib/contact'
import './Exchanges.css'

export default function Exchanges() {
  return (
    <div className="container policy-page">
      <h1>Exchange policy</h1>

      <div className="policy-card">
        <h2>No refunds</h2>
        <p>We don't offer refunds on orders.</p>
      </div>

      <div className="policy-card">
        <h2>Exchanges within {EXCHANGE_DAYS} days</h2>
        <p>
          If something doesn't fit or isn't quite right, you can exchange it within {EXCHANGE_DAYS} days of the day
          your order is delivered.
        </p>
      </div>

      <div className="policy-card">
        <h2>How to exchange</h2>
        <p>
          Message us on{' '}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            WhatsApp ({WHATSAPP_DISPLAY})
          </a>{' '}
          with your order number and the size you'd like instead, and we'll arrange it with you.
        </p>
      </div>

      <p className="policy-back">
        <Link to="/shop">Back to the shop</Link>
      </p>
    </div>
  )
}
