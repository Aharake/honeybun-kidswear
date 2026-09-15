import { Mail, MessageCircle, Camera } from 'lucide-react'
import './Contact.css'

export default function Contact() {
  return (
    <div className="container contact-page">
      <h1>Get in touch</h1>
      <p className="contact-sub">Questions about sizing, an order, or a custom request? We'd love to hear from you.</p>

      <div className="contact-cards">
        <a href="mailto:hello@honeybunkidswear.com" className="contact-card">
          <Mail size={26} />
          <span>hello@honeybunkidswear.com</span>
        </a>
        <a href="https://wa.me/00000000000" target="_blank" rel="noopener noreferrer" className="contact-card">
          <MessageCircle size={26} />
          <span>WhatsApp us</span>
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="contact-card">
          <Camera size={26} />
          <span>@honeybunkidswear</span>
        </a>
      </div>
    </div>
  )
}
