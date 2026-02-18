'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useLoading } from '@/components/ui/loading-overlay'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default function MeetingPDFPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const meetingId = params.id as string

  const [error, setError] = useState<string | null>(null)
  const downloadInitiated = useRef(false)
  const { startLoading, stopLoading } = useLoading()

  const handleDownloadPDF = useCallback(async () => {
    if (!session) return

    startLoading('A gerar PDF...')
    setError(null)

    try {
      const response = await fetch(`/api/meetings/${meetingId}/pdf`)

      if (!response.ok) {
        throw new Error('Erro ao gerar PDF')
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `reuniao-${meetingId}.pdf`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      setError('Erro ao fazer download do PDF')
    } finally {
      stopLoading()
    }
  }, [session, meetingId, startLoading, stopLoading])

  useEffect(() => {
    // Auto-download PDF when page loads - only run once when session becomes available
    if (session && !downloadInitiated.current) {
      downloadInitiated.current = true
      handleDownloadPDF()
    }
  }, [session, handleDownloadPDF])

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p>Precisa fazer login para gerar PDF.</p>
        </div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Reuniões', href: '/meetings' },
        { label: meetingId, href: `/meetings/${meetingId}` },
        { label: 'PDF' },
      ]} />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center transition-colors">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">📄</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Gerar PDF da Reunião
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {!error && (
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              O PDF será descarregado automaticamente. Se não começar, clique no botão abaixo.
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              downloadInitiated.current = false
              handleDownloadPDF()
            }}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Descarregar PDF
          </button>

          <Link
            href={`/meetings/${meetingId}`}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200"
          >
            Voltar à Reunião
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>💡 O PDF incluirá cabeçalho e rodapé personalizados do agrupamento</p>
        </div>
      </div>
    </main>
  )
}
