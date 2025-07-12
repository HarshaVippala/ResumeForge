import { useState, useEffect } from 'react'

/**
 * Custom hook to detect media query matches
 * @param query - Media query string (e.g., '(max-width: 640px)')
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    
    // Set initial value
    setMatches(media.matches)

    // Define listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add listener
    if (media.addEventListener) {
      media.addEventListener('change', listener)
    } else {
      // Fallback for older browsers
      media.addListener(listener)
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener)
      } else {
        // Fallback for older browsers
        media.removeListener(listener)
      }
    }
  }, [query])

  return matches
}