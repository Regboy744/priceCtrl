<script setup lang="ts">
import { TriangleAlertIcon } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { ref } from 'vue'

const props = defineProps<{
 message: string
 customCode: number
 details: string
 code: string
 hint: string | null
 statusCode: number
 isCustomError: boolean
}>()

// Default error with no custom error was setted up

const error = ref({
 code: 500,
 msg: 'Ops, somenting went wrong!',
})

// If isCustomError is true, then gets the custom
if (props.isCustomError) {
 error.value.code = props.customCode
 error.value.msg = props.message
}

if (props.statusCode === 406) {
 error.value.code = 404
 error.value.msg = 'Sorry, we could not find this page!'
}
</script>

<template>
 <div>
  <TriangleAlertIcon
   icon="lucide:triangle-alert"
   class="mx-auto text-destructive size-16"
  />
  <h1 class="my-2 text-7xl font-extrabold text-secondary">
   {{ error.code }}
  </h1>
  <p class="my-2 text-3xl font-extrabold text-primary">{{ error.msg }}</p>

  <div class="mt-6 flex flex-col items-center justify-center gap-5 font-light">
   <p class="text-lg text-muted-foreground">
    You'll find lots to explore on the home page.
   </p>
   <RouterLink to="/">
    <Button class="max-w-36"> Back to homepage </Button>
   </RouterLink>
  </div>
 </div>
</template>
