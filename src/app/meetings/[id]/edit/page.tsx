'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useRouter, useParams } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { MeetingForm, type MeetingFormData } from '@/components/meetings/meeting-form'
import type { AgendaItem } from '@/types/meeting'

export default function EditMeetingPage() {
  const { user: session } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const params = useParams()
  const meetingId = params.id as string

  const [initialLoading, setInitialLoading] = useState(true)
  const [meetingFound, setMeetingFound] = useState(true)

  // Raw meeting data from API
  const [meetingData, setMeetingData] = useState<{
    meetingTypeId: string
    date: string
    startTime: string
    endTime: string
    location: string
    agendaItems: AgendaItem[]
    attendees: string[]
    chefeAgrupamento: string
    secretario: string
  } | null>(null)

  const fetchMeeting = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`)
      if (response.ok) {
        const data = await response.json()

        const agendaObj = data.agenda as { items?: AgendaItem[], attendeeNames?: string[], chefeAgrupamento?: string, secretario?: string } | AgendaItem[]

        let loadedItems: AgendaItem[] = []
        let attendees: string[] = []
        let chefeAgrupamento = ''
        let secretario = ''

        if (Array.isArray(agendaObj)) {
          loadedItems = agendaObj
        } else {
          loadedItems = agendaObj?.items || []
          attendees = agendaObj?.attendeeNames || []
          chefeAgrupamento = agendaObj?.chefeAgrupamento || ''
          secretario = agendaObj?.secretario || ''
        }

        setMeetingData({
          meetingTypeId: data.meetingTypeId,
          date: new Date(data.date).toISOString().split('T')[0],
          startTime: data.startTime || '',
          endTime: data.endTime || '',
          location: data.location || '',
          agendaItems: loadedItems,
          attendees,
          chefeAgrupamento,
          secretario,
        })
      } else {
        setMeetingFound(false)
      }
    } catch (error) {
      console.error('Error fetching meeting:', error)
      setMeetingFound(false)
    } finally {
      setInitialLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    if (meetingId) fetchMeeting()
  }, [meetingId, fetchMeeting])

  const initialData = useMemo(() => meetingData ?? undefined, [meetingData])

  const handleSubmit = async (data: MeetingFormData) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTypeId: data.meetingTypeId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location,
          agenda: data.agendaItems,
          content: '',
          actionItems: [],
          attendees: data.attendees,
          chefeAgrupamento: data.chefeAgrupamento,
          secretario: data.secretario,
        }),
      })

      if (response.ok) {
        showToast('Reunião atualizada com sucesso', 'success')
        router.push(`/meetings/${meetingId}`)
      } else {
        showToast('Erro ao atualizar reunião', 'error')
      }
    } catch (error) {
      console.error('Error updating meeting:', error)
      showToast('Erro ao atualizar reunião', 'error')
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center" aria-busy="true" role="status">
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Precisa fazer login para editar reuniões.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!meetingFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Reunião não encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={[
          { label: 'Reuniões', href: '/meetings' },
          { label: meetingId, href: `/meetings/${meetingId}` },
          { label: 'Editar' },
        ]} />
        <MeetingForm
          title="Editar Reunião"
          submitLabel="Atualizar Reunião"
          submittingLabel="Atualizando..."
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/meetings/${meetingId}`)}
        />
      </main>
    </div>
  )
}
