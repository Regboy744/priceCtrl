//This snippt is responsable for the Sorting on the data
//table  -  https://www.shadcn-vue.com/docs/components/data-table
//It is used in the DataTable.vue component

import type { Updater } from '@tanstack/vue-table'
import type { ClassValue } from 'clsx'

import type { Ref } from 'vue'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs))
}

export function valueUpdater<T extends Updater<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
 updaterOrValue: T,
 ref: Ref,
) {
 ref.value =
  typeof updaterOrValue === 'function'
   ? updaterOrValue(ref.value)
   : updaterOrValue
}
