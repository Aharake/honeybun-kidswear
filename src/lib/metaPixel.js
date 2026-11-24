// Meta (Facebook / Instagram) Pixel. It tells your Meta Ads account what
// visitors do on the shop so ads can be measured and retargeted.
//
// It stays completely off until a Pixel ID is set: add VITE_META_PIXEL_ID in
// Railway -> Variables (the number from Meta Events Manager), then redeploy.

export const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
const CURRENCY = 'USD'

let started = false
let blocked = false // true for an admin browsing the shop, so their clicks don't count
const waiting = [] // events that happen before the pixel has started

function loadScript() {
  if (window.fbq) return
  // Meta's standard loader
  const n = (window.fbq = function (...args) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue.push(args)
  })
  if (!window._fbq) window._fbq = n
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
}

function send(type, name, data, options) {
  if (type === 'trackCustom') window.fbq('trackCustom', name, data, options)
  else window.fbq('track', name, data, options)
}

// Starts the pixel once we know the visitor isn't the admin.
export function startPixel(id = PIXEL_ID) {
  if (started || blocked || !id) return false
  started = true
  loadScript()
  window.fbq('init', id)
  waiting.splice(0).forEach((e) => send(e.type, e.name, e.data, e.options))
  return true
}

// Called with true when the visitor is signed in as admin.
export function blockPixel(value) {
  blocked = value
  if (value) waiting.length = 0
}

export function pixelEvent(name, data, options) {
  if (!PIXEL_ID && !started) return
  if (blocked) return
  if (started) send('track', name, data, options)
  else waiting.push({ type: 'track', name, data, options })
}

// ---- the events the shop sends -------------------------------------------------

export const pixelPageView = () => pixelEvent('PageView')

export const pixelViewContent = (product, price) =>
  pixelEvent('ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: Number(price ?? product.price) || 0,
    currency: CURRENCY,
  })

export const pixelAddToCart = (product, price, qty = 1) =>
  pixelEvent('AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    contents: [{ id: product.id, quantity: qty, item_price: Number(price ?? product.price) || 0 }],
    value: (Number(price ?? product.price) || 0) * qty,
    currency: CURRENCY,
  })

export const pixelInitiateCheckout = (items, total) =>
  pixelEvent('InitiateCheckout', {
    content_type: 'product',
    content_ids: items.map((i) => i.productId),
    contents: items.map((i) => ({ id: i.productId, quantity: i.qty, item_price: i.price })),
    num_items: items.reduce((n, i) => n + i.qty, 0),
    value: total,
    currency: CURRENCY,
  })

// eventID is the order number, so the same order is never counted twice.
export const pixelPurchase = (order) =>
  pixelEvent(
    'Purchase',
    {
      content_type: 'product',
      content_ids: order.items.map((i) => i.product_id),
      contents: order.items.map((i) => ({ id: i.product_id, quantity: i.qty, item_price: i.price })),
      num_items: order.items.reduce((n, i) => n + i.qty, 0),
      value: Number(order.total),
      currency: CURRENCY,
    },
    { eventID: order.order_number }
  )
