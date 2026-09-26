import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { adjustStyle, DEFAULT_ADJUST, MAX_ZOOM, MIN_ZOOM } from '../lib/imageAdjust'
import './PhotoAdjuster.css'

const FRAME_ASPECT = 3 / 4
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

export default function PhotoAdjuster({ src, value, name, price, onApply, onClose }) {
  const [adj, setAdj] = useState(value || DEFAULT_ADJUST)
  const [natural, setNatural] = useState(null)
  const frameRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  // Mouse-wheel zoom needs a non-passive listener so the page doesn't scroll too.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      setAdj((a) => ({ ...a, zoom: clamp(Number((a.zoom - e.deltaY * 0.002).toFixed(3)), MIN_ZOOM, MAX_ZOOM) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const setZoom = (zoom) => setAdj((a) => ({ ...a, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }))
  const zoomed = adj.zoom > 1.001

  const handlePointerDown = (e) => {
    if (!zoomed) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, x: adj.x, y: adj.y }
  }

  const handlePointerMove = (e) => {
    if (!drag.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = (e.clientX - drag.current.sx) / rect.width
    const dy = (e.clientY - drag.current.sy) / rect.height
    const k = 1 / (adj.zoom - 1)
    const { x, y } = drag.current
    setAdj((a) => ({ ...a, x: clamp(x - dx * k, 0, 1), y: clamp(y - dy * k, 0, 1) }))
  }

  const handlePointerUp = () => {
    drag.current = null
  }

  const fillFrame = () => {
    if (!natural) return
    const ratio = natural.w / natural.h
    const zoom = ratio < FRAME_ASPECT ? FRAME_ASPECT / ratio : ratio / FRAME_ASPECT
    setAdj({ zoom: clamp(Number(zoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM), x: 0.5, y: 0.5 })
  }

  const style = adjustStyle(adj)

  return (
    <div className="adjuster-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Adjust photo">
      <div className="adjuster" onClick={(e) => e.stopPropagation()}>
        <div className="adjuster-head">
          <h2>Adjust photo</h2>
          <button type="button" className="admin-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="adjuster-body">
          <div>
            <div
              className={`adjuster-frame ${zoomed ? 'is-draggable' : ''}`}
              ref={frameRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={src}
                alt=""
                draggable="false"
                style={style}
                onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
              />
            </div>
            <p className="adjuster-hint">This is exactly how it looks on your website. Drag to move it, scroll or use the slider to zoom.</p>
          </div>

          <div className="adjuster-side">
            <label className="adjuster-label" htmlFor="zoom">Zoom · {Math.round(adj.zoom * 100)}%</label>
            <div className="adjuster-zoom">
              <button type="button" className="adjuster-step" onClick={() => setZoom(adj.zoom - 0.1)} aria-label="Zoom out">
                <Minus size={16} />
              </button>
              <input
                id="zoom"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={adj.zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <button type="button" className="adjuster-step" onClick={() => setZoom(adj.zoom + 0.1)} aria-label="Zoom in">
                <Plus size={16} />
              </button>
            </div>

            <div className="adjuster-quick">
              <button type="button" className="btn btn-secondary" onClick={() => setAdj(DEFAULT_ADJUST)}>
                Fit whole photo
              </button>
              <button type="button" className="btn btn-secondary" onClick={fillFrame} disabled={!natural}>
                Fill the frame
              </button>
            </div>

            <p className="adjuster-label" style={{ marginTop: 18 }}>On the shop page</p>
            <div className="adjuster-mini">
              <div className="adjuster-mini-frame">
                <img src={src} alt="" draggable="false" style={style} />
              </div>
              <div className="adjuster-mini-text">
                <span>{name || 'Product name'}</span>
                {price ? <strong>${Number(price).toFixed(2)}</strong> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="adjuster-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(adj)}>Apply</button>
        </div>
      </div>
    </div>
  )
}
