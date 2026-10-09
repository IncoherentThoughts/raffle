import { useState } from 'react'
import { publicEntryUrl } from '../../../lib/api/entries'
import { Button } from '../ui'

/** The public entry page URL in a read-only field with a Copy button. */
export function ShareLink() {
  const url = publicEntryUrl()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: select the text so Cmd/Ctrl+C works.
      document.getElementById('entries-share-url')?.focus()
    }
  }

  return (
    <div className="entries__share">
      <input
        id="entries-share-url"
        className="field"
        readOnly
        value={url}
        aria-label="Public link"
        onFocus={(e) => e.target.select()}
      />
      <Button variant="primary" onClick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  )
}
