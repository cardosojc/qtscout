'use client'
import { apiFetch } from '@/lib/api-client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useRouter, useParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { MeetingForm, type MeetingFormData } from '@/components/meetings/meeting-form'
import type { AgendaItem } from '@qtscout/types/meeting'
import { meetingKey, refreshCached, useMeeting } from '@/lib/api-hooks'
import type { MeetingOut } from '@/lib/api-schemas'

// API meeting -> form fields. The agenda is either a bare item list (older
// meetings) or an object that also carries attendees, chefe and secretário.
function toFormData(data: MeetingOut): MeetingFormData {
  const agendaObj = data.agenda as
    | { items?: AgendaItem[]; attendeeNames?: string[]; chefeAgrupamento?: string; secretario?: string }
    | AgendaItem[]
  const isList = Array.isArray(agendaObj)
  return {
    meetingTypeId: data.meetingTypeId,
    date: new Date(data.date).toISOString().split('T')[0],
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    location: data.location || '',
    agendaItems: isList ? agendaObj : agendaObj?.items || [],
    attendees: isList ? [] : agendaObj?.attendeeNames || [],
    chefeAgrupamento: isList ? '' : agendaObj?.chefeAgrupamento || '',
    secretario: isList ? '' : agendaObj?.secretario || '',
  }
}

export default function EditMeetingPage() {
  const { user: session } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const params = useParams()
  const meetingId = params.id as string

  const { data: meeting, error, isLoading: initialLoading } = useMeeting(meetingId)
  const meetingFound = !error

  // The form reads this once, when it mounts (it is keyed by meeting id), so a
  // background refresh of the meeting never overwrites edits in progress.
  const initialData = useMemo(() => (meeting ? toFormData(meeting) : undefined), [meeting])

  const handleAutoSave = useCallback(async (data: MeetingFormData) => {
    const response = await apiFetch(`/api/meetings/${meetingId}`, {
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
    if (!response.ok) throw new Error('Failed to save')
    void refreshCached(meetingKey(meetingId))
  }, [meetingId])

  const handleSubmit = async (data: MeetingFormData) => {
    try {
      const response = await apiFetch(`/api/meetings/${meetingId}`, {
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
        await refreshCached(meetingKey(meetingId))
        router.push(`/meetings/${meetingId}`)
      } else {
        showToast('Erro ao atualizar reunião', 'error')
      }
    } catch (error) {
      console.error('Error updating meeting:', error)
      showToast('Erro ao atualizar reunião', 'error')
    }
  }

  if (initialLoading || (!initialData && meetingFound)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center" aria-busy="true" role="status">
          <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p>Precisa fazer login para editar reuniões.</p>
        </div>
      </div>
    )
  }

  if (!meetingFound) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p>Reunião não encontrada.</p>
        </div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Reuniões', href: '/meetings' },
        { label: meetingId, href: `/meetings/${meetingId}` },
        { label: 'Editar' },
      ]} />
      <MeetingForm
        key={meetingId}
        title="Editar Reunião"
        submitLabel="Atualizar Reunião"
        submittingLabel="Atualizando..."
        initialData={initialData}
        onSubmit={handleSubmit}
        onAutoSave={handleAutoSave}
        onCancel={() => router.push(`/meetings/${meetingId}`)}
      />
    </main>
  )
}
