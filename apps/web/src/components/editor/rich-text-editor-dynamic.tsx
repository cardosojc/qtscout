'use client'
import dynamic from 'next/dynamic'

// Lazy-load the TipTap editor so its (heavy) bundle is only fetched on pages
// that actually mount it, instead of shipping in the shared chunk. ssr: false
// because the editor is client-only. The skeleton mirrors the editor's outer
// frame so the layout doesn't jump while the chunk loads.
function EditorSkeleton() {
  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-600 px-2 py-2">
        <div className="h-6 w-40 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="p-4">
        <div className="h-40 bg-gray-50 dark:bg-gray-900/40 rounded animate-pulse" />
      </div>
    </div>
  )
}

export const RichTextEditor = dynamic(
  () => import('./rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <EditorSkeleton /> }
)
