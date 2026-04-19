import type { DatePreset } from '@/lib/utils/datePresets'

export interface CompanyOption {
 id: string
 name: string
}

export interface LocationOption {
 id: string
 name: string
 location_number: number
}

export interface DashboardFilters {
 companyId: string | null
 locationId: string | null
 dateFrom: string | null
 dateTo: string | null
 datePreset: DatePreset
}

export interface DashboardKpis {
 ordersCount: number
 spendTotal: number
 avgOrderValue: number
 savedTotal: number
 overspendTotal: number
 savingsRate: number
}

export interface TopProductRow {
 master_product_id: string
 description: string
 article_code: string
 unit_size: string | null
 quantity: number
 spend: number
 lastOrderDate: string | null
}

export type CredentialLoginStatus =
 | 'success'
 | 'failed'
 | 'expired'
 | 'pending'
 | 'unknown'

export interface CredentialIssueRow {
 id: string
 supplierName: string
 companyName: string
 locationName: string
 locationNumber: number | null
 status: CredentialLoginStatus
 lastLoginAt: string | null
 lastErrorMessage: string | null
}

export interface SupplierSummaryRow {
 supplierId: string
 supplierName: string
 ordersCount: number
 spendTotal: number
 savedTotal: number
}

export interface DashboardAlerts {
 credentialIssues: CredentialIssueRow[]
}
