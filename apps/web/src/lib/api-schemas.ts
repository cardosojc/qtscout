// Convenient aliases for the generated OpenAPI types (api-types.ts).
// Regenerate types with `npm run gen:api-types` after the API contract changes.
// These describe the FastAPI wire shapes; runtime helpers/labels still come
// from @qtscout/types (see the migration plan).
import type { components } from './api-types'

type Schemas = components['schemas']

export type MeetingOut = Schemas['MeetingOut']
export type MeetingListResponse = Schemas['MeetingListResponse']
export type MeetingTypeOut = Schemas['MeetingTypeOut']
export type MeetingAttendeeOut = Schemas['MeetingAttendeeOut']
export type DocumentOut = Schemas['DocumentOut']
export type DocumentDetailOut = Schemas['DocumentDetailOut']
export type DocumentListResponse = Schemas['DocumentListResponse']
export type ScoutOut = Schemas['ScoutOut']
export type NightsBadgeOut = Schemas['NightsBadgeOut']
export type OrdemItemOut = Schemas['OrdemItemOut']
export type UserOut = Schemas['UserOut']
export type LeaderProfileOut = Schemas['LeaderProfileOut']
export type SessionUser = Schemas['SessionUser']
export type DocumentType = Schemas['DocumentType']
export type OrdemSection = Schemas['OrdemSection']
export type UserRole = Schemas['UserRole']
