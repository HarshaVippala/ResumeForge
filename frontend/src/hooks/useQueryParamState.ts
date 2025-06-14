'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

interface SetValueOptions {
  replace?: boolean;
}

/**
 * Custom hook to sync component state with URL query parameters in Next.js
 */
export function useQueryParamState(key: string, defaultValue: string = ''): [string, (newValue: string, options?: SetValueOptions) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (newValue: string, options: SetValueOptions = {}) => {
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