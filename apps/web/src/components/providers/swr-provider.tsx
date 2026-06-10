'use client'
import { SWRConfig } from 'swr'
import { apiGet } from '@/lib/api-client'

/**
 * App-wide SWR defaults. The fetcher treats the SWR key as the API path, so
 * hooks key on `/api/...` strings. `keepPreviousData` keeps lists from flashing
 * empty while a new page/filter loads; focus revalidation is off because this is
 * an internal tool and the background-on-navigation revalidation is enough.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (key: string) => apiGet(key),
        revalidateOnFocus: false,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
