'use client'

interface AgendaActionItem {
  id?: string
  description?: string
  responsible?: string
  dueDate?: string
}

interface AgendaItem {
  id?: string
  title: string
  description?: string
  content?: string
  actionItems?: AgendaActionItem[]
}

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/ui/navbar'
import type { Meeting } from '@/types/meeting'

export default function MeetingDetailPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const meetingId = params.id as string
  
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const fetchMeeting = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/meetings/${meetingId}`)
      if (response.ok) {
        const meetingData = await response.json()
        setMeeting(meetingData)
      } else if (response.status === 404) {
        setError('Reunião não encontrada')
      } else {
        setError('Erro ao carregar reunião')
      }
    } catch (error) {
      console.error('Error fetching meeting:', error)
      setError('Erro ao carregar reunião')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    if (session && meetingId) {
      fetchMeeting()
    }
  }, [session, meetingId, fetchMeeting])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.slice(0, 5)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-PT')
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Precisa fazer login para ver esta reunião.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-red-500">{error}</p>
            <Link
              href="/meetings"
              className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Voltar às Reuniões
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Handle both old and new agenda format
  let agendaItems: AgendaItem[] = []
  let attendeeNames: string[] = []

  if (Array.isArray(meeting.agenda)) {
    // Old format - just agenda items
    agendaItems = meeting.agenda
  } else {
    // New format - object with items and attendee data
    const agendaObj = meeting.agenda as { items?: AgendaItem[], attendeeNames?: string[] }
    agendaItems = agendaObj?.items || []
    attendeeNames = agendaObj?.attendeeNames || []
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md transition-colors">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {meeting.identifier}
                </h1>
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {meeting.meetingType.name}
                  </span>
                  <span>{formatDate(meeting.date)}</span>
                  {(meeting.startTime || meeting.endTime) && (
                    <span>
                      {meeting.startTime && formatTime(meeting.startTime)}
                      {meeting.startTime && meeting.endTime && ' - '}
                      {meeting.endTime && formatTime(meeting.endTime)}
                    </span>
                  )}
                </div>
                {meeting.location && (
                  <p className="text-gray-600 dark:text-gray-300 mt-1">📍 {meeting.location}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Link
                  href={`/meetings/${meeting.id}/edit`}
                  className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  Editar
                </Link>
                <button
                  onClick={async () => {
                    if (pdfUrl) { setPdfUrl(null); return }
                    setPdfLoading(true)
                    try {
                      const res = await fetch(`/api/meetings/${meeting.id}/pdf`)
                      if (res.ok) {
                        const blob = await res.blob()
                        setPdfUrl(URL.createObjectURL(blob))
                      }
                    } catch (err) {
                      console.error('Error generating PDF:', err)
                    } finally {
                      setPdfLoading(false)
                    }
                  }}
                  disabled={pdfLoading}
                  className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50"
                >
                  {pdfLoading ? 'Gerando...' : pdfUrl ? 'Fechar PDF' : 'Gerar PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* Inline PDF Viewer */}
          {pdfUrl && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pré-visualização</h3>
                <a
                  href={`/api/meetings/${meeting.id}/pdf?download=true`}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Descarregar PDF
                </a>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                style={{ height: '80vh' }}
              />
            </div>
          )}

          <div className="p-6 space-y-8">
            {/* Meeting Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Informações</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p><span className="font-medium">Criado por:</span> {meeting.createdBy.name || meeting.createdBy.email}</p>
                  <p><span className="font-medium">Criado em:</span> {formatDateTime(meeting.createdAt)}</p>
                  {meeting.updatedAt && meeting.updatedAt !== meeting.createdAt && (
                    <p><span className="font-medium">Atualizado em:</span> {formatDateTime(meeting.updatedAt)}</p>
                  )}
                </div>
              </div>

              {/* Attendees */}
              {attendeeNames.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Participantes</h3>
                  <div className="flex flex-wrap gap-2">
                    {attendeeNames.map((name: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Agenda & Content */}
            {agendaItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ordem de Trabalhos</h3>
                <div className="space-y-4">
                  {agendaItems.map((item: AgendaItem, index: number) => (
                    <div key={item.id || index} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {index + 1}. {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{item.description}</p>
                      )}
                      {item.content && item.content.trim() !== '' && (
                        <div
                          className="prose max-w-none text-gray-700 dark:text-gray-300 mt-2"
                          dangerouslySetInnerHTML={{ __html: item.content }}
                        />
                      )}
                      {item.actionItems && item.actionItems.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações a Tomar</p>
                          {item.actionItems.map((action, aIndex) => (
                            <div key={action.id || aIndex} className="border border-orange-200 dark:border-orange-800 rounded-lg p-3 bg-orange-50 dark:bg-orange-900/20">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{action.description}</p>
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex gap-3">
                                {action.responsible && (
                                  <span><span className="font-medium">Responsável:</span> {action.responsible}</span>
                                )}
                                {action.dueDate && (
                                  <span><span className="font-medium">Prazo:</span> {new Date(action.dueDate).toLocaleDateString('pt-PT')}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <Link
                href="/meetings"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Voltar às Reuniões
              </Link>
              
              <div className="text-sm text-gray-500">
                {meeting.identifier}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}