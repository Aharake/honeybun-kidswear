const round2 = (n) => Math.round(n * 100) / 100

export function salePriceFor(product, percentOff) {
  const override = product.sale_price
  if (override !== null && override !== undefined && override !== '') return Number(override)
  return round2(Number(product.price) * (100 - percentOff) / 100)
}

// current: what the shopper pays. original: the struck-through price, if any.
// Two kinds of sale can apply: a sale set on the product itself (always on),
// and the store-wide sale campaign (only while it's switched on). The lower wins.
export function getPricing(product, sale) {
  const base = Number(product.price)
  let best = null

  const own = product.product_sale_price
  if (own !== null && own !== undefined && own !== '' && Number(own) > 0 && Number(own) < base) {
    best = Number(own)
  }

  if (sale?.is_active && product.on_sale) {
    const campaign = Math.min(base, salePriceFor(product, sale.percent_off))
    if (campaign < base && (best === null || campaign < best)) best = campaign
  }

  if (best !== null) {
    return { current: best, original: base, onSale: true, percentOff: Math.round((1 - best / base) * 100) }
  }

  const compare = Number(product.compare_at_price)
  if (compare && compare > base) {
    return { current: base, original: compare, onSale: true, percentOff: Math.round((1 - base / compare) * 100) }
  }

  return { current: base, original: null, onSale: false, percentOff: 0 }
}

export function discountAmountFor(discount, subtotal) {
  if (!discount || subtotal < (discount.min_subtotal || 0)) return 0
  const raw = discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value
  return round2(Math.min(raw, subtotal))
}

export { round2 }
