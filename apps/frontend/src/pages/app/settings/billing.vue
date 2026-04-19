<script setup lang="ts">
import { ref, computed } from 'vue'
import {
 Card,
 CardContent,
 CardDescription,
 CardFooter,
 CardHeader,
 CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Button from '@/components/ui/button/Button.vue'
import {
 Check,
 Sparkles,
 Building2,
 ScanLine,
 Package,
 Truck,
 CreditCard,
 Calendar,
 AlertCircle,
 ExternalLink,
} from 'lucide-vue-next'

definePage({
 meta: {
  title: 'Billing',
 },
})

// Mock subscription data - will be replaced with real data from Supabase
const subscription = ref({
 status: 'trialing' as 'trialing' | 'active' | 'past_due' | 'canceled' | 'none',
 plan: 'starter',
 trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
 currentPeriodEnd: null as Date | null,
 cancelAtPeriodEnd: false,
})

// Pricing plans configuration
const plans = [
 {
  id: 'starter',
  name: 'Starter',
  description: 'Perfect for small shops getting started',
  price: 9.99,
  interval: 'week',
  popular: false,
  features: [
   { icon: Building2, text: 'Up to 3 locations' },
   { icon: ScanLine, text: '50 OCR scans per week' },
   { icon: Truck, text: '10 suppliers' },
   { icon: Package, text: '500 products' },
  ],
  limits: {
   locations: 3,
   ocrScans: 50,
   suppliers: 10,
   products: 500,
  },
 },
 {
  id: 'pro',
  name: 'Pro',
  description: 'For growing businesses with multiple stores',
  price: 24.99,
  interval: 'week',
  popular: true,
  features: [
   { icon: Building2, text: 'Up to 10 locations' },
   { icon: ScanLine, text: '200 OCR scans per week' },
   { icon: Truck, text: '50 suppliers' },
   { icon: Package, text: '2,000 products' },
  ],
  limits: {
   locations: 10,
   ocrScans: 200,
   suppliers: 50,
   products: 2000,
  },
 },
 {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Unlimited access for large operations',
  price: 49.99,
  interval: 'week',
  popular: false,
  features: [
   { icon: Building2, text: 'Unlimited locations' },
   { icon: ScanLine, text: 'Unlimited OCR scans' },
   { icon: Truck, text: 'Unlimited suppliers' },
   { icon: Package, text: 'Unlimited products' },
  ],
  limits: {
   locations: -1,
   ocrScans: -1,
   suppliers: -1,
   products: -1,
  },
 },
]

// Mock usage data - will be replaced with real data
const usage = ref({
 locations: { used: 2, limit: 3 },
 ocrScans: { used: 23, limit: 50 },
 suppliers: { used: 5, limit: 10 },
 products: { used: 127, limit: 500 },
})

// Plan type for type safety
type Plan = (typeof plans)[number]

// Computed properties
const currentPlan = computed((): Plan => {
 const found = plans.find((p) => p.id === subscription.value.plan)
 // plans[0] is always defined as we have a static array with 3 elements
 return found ?? plans[0]!
})

const daysLeftInTrial = computed(() => {
 if (subscription.value.status !== 'trialing') return 0
 const now = new Date()
 const diff = subscription.value.trialEndsAt.getTime() - now.getTime()
 return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const statusBadge = computed(() => {
 switch (subscription.value.status) {
  case 'trialing':
   return {
    text: 'Trial',
    class: 'bg-primary/10 text-primary border-primary/20',
   }
  case 'active':
   return {
    text: 'Active',
    class: 'bg-success/10 text-success border-success/20',
   }
  case 'past_due':
   return {
    text: 'Past Due',
    class: 'bg-destructive/10 text-destructive border-destructive/20',
   }
  case 'canceled':
   return {
    text: 'Canceled',
    class: 'bg-muted text-muted-foreground border-border',
   }
  default:
   return {
    text: 'No Plan',
    class: 'bg-muted text-muted-foreground border-border',
   }
 }
})

// Helper function for usage percentage
const getUsagePercentage = (used: number, limit: number) => {
 if (limit === -1) return 0 // Unlimited
 return Math.min(100, Math.round((used / limit) * 100))
}

const getUsageColor = (percentage: number) => {
 if (percentage >= 90) return 'bg-destructive'
 if (percentage >= 70) return 'bg-warning'
 return 'bg-success'
}

// Actions - these will call Supabase Edge Functions later
const handleSubscribe = async (planId: string) => {
 console.log('Subscribe to plan:', planId)
 // TODO: Call create-checkout-session Edge Function
 // For now, just show a placeholder message
 alert(
  `Stripe integration coming soon!\n\nYou selected the ${planId} plan.\nThis will redirect to Stripe Checkout.`,
 )
}

const handleManageBilling = async () => {
 console.log('Open billing portal')
 // TODO: Call create-portal-session Edge Function
 alert(
  'Stripe Customer Portal coming soon!\n\nThis will redirect to Stripe to manage your subscription.',
 )
}
</script>

<template>
 <div class="space-y-8">
  <!-- Page Header -->
  <div>
   <h1 class="text-2xl font-bold tracking-tight">Billing</h1>
   <p class="text-muted-foreground">
    Manage your subscription and billing details
   </p>
  </div>

  <!-- Trial Banner (shown only during trial) -->
  <Card
   v-if="subscription.status === 'trialing'"
   class="border-primary/20 bg-primary/5"
  >
   <CardContent class="flex items-center gap-4 py-4">
    <div
     class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"
    >
     <Sparkles class="h-5 w-5 text-primary" />
    </div>
    <div class="flex-1">
     <p class="font-medium">
      You have {{ daysLeftInTrial }} days left in your free trial
     </p>
     <p class="text-sm text-muted-foreground">
      Subscribe now to continue using Price Ctrl after your trial ends. First
      charge will be 7 days after subscribing.
     </p>
    </div>
    <Button @click="handleSubscribe('pro')">
     <Sparkles class="mr-2 h-4 w-4" />
     Upgrade Now
    </Button>
   </CardContent>
  </Card>

  <!-- Past Due Warning -->
  <Card
   v-if="subscription.status === 'past_due'"
   class="border-destructive/20 bg-destructive/5"
  >
   <CardContent class="flex items-center gap-4 py-4">
    <div
     class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10"
    >
     <AlertCircle class="h-5 w-5 text-destructive" />
    </div>
    <div class="flex-1">
     <p class="font-medium text-destructive">Payment Failed</p>
     <p class="text-sm text-muted-foreground">
      Your last payment failed. Please update your payment method to avoid
      service interruption.
     </p>
    </div>
    <Button variant="destructive" @click="handleManageBilling">
     <CreditCard class="mr-2 h-4 w-4" />
     Update Payment
    </Button>
   </CardContent>
  </Card>

  <!-- Current Plan & Usage -->
  <div class="grid gap-6 md:grid-cols-2">
   <!-- Current Plan Card -->
   <Card>
    <CardHeader>
     <div class="flex items-center justify-between">
      <CardTitle>Current Plan</CardTitle>
      <Badge variant="outline" :class="statusBadge.class">
       {{ statusBadge.text }}
      </Badge>
     </div>
     <CardDescription>
      Your subscription details and billing information
     </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
     <div class="flex items-center justify-between">
      <div>
       <p class="text-2xl font-bold">{{ currentPlan.name }}</p>
       <p class="text-sm text-muted-foreground">
        {{ currentPlan.description }}
       </p>
      </div>
      <div class="text-right">
       <p class="text-2xl font-bold">
        {{ currentPlan.price.toFixed(2) }}
       </p>
       <p class="text-sm text-muted-foreground">
        per {{ currentPlan.interval }}
       </p>
      </div>
     </div>

     <div
      v-if="subscription.currentPeriodEnd"
      class="flex items-center gap-2 text-sm text-muted-foreground"
     >
      <Calendar class="h-4 w-4" />
      <span>
       Next billing date:
       {{ subscription.currentPeriodEnd.toLocaleDateString() }}
      </span>
     </div>
    </CardContent>
    <CardFooter>
     <Button variant="outline" class="w-full" @click="handleManageBilling">
      <ExternalLink class="mr-2 h-4 w-4" />
      Manage Billing
     </Button>
    </CardFooter>
   </Card>

   <!-- Usage Card -->
   <Card>
    <CardHeader>
     <CardTitle>Usage This Week</CardTitle>
     <CardDescription>
      Track your usage against your plan limits
     </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
     <!-- Locations -->
     <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
       <div class="flex items-center gap-2">
        <Building2 class="h-4 w-4 text-muted-foreground" />
        <span>Locations</span>
       </div>
       <span class="text-muted-foreground">
        {{ usage.locations.used }} / {{ usage.locations.limit }}
       </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
       <div
        class="h-full transition-all"
        :class="
         getUsageColor(
          getUsagePercentage(usage.locations.used, usage.locations.limit),
         )
        "
        :style="{
         width: `${getUsagePercentage(usage.locations.used, usage.locations.limit)}%`,
        }"
       />
      </div>
     </div>

     <!-- OCR Scans -->
     <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
       <div class="flex items-center gap-2">
        <ScanLine class="h-4 w-4 text-muted-foreground" />
        <span>OCR Scans</span>
       </div>
       <span class="text-muted-foreground">
        {{ usage.ocrScans.used }} / {{ usage.ocrScans.limit }}
       </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
       <div
        class="h-full transition-all"
        :class="
         getUsageColor(
          getUsagePercentage(usage.ocrScans.used, usage.ocrScans.limit),
         )
        "
        :style="{
         width: `${getUsagePercentage(usage.ocrScans.used, usage.ocrScans.limit)}%`,
        }"
       />
      </div>
     </div>

     <!-- Suppliers -->
     <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
       <div class="flex items-center gap-2">
        <Truck class="h-4 w-4 text-muted-foreground" />
        <span>Suppliers</span>
       </div>
       <span class="text-muted-foreground">
        {{ usage.suppliers.used }} / {{ usage.suppliers.limit }}
       </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
       <div
        class="h-full transition-all"
        :class="
         getUsageColor(
          getUsagePercentage(usage.suppliers.used, usage.suppliers.limit),
         )
        "
        :style="{
         width: `${getUsagePercentage(usage.suppliers.used, usage.suppliers.limit)}%`,
        }"
       />
      </div>
     </div>

     <!-- Products -->
     <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
       <div class="flex items-center gap-2">
        <Package class="h-4 w-4 text-muted-foreground" />
        <span>Products</span>
       </div>
       <span class="text-muted-foreground">
        {{ usage.products.used }} / {{ usage.products.limit }}
       </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
       <div
        class="h-full transition-all"
        :class="
         getUsageColor(
          getUsagePercentage(usage.products.used, usage.products.limit),
         )
        "
        :style="{
         width: `${getUsagePercentage(usage.products.used, usage.products.limit)}%`,
        }"
       />
      </div>
     </div>
    </CardContent>
   </Card>
  </div>

  <!-- Pricing Plans -->
  <div>
   <h2 class="mb-4 text-xl font-semibold">Available Plans</h2>
   <div class="grid gap-6 md:grid-cols-3">
    <Card
     v-for="plan in plans"
     :key="plan.id"
     :class="[
      'relative transition-all hover:shadow-lg',
      plan.popular && 'border-primary shadow-md',
      subscription.plan === plan.id && 'ring-2 ring-primary',
     ]"
    >
     <!-- Popular Badge -->
     <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2">
      <Badge class="bg-primary text-primary-foreground"> Most Popular </Badge>
     </div>

     <CardHeader class="text-center">
      <CardTitle>{{ plan.name }}</CardTitle>
      <CardDescription>{{ plan.description }}</CardDescription>
      <div class="mt-4">
       <span class="text-4xl font-bold">
        {{ plan.price.toFixed(2) }}
       </span>
       <span class="text-muted-foreground">/{{ plan.interval }}</span>
      </div>
     </CardHeader>

     <CardContent>
      <ul class="space-y-3">
       <li
        v-for="feature in plan.features"
        :key="feature.text"
        class="flex items-center gap-2"
       >
        <div
         class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10"
        >
         <Check class="h-3 w-3 text-primary" />
        </div>
        <span class="text-sm">{{ feature.text }}</span>
       </li>
      </ul>
     </CardContent>

     <CardFooter>
      <Button
       :variant="
        subscription.plan === plan.id
         ? 'outline'
         : plan.popular
           ? 'default'
           : 'secondary'
       "
       class="w-full"
       :disabled="subscription.plan === plan.id"
       @click="handleSubscribe(plan.id)"
      >
       <template v-if="subscription.plan === plan.id"> Current Plan </template>
       <template v-else>
        <Sparkles class="mr-2 h-4 w-4" />
        {{ subscription.status === 'none' ? 'Start Trial' : 'Upgrade' }}
       </template>
      </Button>
     </CardFooter>
    </Card>
   </div>
  </div>

  <!-- FAQ / Info Section -->
  <Card>
   <CardHeader>
    <CardTitle>Billing Information</CardTitle>
   </CardHeader>
   <CardContent class="space-y-4 text-sm text-muted-foreground">
    <div class="flex items-start gap-3">
     <div
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted"
     >
      1
     </div>
     <div>
      <p class="font-medium text-foreground">10-Day Free Trial</p>
      <p>
       Try Price Ctrl free for 10 days with full Pro features. No credit card
       required to start.
      </p>
     </div>
    </div>
    <div class="flex items-start gap-3">
     <div
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted"
     >
      2
     </div>
     <div>
      <p class="font-medium text-foreground">7-Day Grace Period</p>
      <p>
       When you subscribe, your first payment will be charged 7 days later,
       giving you time to fully integrate.
      </p>
     </div>
    </div>
    <div class="flex items-start gap-3">
     <div
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted"
     >
      3
     </div>
     <div>
      <p class="font-medium text-foreground">Weekly Billing</p>
      <p>
       Pay weekly to keep cash flow flexible. Cancel anytime, no long-term
       commitment.
      </p>
     </div>
    </div>
   </CardContent>
  </Card>
 </div>
</template>
