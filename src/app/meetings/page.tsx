'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import Link from 'next/link'
import { Navbar } from '@/components/ui/navbar'
import { MeetingListSkeleton } from '@/components/ui/skeleton'
import type { Meeting, MeetingResponse } from '@/types/meeting'

export default function MeetingsPage() {
  const { user: session } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    if (session) {
      fetchMeetings(currentPage)
    }
  }, [session, currentPage])

  const fetchMeetings = async (page: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/meetings?page=${page}&limit=10`)
      if (response.ok) {
        const data: MeetingResponse = await response.json()
        setMeetings(data.meetings)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.slice(0, 5) // Remove seconds
  }

  const deleteMeeting = async (meetingId: string, meetingIdentifier: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar reunião',
      message: `Tem certeza que deseja eliminar a reunião "${meetingIdentifier}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return

    startLoading('A eliminar...')
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showToast('Reunião eliminada com sucesso', 'success')
        await fetchMeetings(currentPage)
      } else {
        showToast('Erro ao eliminar reunião', 'error')
      }
    } catch (error) {
      console.error('Error deleting meeting:', error)
      showToast('Erro ao eliminar reunião', 'error')
    } finally {
      stopLoading()
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-900 dark:text-gray-100">Precisa fazer login para ver as reuniões.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reuniões</h1>
          <Link
            href="/meetings/new"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Nova Reunião
          </Link>
        </div>

        {loading ? (
          <MeetingListSkeleton />
        ) : meetings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Ainda não há reuniões criadas.</p>
            <Link
              href="/meetings/new"
              className="inline-block bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Criar Primeira Reunião
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {meeting.identifier}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {meeting.meetingType.name}
                      </span>
                    </div>
                    
                    <div className="text-gray-600 dark:text-gray-300 space-y-1">
                      <p className="font-medium">{formatDate(meeting.date)}</p>
                      {(meeting.startTime || meeting.endTime) && (
                        <p>
                          {meeting.startTime && formatTime(meeting.startTime)}
                          {meeting.startTime && meeting.endTime && ' - '}
                          {meeting.endTime && formatTime(meeting.endTime)}
                        </p>
                      )}
                      {meeting.location && (
                        <p>📍 {meeting.location}</p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Criado por {meeting.createdBy.name || meeting.createdBy.email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/meetings/${meeting.id}/edit`}
                      className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/meetings/${meeting.id}/pdf`}
                      className="bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      PDF
                    </Link>
                    <button
                      onClick={() => deleteMeeting(meeting.id, meeting.identifier)}
                      className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Anterior
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Próxima
            </button>
          </div>
        )}

        {pagination.total > 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
            Mostrando {((currentPage - 1) * pagination.limit) + 1} a {Math.min(currentPage * pagination.limit, pagination.total)} de {pagination.total} reuniões
          </div>
        )}
      </main>
    </div>
  )
}