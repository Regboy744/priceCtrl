import type { PostgrestError } from '@supabase/supabase-js'

// Data table types for configurations/custom tables
export interface DataTableConfig {
 features?: {
  rowSelection?: boolean // Show checkboxes
  pagination?: boolean // Show prev/next buttons
  sorting?: boolean // Enable column sorting
  filtering?: boolean // Show search input
  columnVisibility?: boolean // Show columns dropdown
 }
 pageSize?: number // Rows per page
 searchColumn?: string // Which column to filter (e.g., 'name')
 searchPlaceholder?: string // Custom placeholder text
 additionalFilters?: {
  column: string // Column accessor key to filter
  placeholder: string // Input placeholder text
 }[]
}

export interface CustomError extends Error {
 customCode?: number
}

export interface ExtendedPostgrestError extends PostgrestError {
 statusCode?: number
}
