'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Custom hook to sync component state with URL query parameters in Next.js
 * @param {string} key - The query parameter key
 * @param {string} defaultValue - Default value when parameter is not present
 * @returns {[string, function]} - Current value and setter function
 */
export function useQueryParamState(key, defaultValue = '') {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (newValue, options = {}) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()))
      
      if (newValue === null || newValue === undefined || newValue === defaultValue || newValue === '') {
        current.delete(key)
      } else {
        current.set(key, newValue)
      }

      const search = current.toString()
      const query = search ? `?${search}` : ''

      // Use replace to avoid cluttering browser history with filter changes
      if (options.replace !== false) {
        router.replace(`${pathname}${query}`, { scroll: false })
      } else {
        router.push(`${pathname}${query}`, { scroll: false })
      }
    },
    [key, defaultValue, searchParams, router, pathname]
  )

  return [value, setValue]
}