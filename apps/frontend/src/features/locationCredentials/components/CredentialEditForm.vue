<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2, Eye, EyeOff } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import InputValidation from '@/components/appForm/InputValidation.vue'
import {
 credentialCreateSchema,
 credentialUpdateSchema,
} from '@/features/locationCredentials/schemas/credentialsSchemas'
import type {
 SupplierWithCredential,
 CredentialFormData,
} from '@/features/locationCredentials/types'

interface Props {
 supplier: SupplierWithCredential
}

const props = defineProps<Props>()

const emit = defineEmits<{
 save: [data: CredentialFormData]
 cancel: []
}>()

const isEditMode = computed(() => !!props.supplier.credential_id)
const showPassword = ref(false)

// Use different schema based on create vs edit
const validationSchema = computed(() =>
 isEditMode.value ? credentialUpdateSchema : credentialCreateSchema,
)

const { defineField, handleSubmit, isSubmitting, errors } = useForm({
 validationSchema: toTypedSchema(validationSchema.value),
 initialValues: {
  supplier_id: props.supplier.supplier_id,
  username: props.supplier.username ?? '',
  password: '',
  website_url: props.supplier.website_url ?? '',
  login_url: props.supplier.login_url ?? '',
  is_active: props.supplier.is_active ?? true,
 },
})

const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')
const [websiteUrl, websiteUrlAttrs] = defineField('website_url')
const [loginUrl, loginUrlAttrs] = defineField('login_url')
const [isActive, isActiveAttrs] = defineField('is_active')

const onSubmit = handleSubmit((validatedData) => {
 const credentialData: CredentialFormData = {
  supplier_id: props.supplier.supplier_id,
  username: validatedData.username,
  password: validatedData.password || undefined,
  website_url: validatedData.website_url || undefined,
  login_url: validatedData.login_url || undefined,
  is_active: validatedData.is_active,
 }

 emit('save', credentialData)
})

const submitButtonText = computed(() => {
 if (isSubmitting.value) {
  return isEditMode.value ? 'Saving...' : 'Creating...'
 }
 return isEditMode.value ? 'Save Changes' : 'Add Credentials'
})

const togglePasswordVisibility = () => {
 showPassword.value = !showPassword.value
}
</script>

<template>
 <form id="form-credential" @submit.prevent="onSubmit" class="space-y-6 px-1">
  <!-- Supplier Info (read-only) -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Supplier
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
    <p class="text-lg font-medium">{{ supplier.supplier_name }}</p>
   </div>
  </div>

  <!-- Login Credentials -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Login Credentials
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="username"
     v-bind="usernameAttrs"
     label="Username"
     placeholder="Enter username or email"
     :error="errors.username"
    />

    <div class="relative">
     <InputValidation
      v-model="password"
      v-bind="passwordAttrs"
      :label="isEditMode ? 'New Password (optional)' : 'Password'"
      :type="showPassword ? 'text' : 'password'"
      :placeholder="
       isEditMode ? 'Leave empty to keep current password' : 'Enter password'
      "
      :error="errors.password"
     />
     <Button
      type="button"
      variant="ghost"
      size="icon"
      class="absolute right-2 top-7 h-8 w-8"
      @click="togglePasswordVisibility"
     >
      <Eye v-if="!showPassword" class="h-4 w-4" />
      <EyeOff v-else class="h-4 w-4" />
     </Button>
    </div>
   </div>
  </div>

  <!-- URLs (optional) -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     URLs (Optional)
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div class="space-y-4 bg-muted/30 p-4 rounded-lg border border-border/50">
    <InputValidation
     v-model="websiteUrl"
     v-bind="websiteUrlAttrs"
     label="Website URL"
     placeholder="https://supplier.example.com"
     :error="errors.website_url"
    />

    <InputValidation
     v-model="loginUrl"
     v-bind="loginUrlAttrs"
     label="Login URL"
     placeholder="https://supplier.example.com/login"
     :error="errors.login_url"
    />
   </div>
  </div>

  <!-- Status -->
  <div class="space-y-3">
   <div class="flex items-center gap-2">
    <span
     class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
    >
     Status
    </span>
    <div class="flex-1 border-t border-border"></div>
   </div>
   <div
    class="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50"
   >
    <div class="space-y-0.5">
     <label class="text-sm font-medium leading-none">Credential Status</label>
     <p class="text-sm text-muted-foreground">
      {{
       isActive
        ? 'This credential is active and can be used'
        : 'This credential is disabled'
      }}
     </p>
    </div>
    <Switch
     v-model="isActive"
     v-bind="isActiveAttrs"
     :aria-label="`Set credential status to ${isActive ? 'inactive' : 'active'}`"
    />
   </div>
  </div>

  <!-- Submit Actions -->
  <div class="pt-4 border-t">
   <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
    <Button
     variant="outline"
     type="button"
     class="w-full sm:w-auto"
     @click="emit('cancel')"
    >
     Cancel
    </Button>
    <Button type="submit" class="w-full sm:w-auto" :disabled="isSubmitting">
     <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
     {{ submitButtonText }}
    </Button>
   </div>
  </div>
 </form>
</template>
