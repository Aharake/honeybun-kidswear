import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ImageCarousel.css'

export default function ImageCarousel({ images, alt, badge }) {
  const viewportRef = useRef(null)
  const [index, setIndex] = useState(0)
  const multiple = images.length > 1

  const goTo = (i) => {
    const el = viewportRef.current
    if (!el) return
    const next = Math.max(0, Math.min(images.length - 1, i))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  const handleScroll = () => {
    const el = viewportRef.current
    if (!el) return
    const current = Math.round(el.scrollLeft / el.clientWidth)
    if (current !== index) setIndex(current)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(index + 1)
    }
  }

  if (images.length === 0) {
    return (
      <div className="carousel">
        <div className="carousel-stage">
          <div className="carousel-viewport carousel-empty">🧸</div>
          {badge && <span className="carousel-badge">{badge}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="carousel">
      <div className="carousel-stage">
        <div
          className="carousel-viewport"
          ref={viewportRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          tabIndex={multiple ? 0 : undefined}
          aria-roledescription={multiple ? 'carousel' : undefined}
          aria-label={`${alt} photos`}
        >
          {images.map((src, i) => (
            <div className="carousel-slide" key={src} aria-label={`Photo ${i + 1} of ${images.length}`}>
              <img src={src} alt={i === 0 ? alt : ''} draggable="false" />
            </div>
          ))}
        </div>

        {badge && <span className="carousel-badge">{badge}</span>}

        {multiple && (
          <>
            <button
              className="carousel-arrow carousel-arrow-prev"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className="carousel-arrow carousel-arrow-next"
              onClick={() => goTo(index + 1)}
              disabled={index === images.length - 1}
              aria-label="Next photo"
            >
              <ChevronRight size={22} />
            </button>
            <span className="carousel-counter">{index + 1} / {images.length}</span>
            <div className="carousel-dots">
              {images.map((src, i) => (
                <button
                  key={src}
                  className={`carousel-dot ${i === index ? 'is-active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {multiple && (
        <div className="carousel-thumbs">
          {images.map((src, i) => (
            <button
              key={src}
              className={`carousel-thumb ${i === index ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
