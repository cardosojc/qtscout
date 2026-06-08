export type SessionUser = {
  id: string
  email: string
  name: string
  username: string
  role: 'ADMIN' | 'LEADER' | 'MEMBER'
}

export type Session = {
  user: SessionUser
} | null
