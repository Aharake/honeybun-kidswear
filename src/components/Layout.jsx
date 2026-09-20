import { Outlet } from 'react-router-dom'
import Marquee from './Marquee'
import Navbar from './Navbar'
import Footer from './Footer'

const ANNOUNCEMENTS = ['Cash on delivery', 'Newborn to 6 years', 'New arrivals every week']

export default function Layout() {
  return (
    <>
      <Marquee items={ANNOUNCEMENTS} variant="bar" />
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
