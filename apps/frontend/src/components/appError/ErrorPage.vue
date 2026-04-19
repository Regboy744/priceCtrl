<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useErrorStore } from '@/stores/error'
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
const router = useRouter()

const errorStore = useErrorStore()

const error = ref(errorStore.activeError)

const message = ref('')
const customCode = ref(0)
const details = ref('')
const code = ref('')
const hint = ref('')
const statusCode = ref(0)

if (error.value && !('code' in error.value)) {
 message.value = error.value.message
 customCode.value = error.value.customCode ?? 0
}

if (error.value && 'code' in error.value) {
 message.value = error.value.message
 details.value = error.value.details
 hint.value = error.value.hint
 code.value = error.value.code
 statusCode.value = error.value.statusCode ?? 0
}

const ErrorTemplate = import.meta.env.DEV
 ? defineAsyncComponent(() => import('./AppErrorDevSection.vue'))
 : defineAsyncComponent(() => import('./AppErrorProdSection.vue'))

// When the user leave the page it sets the error to false otherwise the errorPage will
// always show up
const hook = router.afterEach(() => {
 errorStore.clearError()
})

onBeforeUnmount(() => {
 hook()
})
</script>
<template>
 <section
  class="mx-auto flex min-h-[90vh] flex-1 -mt-20 items-center justify-center p-10 text-center"
 >
  <ErrorTemplate
   :message
   :customCode
   :details
   :code
   :hint
   :statusCode
   :isCustomError="errorStore.isCustomError"
  />
 </section>
</template>
