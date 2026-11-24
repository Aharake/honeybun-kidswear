// Meta (Facebook / Instagram) Pixel loader. The Pixel ID comes from the admin
// page "Tracking & ads" (see marketing.js); nothing here is hard-coded.

let started = false

// Runs once the browser is idle, so ad scripts never slow the first paint.
export function whenIdle(fn) {
  const run = () => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500))
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}

export function startMeta(id) {
  if (started || !id) return false
  started = true
  if (!window.fbq) {
    // Meta's standard loader: collects events in a queue until the script arrives
    const n = (window.fbq = function (...args) {
      if (n.callMethod) n.callMethod(...args)
      else n.queue.push(args)
    })
    if (!window._fbq) window._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    whenIdle(() => {
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(script)
    })
  }
  window.fbq('init', id)
  return true
}

export function metaTrack(name, data, options) {
  if (started && window.fbq) window.fbq('track', name, data, options)
}
