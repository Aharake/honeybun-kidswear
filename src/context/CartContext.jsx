import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'honeybun_cart'

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function lineKey(productId, size) {
  return `${productId}::${size || ''}`
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = (product, { size = '', qty = 1 } = {}) => {
    setItems((prev) => {
      const key = lineKey(product.id, size)
      const existing = prev.find((i) => lineKey(i.productId, i.size) === key)
      if (existing) {
        return prev.map((i) =>
          lineKey(i.productId, i.size) === key ? { ...i, qty: i.qty + qty } : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '',
          size,
          qty,
        },
      ]
    })
  }

  const removeItem = (productId, size) => {
    setItems((prev) => prev.filter((i) => lineKey(i.productId, i.size) !== lineKey(productId, size)))
  }

  const updateQty = (productId, size, qty) => {
    if (qty < 1) return
    setItems((prev) =>
      prev.map((i) => (lineKey(i.productId, i.size) === lineKey(productId, size) ? { ...i, qty } : i))
    )
  }

  const clearCart = () => setItems([])

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items])
  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items])

  const value = { items, addItem, removeItem, updateQty, clearCart, subtotal, totalCount }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
