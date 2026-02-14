"use client"

import { useEffect } from 'react'

export default function HydrationWatcher() {
  useEffect(() => {
    const origConsoleError = console.error
    console.error = (...args: any[]) => {
      try {
        const joined = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        if (joined.includes('Text content does not match server-rendered HTML') || joined.includes('hydration')) {
          // attach a visible marker for quick inspection
          const marker = document.createElement('div')
          marker.id = 'hydration-warning'
          marker.style.position = 'fixed'
          marker.style.right = '8px'
          marker.style.bottom = '8px'
          marker.style.zIndex = '9999'
          marker.style.background = 'rgba(220,38,38,0.9)'
          marker.style.color = 'white'
          marker.style.padding = '8px 10px'
          marker.style.borderRadius = '6px'
          marker.style.fontSize = '12px'
          marker.textContent = 'Hydration mismatch detected — open console for details.'
          document.body.appendChild(marker)
        }
      } catch (e) {
        // ignore
      }
      origConsoleError.apply(console, args)
    }

    const onErr = (ev: ErrorEvent) => {
      try {
        if (ev.message && ev.message.includes('Hydration')) {
          const marker = document.getElementById('hydration-warning') || document.createElement('div')
          marker.id = 'hydration-warning'
          marker.textContent = 'Hydration runtime error: ' + ev.message
          marker.style.position = 'fixed'
          marker.style.right = '8px'
          marker.style.bottom = '8px'
          marker.style.zIndex = '9999'
          marker.style.background = 'rgba(220,38,38,0.9)'
          marker.style.color = 'white'
          marker.style.padding = '8px 10px'
          marker.style.borderRadius = '6px'
          marker.style.fontSize = '12px'
          document.body.appendChild(marker)
        }
      } catch (e) {}
    }

    window.addEventListener('error', onErr)

    return () => {
      console.error = origConsoleError
      window.removeEventListener('error', onErr)
      const m = document.getElementById('hydration-warning')
      if (m && m.parentNode) m.parentNode.removeChild(m)
    }
  }, [])

  return null
}
