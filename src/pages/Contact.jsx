import { MessageCircle, Camera } from 'lucide-react'
import { INSTAGRAM_HANDLE, INSTAGRAM_LINK, WHATSAPP_DISPLAY, WHATSAPP_LINK } from '../lib/contact'
import './Contact.css'

export default function Contact() {
  return (
    <div className="container contact-page">
      <h1>Get in touch</h1>
      <p className="contact-sub">Questions about sizing, an order, or a custom request? We'd love to hear from you.</p>

      <div className="contact-cards">
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="contact-card">
          <MessageCircle size={26} />
          <span>WhatsApp us · {WHATSAPP_DISPLAY}</span>
        </a>
        <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" className="contact-card">
          <Camera size={26} />
          <span>@{INSTAGRAM_HANDLE}</span>
        </a>
      </div>
    </div>
  )
}
