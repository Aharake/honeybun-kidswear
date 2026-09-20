import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { discountAmountFor, round2 } from '../lib/pricing'

const CartContext = createContext(null)
const STORAGE_KEY = 'honeybun_cart'
const DISCOUNT_KEY = 'honeybun_discount'

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function lineKey(productId, size) {
  return `${productId}::${size || ''}`
}

// Looks up live stock for every line in the cart. A product that can't be
// found (deleted or hidden) counts as sold out.
async function fetchAvailability(lines) {
  const ids = [...new Set(lines.map((l) => l.productId))]
  if (ids.length === 0) return { available: {}, ok: true }
  const { data, error } = await supabase.from('products').select('id, size_stock').in('id', ids)
  if (error) return { available: {}, ok: false }
  const stockById = Object.fromEntries((data || []).map((p) => [p.id, p.size_stock || []]))
  const available = {}
  lines.forEach((l) => {
    const entry = (stockById[l.productId] || []).find((s) => s.size === l.size)
    available[lineKey(l.productId, l.size)] = entry ? Math.max(0, Number(entry.stock) || 0) : 0
  })
  return { available, ok: true }
}

// Applies live availability to the cart and describes anything that changed.
function reconcile(lines, available) {
  const issues = []
  const next = []
  lines.forEach((l) => {
    const max = available[lineKey(l.productId, l.size)]
    if (max === undefined) {
      next.push(l)
    } else if (max <= 0) {
      issues.push(`${l.name}${l.size ? ` (${l.size})` : ''} is sold out and was removed from your bag.`)
    } else if (l.qty > max) {
      issues.push(`Only ${max} of ${l.name}${l.size ? ` (${l.size})` : ''} ${max === 1 ? 'is' : 'are'} left, so we adjusted your bag.`)
      next.push({ ...l, qty: max, maxQty: max })
    } else {
      next.push({ ...l, maxQty: max })
    }
  })
  return { next, issues }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => load(STORAGE_KEY, []))
  const [discount, setDiscount] = useState(() => load(DISCOUNT_KEY, null))
  const [stockNotice, setStockNotice] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    localStorage.setItem(DISCOUNT_KEY, JSON.stringify(discount))
  }, [discount])

  // Refresh limits from the database whenever the set of items in the bag changes.
  const signature = items.map((i) => lineKey(i.productId, i.size)).join('|')
  useEffect(() => {
    if (!signature) return
    let active = true
    fetchAvailability(items).then(({ available, ok }) => {
      if (!active || !ok) return
      const { next, issues } = reconcile(items, available)
      setItems((prev) =>
        prev.flatMap((line) => {
          const match = next.find((n) => lineKey(n.productId, n.size) === lineKey(line.productId, line.size))
          if (!match) return []
          return [{ ...line, maxQty: match.maxQty, qty: Math.min(line.qty, match.maxQty ?? line.qty) }]
        })
      )
      if (issues.length) setStockNotice(issues.join(' '))
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const qtyInCart = (productId, size) =>
    items.find((i) => lineKey(i.productId, i.size) === lineKey(productId, size))?.qty || 0

  // Never lets a line go above the stock for its size. Returns how many were added.
  const addItem = (product, { size = '', qty = 1, price = product.price } = {}) => {
    const entry = (product.size_stock || []).find((s) => s.size === size)
    const maxQty = entry ? Math.max(0, Number(entry.stock) || 0) : 0
    const key = lineKey(product.id, size)
    const already = items.find((i) => lineKey(i.productId, i.size) === key)?.qty || 0
    const added = Math.max(0, Math.min(qty, maxQty - already))

    if (added > 0) {
      setItems((prev) => {
        const existing = prev.find((i) => lineKey(i.productId, i.size) === key)
        const have = existing?.qty || 0
        const room = Math.min(qty, maxQty - have)
        if (room <= 0) return prev
        if (existing) {
          return prev.map((i) => (lineKey(i.productId, i.size) === key ? { ...i, qty: i.qty + room, price, maxQty } : i))
        }
        return [
          ...prev,
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            price,
            image: product.images?.[0] || '',
            size,
            qty: room,
            maxQty,
          },
        ]
      })
    }
    return { added, capped: added < qty }
  }

  const removeItem = (productId, size) => {
    setItems((prev) => prev.filter((i) => lineKey(i.productId, i.size) !== lineKey(productId, size)))
  }

  const updateQty = (productId, size, qty) => {
    if (qty < 1) return
    setItems((prev) =>
      prev.map((i) =>
        lineKey(i.productId, i.size) === lineKey(productId, size)
          ? { ...i, qty: Math.min(qty, i.maxQty ?? qty) }
          : i
      )
    )
  }

  const clearCart = () => {
    setItems([])
    setDiscount(null)
  }

  // Used right before placing an order: checks live stock and fixes the bag if needed.
  const checkStock = useCallback(async () => {
    const { available, ok } = await fetchAvailability(items)
    if (!ok) return { ok: true }
    const { next, issues } = reconcile(items, available)
    if (issues.length === 0) return { ok: true }
    setItems(next)
    const message = issues.join(' ')
    setStockNotice(message)
    return { ok: false, message }
  }, [items])

  const subtotal = useMemo(() => round2(items.reduce((sum, i) => sum + i.price * i.qty, 0)), [items])
  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items])
  const discountAmount = useMemo(() => discountAmountFor(discount, subtotal), [discount, subtotal])
  const total = round2(subtotal - discountAmount)

  const applyCode = async (code) => {
    const { data, error } = await supabase.rpc('validate_discount_code', {
      p_code: code,
      p_subtotal: subtotal,
    })
    if (error || !data) return { ok: false, message: 'Could not check that code. Please try again.' }
    if (!data.valid) return { ok: false, message: data.message }
    setDiscount({
      code: data.code,
      type: data.type,
      value: Number(data.value),
      min_subtotal: Number(data.min_subtotal),
    })
    return { ok: true }
  }

  const removeCode = () => setDiscount(null)

  const value = {
    items,
    addItem,
    removeItem,
    updateQty,
    qtyInCart,
    clearCart,
    checkStock,
    stockNotice,
    dismissStockNotice: () => setStockNotice(''),
    subtotal,
    totalCount,
    discount,
    discountAmount,
    total,
    applyCode,
    removeCode,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
