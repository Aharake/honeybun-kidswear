import { useState } from 'react'
import { ImageDown } from 'lucide-react'
import { BIG_PHOTO_BYTES, scanPhotos, shrinkPhotos } from '../lib/optimizePhotos'

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`

// Admin tool: finds product photos that are far bigger than the shop needs
// (usually straight from a phone) and replaces them with light copies.
export default function PhotoOptimizer({ products, onDone }) {
  const [phase, setPhase] = useState('idle') // idle | scanning | scanned | shrinking | done
  const [progress, setProgress] = useState('')
  const [scan, setScan] = useState(null)
  const [result, setResult] = useState(null)

  const handleScan = async () => {
    setPhase('scanning')
    setProgress('')
    const found = await scanPhotos(products, (done, total) => setProgress(`Checking photo ${done} of ${total}…`))
    setScan(found)
    setPhase('scanned')
  }

  const handleShrink = async () => {
    setPhase('shrinking')
    const urls = new Set(scan.big.map((b) => b.url))
    const outcome = await shrinkPhotos(products, urls, (done, total) => setProgress(`Shrinking photo ${done} of ${total}…`))
    setResult(outcome)
    setPhase('done')
    onDone?.()
  }

  return (
    <div className="admin-optimizer">
      <div className="admin-optimizer-icon">
        <ImageDown size={22} />
      </div>
      <div className="admin-optimizer-body">
        <p className="admin-optimizer-title">Photo sizes</p>

        {phase === 'idle' && (
          <>
            <p className="admin-field-hint" style={{ marginBottom: 10 }}>
              Photos straight from a phone can be 3 MB or more, which makes the shop slow to open. This finds the heavy
              ones and swaps in light copies that look the same on screen.
            </p>
            <button type="button" className="btn btn-secondary" onClick={handleScan}>
              Check my photos
            </button>
          </>
        )}

        {(phase === 'scanning' || phase === 'shrinking') && <p className="admin-field-hint">{progress || 'Working…'} Please keep this page open.</p>}

        {phase === 'scanned' && scan && (
          <>
            {scan.big.length === 0 ? (
              <p className="admin-field-hint" style={{ marginBottom: 0 }}>
                All {scan.total} photos are a good size ({mb(scan.totalBytes)} in total). Nothing to do.
              </p>
            ) : (
              <>
                <p className="admin-field-hint" style={{ marginBottom: 10 }}>
                  <strong>{scan.big.length}</strong> of your {scan.total} photos are over {Math.round(BIG_PHOTO_BYTES / 1024)} KB
                  ({mb(scan.bigBytes)} together). Your originals are kept in storage; products just switch to the lighter copies.
                </p>
                <button type="button" className="btn btn-primary" onClick={handleShrink}>
                  Shrink {scan.big.length} photo{scan.big.length === 1 ? '' : 's'}
                </button>
              </>
            )}
          </>
        )}

        {phase === 'done' && result && (
          <p className="admin-field-hint" style={{ marginBottom: 0 }}>
            Done. <strong>{result.shrunk}</strong> photo{result.shrunk === 1 ? '' : 's'} shrunk, saving {mb(result.savedBytes)}.
            {result.failed > 0 && ` ${result.failed} could not be changed. Try again, or re-upload those photos from the product page.`}
          </p>
        )}
      </div>
    </div>
  )
}
