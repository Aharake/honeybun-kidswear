import { Link } from 'react-router-dom'
import './SeasonBanner.css'

// A wide banner for a seasonal collection. On the home page it links to the
// collection; at the top of the shop (compact) it just introduces it.
export default function SeasonBanner({ collection, compact = false }) {
  const content = (
    <>
      {collection.banner_url ? (
        <img src={collection.banner_url} alt="" className="season-banner-image" loading={compact ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <div className="season-banner-image season-banner-fallback" />
      )}
      <div className="season-banner-scrim" />
      <div className="season-banner-body">
        <p className="season-banner-eyebrow">{compact ? 'COLLECTION' : 'NEW COLLECTION'}</p>
        <h2 className="season-banner-title">{collection.name}</h2>
        {collection.tagline && <p className="season-banner-tagline">{collection.tagline}</p>}
        {!compact && <span className="season-banner-cta">Shop {collection.name} →</span>}
      </div>
    </>
  )

  if (compact) return <div className="season-banner is-compact">{content}</div>
  return (
    <Link to={`/shop?collection=${encodeURIComponent(collection.slug)}`} className="season-banner">
      {content}
    </Link>
  )
}

// Holds the space a banner will take while the shop is deciding whether to show one.
export function SeasonBannerSkeleton() {
  return <div className="season-banner season-banner-skeleton" aria-hidden="true" />
}
