<script setup lang="ts">
import { onMounted } from 'vue'
import {
 Card,
 CardContent,
 CardHeader,
 CardTitle,
 CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
 Thermometer,
 CloudRain,
 Wind,
 TrendingUp,
 Lightbulb,
 RefreshCw,
 MapPin,
 AlertCircle,
 AlertTriangle,
} from 'lucide-vue-next'
import { useWeatherForecast } from '../composables/useWeatherForecast'

const {
 isLoading,
 error,
 geolocation,
 signals,
 location,
 usingFallback,
 loadWeatherForecast,
 refreshForecast,
 dailySummary,
} = useWeatherForecast()

onMounted(() => {
 loadWeatherForecast()
})

// Format temperature
const formatTemp = (temp: number): string => {
 if (typeof temp !== 'number') return ''
 return `${Math.round(temp)}°C`
}

// --- Weather symbol, icon, and description map ---
import {
 Sun,
 Cloud,
 CloudSun,
 Snowflake,
 CloudDrizzle,
 CloudFog,
 Zap,
} from 'lucide-vue-next'

function pickIconAndDesc(symbols: string | string[]) {
 // Choose most severe or dominant
 const all = Array.isArray(symbols) ? symbols : [symbols]
 if (
  all.includes('Rain') ||
  all.includes('LightRain') ||
  all.includes('RainThunder')
 ) {
  return { icon: CloudRain, desc: 'Rain', severity: 'warn' }
 }
 if (
  all.includes('LightRainSun') ||
  all.includes('DrizzleSun') ||
  all.includes('Drizzle')
 ) {
  return { icon: CloudDrizzle, desc: 'Light Rain', severity: undefined }
 }
 if (all.includes('Snow') || all.includes('SnowSun')) {
  return { icon: Snowflake, desc: 'Snow', severity: 'info' }
 }
 if (all.includes('Fog')) {
  return { icon: CloudFog, desc: 'Foggy', severity: undefined }
 }
 if (all.includes('Sleet')) {
  return { icon: CloudRain, desc: 'Sleet', severity: 'warn' }
 }
 if (all.includes('Sun')) {
  return { icon: Sun, desc: 'Sunny', severity: undefined }
 }
 if (all.includes('PartlyCloud') || all.includes('LightCloud')) {
  return { icon: CloudSun, desc: 'Partly Cloudy', severity: undefined }
 }
 if (all.includes('Cloud')) {
  return { icon: Cloud, desc: 'Cloudy', severity: undefined }
 }
 if (all.some((s) => typeof s === 'string' && s.includes('Thunder'))) {
  return { icon: Zap, desc: 'Thunder', severity: 'warn' }
 }
 return { icon: Cloud, desc: 'Cloudy', severity: undefined }
}

// Day label formatter
// (removed Dayjs/any, not needed)
function getDayLabel(idx: number, date: string) {
 if (idx === 0) return 'Tonight'
 if (idx === 1) return 'Tomorrow'
 const dt = new Date(date)
 return dt.toLocaleDateString('en-GB', { weekday: 'long' })
}
</script>

/* --- Visual update summary --- - Added pickIconAndDesc for symbol/icons/desc
per day - Added getDayLabel helper for "Tonight", "Tomorrow", Weekday name -
Added a scrollable row of daily forecast cards after overview - Each card shows
day, icon, max/min, desc, and warning for rain/wind */

<template>
 <div class="grid gap-4 md:grid-cols-3">
  <!-- Error State -->
  <template v-if="geolocation.status === 'error'">
   <Card class="md:col-span-3">
    <CardHeader>
     <CardTitle class="flex items-center gap-2 text-destructive">
      <AlertCircle class="h-5 w-5" />
      Location Required
     </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
     <p class="text-sm text-muted-foreground">
      {{ geolocation.error }}
     </p>
     <Button variant="outline" size="sm" @click="loadWeatherForecast">
      <RefreshCw class="mr-2 h-4 w-4" />
      Try Again
     </Button>
    </CardContent>
   </Card>
  </template>

  <!-- Loading State -->
  <template v-else-if="isLoading || geolocation.status === 'loading'">
   <Card>
    <CardHeader>
     <Skeleton class="h-5 w-40" />
    </CardHeader>
    <CardContent class="space-y-3">
     <Skeleton class="h-8 w-20" />
     <Skeleton class="h-4 w-32" />
     <Skeleton class="h-4 w-28" />
    </CardContent>
   </Card>
   <Card>
    <CardHeader>
     <Skeleton class="h-5 w-36" />
    </CardHeader>
    <CardContent class="space-y-2">
     <Skeleton class="h-6 w-full" />
     <Skeleton class="h-6 w-3/4" />
     <Skeleton class="h-6 w-5/6" />
    </CardContent>
   </Card>
   <Card>
    <CardHeader>
     <Skeleton class="h-5 w-32" />
    </CardHeader>
    <CardContent class="space-y-2">
     <Skeleton class="h-4 w-full" />
     <Skeleton class="h-4 w-5/6" />
     <Skeleton class="h-4 w-4/5" />
    </CardContent>
   </Card>
  </template>

  <!-- Error State (API error) -->
  <template v-else-if="error">
   <Card class="md:col-span-3">
    <CardHeader>
     <CardTitle class="flex items-center gap-2 text-destructive">
      <AlertCircle class="h-5 w-5" />
      Weather Data Unavailable
     </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
     <p class="text-sm text-muted-foreground">{{ error }}</p>
     <Button variant="outline" size="sm" @click="refreshForecast">
      <RefreshCw class="mr-2 h-4 w-4" />
      Retry
     </Button>
    </CardContent>
   </Card>
  </template>

  <!-- Data Loaded -->
  <template v-else-if="signals">
   <!-- Card 1: Forecast Overview -->
   <Card>
    <CardHeader
     class="flex flex-row items-center justify-between space-y-0 pb-2"
    >
     <div>
      <CardTitle class="text-sm font-medium">
       Next 7-10 Days Overview
      </CardTitle>
      <CardDescription
       v-if="location"
       class="mt-1 flex items-center gap-1 text-xs"
      >
       <MapPin class="h-3 w-3" />
       <span v-if="usingFallback">Dublin (default)</span>
       <span v-else>
        {{ location.lat.toFixed(2) }}, {{ location.lon.toFixed(2) }}
       </span>
      </CardDescription>
     </div>
     <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      @click="refreshForecast"
      :disabled="isLoading"
     >
      <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
     </Button>
    </CardHeader>
    <CardContent class="space-y-2">
     <!-- Summary stats as three horizontally-aligned blocks -->
     <div class="flex flex-row gap-3 justify-between mb-1 flex-wrap">
      <div
       class="flex flex-col items-center min-w-[85px] p-2 rounded bg-warning/10"
      >
       <Thermometer class="h-4 w-4 text-warning mb-1" />
       <span class="font-bold text-lg">{{ formatTemp(signals.avgTemp) }}</span>
       <span class="text-[11px] text-muted-foreground">Avg Temp</span>
      </div>
      <div
       class="flex flex-col items-center min-w-[85px] p-2 rounded bg-primary/10"
      >
       <CloudRain class="h-4 w-4 text-primary mb-1" />
       <span class="font-bold text-base">{{ signals.heavyRainPeriods }}</span>
       <span class="text-[11px] text-muted-foreground">Rainy Periods</span>
      </div>
      <div
       class="flex flex-col items-center min-w-[85px] p-2 rounded bg-secondary"
      >
       <Wind class="h-4 w-4 text-muted-foreground mb-1" />
       <span class="font-bold text-base">{{ signals.windyPeriods }}</span>
       <span class="text-[11px] text-muted-foreground">Windy Periods</span>
      </div>
     </div>

     <!-- 7-day forecast compact row -->
     <div class="pt-0 pb-1">
      <div class="flex flex-row gap-1 overflow-x-auto min-w-0 scrollbar-thin">
       <template v-for="(day, idx) in dailySummary.slice(0, 7)" :key="day.date">
        <div
         class="w-20 sm:w-24 flex-shrink-0 flex flex-col items-center bg-card border border-border rounded-md px-0.5 py-1 mx-0.5"
        >
         <span
          class="font-semibold text-[0.80rem] text-foreground text-center mb-0.5"
         >
          {{ getDayLabel(idx, day.date) }}
         </span>
         <component
          :is="pickIconAndDesc(day.symbols).icon"
          class="h-6 w-6 mt-1 mb-1"
          :class="{
           'text-primary': pickIconAndDesc(day.symbols).desc.includes('Rain'),
           'text-warning': pickIconAndDesc(day.symbols).desc.includes('Sunny'),
           'text-info': pickIconAndDesc(day.symbols).desc.includes('Snow'),
           'text-muted-foreground': pickIconAndDesc(day.symbols).desc.includes(
            'Cloud',
           ),
           'text-muted-foreground/70': pickIconAndDesc(
            day.symbols,
           ).desc.includes('Fog'),
          }"
          :title="pickIconAndDesc(day.symbols).desc"
         />
         <div
          class="flex justify-center items-center gap-0.5 text-xs mt-0 mb-0.5"
         >
          <span>{{ formatTemp(day.maxTemp) }}</span>
          <span class="opacity-60">/</span>
          <span class="opacity-60">{{ formatTemp(day.minTemp) }}</span>
         </div>
         <component
          v-if="day.totalRain > 8 || day.avgWind > 13"
          :is="AlertTriangle"
          class="w-4 h-4 text-warning mb-0.5"
          title="Severe day: rain or wind"
         />
        </div>
       </template>
      </div>
     </div>
     <div class="text-[11px] text-muted-foreground text-right pr-2 pt-0 mb-0">
      <span>Forecast for days 8+ indicates trend, not precise timing 🌦️</span>
     </div>
    </CardContent>
   </Card>

   <!-- Card 2: Retail Demand Signals -->
   <Card>
    <CardHeader
     class="flex flex-row items-center justify-between space-y-0 pb-2"
    >
     <CardTitle class="text-sm font-medium"> Retail Demand Signals </CardTitle>
     <TrendingUp class="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
     <div v-if="signals.demandSignals.length > 0" class="flex flex-wrap gap-2">
      <Badge
       v-for="signal in signals.demandSignals"
       :key="signal"
       variant="secondary"
       class="text-xs"
      >
       {{ signal }}
      </Badge>
     </div>
     <p v-else class="text-sm text-muted-foreground">
      No significant weather signals for this period.
     </p>
    </CardContent>
   </Card>

   <!-- Card 3: Planning Guidance -->
   <Card>
    <CardHeader
     class="flex flex-row items-center justify-between space-y-0 pb-2"
    >
     <CardTitle class="text-sm font-medium">Planning Guidance</CardTitle>
     <Lightbulb class="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent class="space-y-2 text-sm text-muted-foreground">
     <p class="flex items-start gap-2">
      <span class="text-foreground">1.</span>
      Use rain & wind to plan staffing and deliveries
     </p>
     <p class="flex items-start gap-2">
      <span class="text-foreground">2.</span>
      Temperature trends drive category demand
     </p>
     <p class="flex items-start gap-2">
      <span class="text-foreground">3.</span>
      Forecast beyond day 7 = trend, not exact timing
     </p>
    </CardContent>
   </Card>
  </template>
 </div>
</template>
