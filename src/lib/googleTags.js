import { whenIdle } from './metaPixel'

// Google Analytics 4 and Google Tag Manager loader.
//   - A Tag Manager ID wins: the shop loads the container and pushes its events
//     to the dataLayer in the standard GA4 format, and GA4 is configured inside
//     Tag Manager.
//   - Otherwise a GA4 ID is used directly.
// Using both at once would count everything twice, so Tag Manager takes over.

let mode = null // 'gtm' | 'ga4' | null

function addScript(src) {
  whenIdle(() => {
    const script = document.createElement('script')
    script.async = true
    script.src = src
    document.head.appendChild(script)
  })
}

export function startGoogle({ ga4, gtm }) {
  if (mode) return mode
  window.dataLayer = window.dataLayer || []
  if (gtm) {
    mode = 'gtm'
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    addScript(`https://www.googletagmanager.com/gtm.js?id=${gtm}`)
  } else if (ga4) {
    mode = 'ga4'
    window.gtag = function () {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', ga4, { send_page_view: false }) // page views are sent per page by the shop
    addScript(`https://www.googletagmanager.com/gtag/js?id=${ga4}`)
  }
  return mode
}

export function googleEvent(name, params = {}) {
  if (mode === 'gtm') {
    if (params.items) {
      window.dataLayer.push({ ecommerce: null }) // clear the previous ecommerce data
      window.dataLayer.push({ event: name, ecommerce: params })
    } else {
      window.dataLayer.push({ event: name, ...params })
    }
  } else if (mode === 'ga4') {
    window.gtag('event', name, params)
  }
}
