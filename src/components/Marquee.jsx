import './Marquee.css'

// Enough copies that the track is always wider than any realistic viewport,
// so the seamless -100%/REPEATS loop never runs out of content mid-scroll.
const REPEATS = 8

export default function Marquee({ items, variant = 'bar', separator = '·' }) {
  return (
    <div className={`marquee marquee-${variant}`}>
      <div className="marquee-track" style={{ '--marquee-repeats': REPEATS }}>
        {Array.from({ length: REPEATS }, (_, rep) => (
          <div className="marquee-group" key={rep} aria-hidden={rep > 0}>
            {items.map((item, i) => (
              <span className="marquee-item" key={i}>
                {item}
                <span className="marquee-sep" aria-hidden="true">{separator}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
