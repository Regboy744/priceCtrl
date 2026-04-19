import { parseDate } from '@internationalized/date'
import type { DateValue } from 'reka-ui'

/**
 * Convert ISO string (YYYY-MM-DD) to DD/MM/YYYY display format
 */
export function formatDateDisplay(isoDate: string | null): string {
 if (!isoDate) return ''

 try {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
 } catch {
  return ''
 }
}

/**
 * Convert ISO string (YYYY-MM-DD) to CalendarDate object
 */
export function isoToCalendarDate(isoDate: string | null): DateValue | null {
 if (!isoDate) return null

 try {
  return parseDate(isoDate)
 } catch {
  return null
 }
}

/**
 * Convert CalendarDate to ISO string (YYYY-MM-DD)
 */
export function calendarDateToISO(date: DateValue | null): string | null {
 if (!date) return null

 try {
  const year = date.year.toString().padStart(4, '0')
  const month = date.month.toString().padStart(2, '0')
  const day = date.day.toString().padStart(2, '0')
  return `${year}-${month}-${day}`
 } catch {
  return null
 }
}

/**
 * Format date range for button display
 * Example: "14/01/2026 - 20/01/2026"
 */
export function formatDateRange(
 from: string | null,
 to: string | null,
): string {
 const fromDisplay = formatDateDisplay(from)
 const toDisplay = formatDateDisplay(to)

 if (fromDisplay && toDisplay) {
  return `${fromDisplay} - ${toDisplay}`
 }

 if (fromDisplay) {
  return `From ${fromDisplay}`
 }

 if (toDisplay) {
  return `To ${toDisplay}`
 }

 return ''
}

// Re-export types for convenience
export type { DateValue }
