export const DATE_PRESETS = [
 'today',
 'week',
 'month',
 'lastMonth',
 'custom',
] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export interface PresetDateRange {
 dateFrom: string | null
 dateTo: string | null
}

function toIsoDateLocal(date: Date): string {
 const year = date.getFullYear().toString().padStart(4, '0')
 const month = (date.getMonth() + 1).toString().padStart(2, '0')
 const day = date.getDate().toString().padStart(2, '0')
 return `${year}-${month}-${day}`
}

export function getPresetDateRange(preset: DatePreset): PresetDateRange {
 const today = new Date()
 today.setHours(0, 0, 0, 0)

 let dateFrom: Date | null = null
 let dateTo: Date | null = null

 switch (preset) {
  case 'today':
   dateFrom = new Date(today)
   dateTo = new Date(today)
   break
  case 'week': {
   dateFrom = new Date(today)
   dateFrom.setDate(today.getDate() - today.getDay())
   dateTo = new Date(dateFrom)
   dateTo.setDate(dateFrom.getDate() + 6)
   break
  }
  case 'month':
   dateFrom = new Date(today.getFullYear(), today.getMonth(), 1)
   dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
   break
  case 'lastMonth':
   dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
   dateTo = new Date(today.getFullYear(), today.getMonth(), 0)
   break
  case 'custom':
   dateFrom = null
   dateTo = null
   break
 }

 return {
  dateFrom: dateFrom ? toIsoDateLocal(dateFrom) : null,
  dateTo: dateTo ? toIsoDateLocal(dateTo) : null,
 }
}
