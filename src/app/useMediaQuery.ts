import { useEffect, useState } from 'react'

// Reactive CSS media-query match. Used to switch the mobile two-screen flow on
// only for narrow viewports while desktop keeps the side-panel layout.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mql = window.matchMedia(query)
    // Only update from the listener (async) — keeps the initial value from the
    // lazy useState above and avoids a synchronous setState in the effect body.
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', onChange)

    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
