export interface ActionItem {
  id: string
  description: string
  responsible: string
  dueDate: string
}

export interface AgendaItem {
  id: string
  title: string
  description: string
  content?: string
  actionItems?: ActionItem[]
  fixed?: boolean
}

export interface MeetingType {
  id: string
  code: string
  name: string
}

export interface User {
  name?: string | null
  email: string
}

export interface Meeting {
  id: string
  identifier: string
  date: string
  startTime?: string | null
  endTime?: string | null
  location?: string | null
  agenda: Record<string, unknown>
  content: string
  actionItems?: Record<string, unknown>[] | null
  createdAt: string
  updatedAt?: string
  meetingType: MeetingType
  createdBy: User
}

export interface MeetingResponse {
  meetings: Meeting[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}