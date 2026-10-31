import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { SaleProvider } from './context/SaleContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import Tracker from './components/Tracker'

import Home from './pages/Home'
const Shop = lazy(() => import('./pages/Shop'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
const Contact = lazy(() => import('./pages/Contact'))
const Account = lazy(() => import('./pages/Account'))
const Exchanges = lazy(() => import('./pages/Exchanges'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm'))
const AdminCollections = lazy(() => import('./pages/admin/AdminCollections'))
const AdminCollectionForm = lazy(() => import('./pages/admin/AdminCollectionForm'))
const AdminBulkAdd = lazy(() => import('./pages/admin/AdminBulkAdd'))
const AdminSale = lazy(() => import('./pages/admin/AdminSale'))
const AdminDiscounts = lazy(() => import('./pages/admin/AdminDiscounts'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))

// Only the home page is in the first download. Every other page (and the whole
// admin area with its charts) loads when someone opens it.
function PageFallback() {
  return <div className="page container" style={{ minHeight: '60vh' }} aria-busy="true" />
}

if (typeof window !== 'undefined') {
  // Once the home page has settled, quietly fetch the pages people go to next.
  const warm = () => {
    import('./pages/Shop')
    import('./pages/ProductDetail')
    import('./pages/Cart')
  }
  window.addEventListener('load', () => ('requestIdleCallback' in window ? window.requestIdleCallback(warm) : setTimeout(warm, 2000)), { once: true })
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Tracker />
        <CartProvider>
          <SaleProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/account" element={<Account />} />
              <Route path="/exchanges" element={<Exchanges />} />
              <Route path="/account/reset" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="products" replace />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/bulk" element={<AdminBulkAdd />} />
              <Route path="products/new" element={<AdminProductForm />} />
              <Route path="products/:id/edit" element={<AdminProductForm />} />
              <Route path="collections" element={<AdminCollections />} />
              <Route path="collections/new" element={<AdminCollectionForm />} />
              <Route path="collections/:id/edit" element={<AdminCollectionForm />} />
              <Route path="sale" element={<AdminSale />} />
              <Route path="discounts" element={<AdminDiscounts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
          </Routes>
          </Suspense>
          </SaleProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
