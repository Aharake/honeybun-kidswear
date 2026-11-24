import { supabase } from './supabaseClient'
import { orderDeliveryFee } from './pricing'
import { metaTrack, startMeta } from './metaPixel'
import { googleEvent, startGoogle } from './googleTags'

// The one place the shop talks to its ad and analytics tools (Meta Pixel,
// Google Analytics, Google Tag Manager). The IDs are set by the admin in
// "Tracking & ads" and read from the database, so changing one never needs a
// code change. Nothing here ever sends names, phones, addresses or emails.

const CURRENCY = 'USD'

// The Pixel ID the shop already used. It applies until the admin saves a value.
export const DEFAULT_META_PIXEL_ID = '1834640344528155'

export const SETTING_KEYS = { meta: 'meta_pixel_id', ga4: 'ga4_id', gtm: 'gtm_id' }
export const ID_FORMATS = {
  meta: /^\d{10,20}$/,
  ga4: /^G-[A-Z0-9]{6,14}$/,
  gtm: /^GTM-[A-Z0-9]{4,10}$/,
}

// Reads the saved IDs. A missing Meta row means "use the default"; a saved empty
// value means "switched off". Anything that does not look like a real ID is ignored.
export async function loadMarketingIds() {
  const { data, error } = await supabase.from('site_settings').select('key, value')
  const rows = Object.fromEntries((error ? [] : data || []).map((r) => [r.key, (r.value || '').trim()]))
  const pick = (name, fallback = '') => {
    const raw = SETTING_KEYS[name] in rows ? rows[SETTING_KEYS[name]] : fallback
    return ID_FORMATS[name].test(raw) ? raw : ''
  }
  return {
    ids: { meta: pick('meta', DEFAULT_META_PIXEL_ID), ga4: pick('ga4'), gtm: pick('gtm') },
    tableMissing: Boolean(error),
  }
}

let started = false
let ready = false
let blocked = false // an admin browsing the shop: their clicks must not count
const waiting = [] // events that happen before the IDs have loaded

function emit(job) {
  if (blocked) return
  if (ready) job()
  else waiting.push(job)
}

export function blockMarketing(value) {
  blocked = value
  if (value) waiting.length = 0
}

// Loads the IDs once and starts whichever tools have one.
export async function startMarketing() {
  if (started || blocked) return
  started = true
  const { ids } = await loadMarketingIds()
  startMeta(ids.meta)
  startGoogle({ ga4: ids.ga4, gtm: ids.gtm })
  ready = true
  waiting.splice(0).forEach((job) => !blocked && job())
}

const money = (n) => Math.round((Number(n) || 0) * 100) / 100
const gaItem = (id, name, price, quantity = 1) => ({ item_id: id, item_name: name, price: money(price), quantity })

// ---- the events the shop sends ---------------------------------------------

export const adPageView = (path) =>
  emit(() => {
    metaTrack('PageView')
    googleEvent('page_view', { page_path: path, page_location: window.location.href, page_title: document.title })
  })

export const adViewItem = (product, price) =>
  emit(() => {
    const value = money(price ?? product.price)
    metaTrack('ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value,
      currency: CURRENCY,
    })
    googleEvent('view_item', { currency: CURRENCY, value, items: [gaItem(product.id, product.name, value)] })
  })

export const adAddToCart = (product, price, qty = 1) =>
  emit(() => {
    const unit = money(price ?? product.price)
    metaTrack('AddToCart', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      contents: [{ id: product.id, quantity: qty, item_price: unit }],
      value: money(unit * qty),
      currency: CURRENCY,
    })
    googleEvent('add_to_cart', { currency: CURRENCY, value: money(unit * qty), items: [gaItem(product.id, product.name, unit, qty)] })
  })

export const adBeginCheckout = (lines, total) =>
  emit(() => {
    metaTrack('InitiateCheckout', {
      content_type: 'product',
      content_ids: lines.map((i) => i.productId),
      contents: lines.map((i) => ({ id: i.productId, quantity: i.qty, item_price: i.price })),
      num_items: lines.reduce((n, i) => n + i.qty, 0),
      value: money(total),
      currency: CURRENCY,
    })
    googleEvent('begin_checkout', {
      currency: CURRENCY,
      value: money(total),
      items: lines.map((i) => gaItem(i.productId, i.name, i.price, i.qty)),
    })
  })

// eventID / transaction_id is the order number, so an order is never counted twice.
export const adPurchase = (order) =>
  emit(() => {
    metaTrack(
      'Purchase',
      {
        content_type: 'product',
        content_ids: order.items.map((i) => i.product_id),
        contents: order.items.map((i) => ({ id: i.product_id, quantity: i.qty, item_price: i.price })),
        num_items: order.items.reduce((n, i) => n + i.qty, 0),
        value: money(order.total),
        currency: CURRENCY,
      },
      { eventID: order.order_number }
    )
    googleEvent('purchase', {
      transaction_id: order.order_number,
      currency: CURRENCY,
      value: money(order.total),
      shipping: orderDeliveryFee(order),
      ...(order.discount_code ? { coupon: order.discount_code } : {}),
      items: order.items.map((i) => gaItem(i.product_id, i.name, i.price, i.qty)),
    })
  })
