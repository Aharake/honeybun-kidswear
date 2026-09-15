import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import './OrderConfirmation.css'

export default function OrderConfirmation() {
  const { orderNumber } = useParams()
  const location = useLocation()
  const order = location.state?.order

  return (
    <div className="container confirmation-page">
      <CheckCircle2 size={56} color="var(--sage)" />
      <h1>Thank you!</h1>
      <p className="confirmation-order-number">Order #{orderNumber}</p>

      {order ? (
        <>
          <p className="confirmation-sub">
            We've received your order and will contact you at {order.phone} to confirm delivery. Pay with cash when it arrives.
          </p>

          <div className="confirmation-details">
            <div className="confirmation-items">
              {order.items.map((item, i) => (
                <div key={i} className="checkout-summary-row">
                  <span>{item.name} {item.size && `(${item.size})`} × {item.qty}</span>
                  <span>${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="checkout-summary-total">
              <span>Total (Cash on delivery)</span>
              <span>${Number(order.total).toFixed(2)}</span>
            </div>
            <p className="confirmation-address">
              Delivering to: {order.address}, {order.city}
            </p>
          </div>
        </>
      ) : (
        <p className="confirmation-sub">
          Your order was placed successfully. Save your order number for reference — we'll be in touch to confirm delivery.
        </p>
      )}

      <Link to="/shop" className="btn btn-primary">Continue shopping</Link>
    </div>
  )
}
