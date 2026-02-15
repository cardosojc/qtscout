'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/ui/navbar'

export default function MeetingPDFPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const meetingId = params.id as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const downloadInitiated = useRef(false)

  const handleDownloadPDF = useCallback(async () => {
    if (!session || loading) return

    setLoading(true)
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
      setLoading(false)
    }
  }, [session, meetingId, loading])

  useEffect(() => {
    // Auto-download PDF when page loads - only run once when session becomes available
    if (session && !downloadInitiated.current) {
      downloadInitiated.current = true
      handleDownloadPDF()
    }
  }, [session, handleDownloadPDF])

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Precisa fazer login para gerar PDF.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center transition-colors">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Gerar PDF da Reunião
            </h1>
          </div>

          {loading && (
            <div className="mb-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-600">Gerando PDF...</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && (
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
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Gerando...' : 'Descarregar PDF'}
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
    </div>
  )
}