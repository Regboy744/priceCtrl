<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWeatherForecast } from '../composables/useWeatherForecast'

// Import Lucide icons for weather
import {
 Sun,
 Cloud,
 CloudSun,
 CloudRain,
 CloudLightning,
 CloudSnow,
 CloudFog,
 Snowflake,
 CloudHail,
 CloudDrizzle,
 HelpCircle,
 Wind,
 Thermometer,
 Droplets,
 MapPin,
 RefreshCw,
} from 'lucide-vue-next'

// Map weather API symbols to Lucide icon components
type IconComponent = typeof Sun
const symbolToIcon: Record<string, IconComponent> = {
 Sun,
 LightCloud: CloudSun,
 PartlyCloud: CloudSun,
 Cloud,
 LightRainSun: CloudRain,
 LightRainThunderSun: CloudLightning,
 SleetSun: CloudHail,
 SnowSun: CloudSnow,
 LightRain: CloudRain,
 Rain: CloudRain,
 RainThunder: CloudLightning,
 Sleet: CloudHail,
 Snow: CloudSnow,
 SnowThunder: CloudLightning,
 Fog: CloudFog,
 SleetSunThunder: CloudLightning,
 SnowSunThunder: CloudLightning,
 LightRainThunder: CloudLightning,
 SleetThunder: CloudLightning,
 DrizzleThunderSun: CloudLightning,
 RainThunderSun: CloudLightning,
 LightSleetThunderSun: CloudLightning,
 HeavySleetThunderSun: CloudLightning,
 LightSnowThunderSun: CloudLightning,
 HeavySnowThunderSun: CloudLightning,
 DrizzleThunder: CloudDrizzle,
 LightSleetThunder: CloudHail,
 HeavySleetThunder: CloudHail,
 LightSnowThunder: CloudSnow,
 HeavySnowThunder: CloudSnow,
 DrizzleSun: CloudDrizzle,
 RainSun: CloudRain,
 LightSleetSun: CloudHail,
 HeavySleetSun: CloudHail,
 LightSnowSun: CloudSnow,
 HeavySnowSun: Snowflake,
 Drizzle: CloudDrizzle,
 LightSleet: CloudHail,
 HeavySleet: CloudHail,
 LightSnow: CloudSnow,
 HeavySnow: Snowflake,
 Unknown: HelpCircle,
}

const {
 dailySummary,
 forecast,
 isLoading,
 error,
 loadWeatherForecast,
 refreshForecast,
 usingFallback,
} = useWeatherForecast()

const selectedDay = ref(0)
const isLoaded = ref(false)
const isRefreshing = ref(false)

// Handle refresh button click
const handleRefresh = async () => {
 if (isRefreshing.value) return
 isRefreshing.value = true
 try {
  await refreshForecast()
 } finally {
  // Keep spinning for at least 500ms for visual feedback
  setTimeout(() => {
   isRefreshing.value = false
  }, 500)
 }
}

// Location name (API doesn't provide name, so we use fallback name)
const locationName = computed(() => {
 if (usingFallback.value) {
  return 'Dublin, Ireland'
 }
 // If we had geolocation, show coordinates-based name or generic
 return 'Current Location'
})

// Get today's date string for comparison
const getTodayDateString = () => {
 const today = new Date()
 return today.toISOString().split('T')[0]
}

// Filter to include today and forward (up to 10 days)
const forecastDays = computed(() => {
 const today = getTodayDateString()
 // Filter days from today onwards, take up to 10
 return dailySummary.value.filter((day) => day.date >= today!).slice(0, 10)
})

const minTemp = computed(() => {
 if (!forecastDays.value.length) return 0
 return Math.min(...forecastDays.value.map((d) => d.minTemp))
})

const maxTemp = computed(() => {
 if (!forecastDays.value.length) return 0
 return Math.max(...forecastDays.value.map((d) => d.maxTemp))
})

const averageTemp = computed(() => {
 if (!forecastDays.value.length) return 0
 return Math.round(
  forecastDays.value.reduce((sum, day) => sum + day.maxTemp, 0) /
   forecastDays.value.length,
 )
})

const averageHumidity = computed(() => {
 if (!forecastDays.value.length) return 0
 return Math.round(
  forecastDays.value.reduce((sum, day) => sum + day.avgHumidity, 0) /
   forecastDays.value.length,
 )
})

// Current temp from the first forecast point (most recent/current)
const currentTemp = computed(() => {
 const firstPoint = forecast.value[0]
 if (firstPoint) {
  return Math.round(firstPoint.temperature)
 }
 return forecastDays.value[0] ? Math.round(forecastDays.value[0].maxTemp) : 0
})

// Current weather symbol from first forecast point
const currentSymbol = computed(() => {
 const firstPoint = forecast.value[0]
 if (firstPoint) {
  return firstPoint.symbol
 }
 return forecastDays.value[0]?.symbols?.[0] || 'Unknown'
})

const selectedDayData = computed(() => forecastDays.value[selectedDay.value])

const getBarHeight = (temp: number) => {
 const range = maxTemp.value - minTemp.value
 if (range === 0) return 50
 const percentage = ((temp - minTemp.value) / range) * 100
 return Math.max(20, Math.min(100, percentage))
}

const formatDay = (dateStr: string) => {
 const today = getTodayDateString()
 if (dateStr === today) return 'Today'
 return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short' })
}

const formatDate = (dateStr: string) => {
 return new Date(dateStr).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
 })
}

const formatFullDate = (dateStr: string) => {
 const today = getTodayDateString()
 if (dateStr === today) return 'Today'
 return new Date(dateStr).toLocaleDateString(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
 })
}

onMounted(() => {
 loadWeatherForecast()
 setTimeout(() => {
  isLoaded.value = true
 }, 100)
})
</script>

<template>
 <div
  class="w-full max-w-md transition-all duration-500"
  :class="isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
 >
  <!-- Widget Container -->
  <div class="bg-card rounded-2xl p-5 shadow-xl border border-border">
   <!-- Loading State -->
   <div
    v-if="isLoading"
    class="flex flex-col items-center justify-center min-h-[360px] gap-3"
   >
    <div
     class="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin"
    ></div>
    <span class="text-muted-foreground text-xs">Loading weather...</span>
   </div>

   <!-- Error State -->
   <div
    v-else-if="error"
    class="flex flex-col items-center justify-center min-h-[360px] gap-3"
   >
    <div
     class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center"
    >
     <HelpCircle class="w-6 h-6 text-destructive" />
    </div>
    <span class="text-destructive text-xs text-center px-4">{{ error }}</span>
   </div>

   <!-- Weather Content -->
   <div v-else>
    <!-- Header -->
    <div class="flex justify-between items-start mb-5">
     <div class="flex flex-col gap-0.5">
      <div class="flex items-center gap-1.5">
       <MapPin class="w-3.5 h-3.5 text-primary" />
       <h2 class="text-base font-semibold text-foreground">
        {{ locationName }}
       </h2>
       <!-- Refresh Button -->
       <button
        type="button"
        class="p-1 rounded-md hover:bg-secondary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50"
        :class="{ 'opacity-50 cursor-not-allowed': isRefreshing }"
        :disabled="isRefreshing"
        title="Refresh weather data"
        @click="handleRefresh"
       >
        <RefreshCw
         class="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors"
         :class="{ 'animate-spin': isRefreshing }"
        />
       </button>
      </div>
      <span class="text-[10px] text-muted-foreground">
       <template v-if="usingFallback">Using default location</template>
       <template v-else>Updated just now</template>
      </span>
     </div>
     <div class="flex items-center gap-2">
      <div class="flex flex-col items-end">
       <span class="text-4xl font-bold text-foreground"
        >{{ currentTemp }}°</span
       >
       <span class="text-[10px] text-muted-foreground">Today</span>
      </div>
      <component
       :is="symbolToIcon[currentSymbol] || Sun"
       class="w-8 h-8 text-primary"
      />
     </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-3 gap-2 mb-5">
     <div
      class="bg-secondary rounded-xl p-3 text-center border border-transparent hover:border-primary/50 transition-all duration-200 cursor-default"
     >
      <div
       class="text-[9px] text-muted-foreground uppercase tracking-wider mb-1"
      >
       Week Avg
      </div>
      <div class="text-lg font-bold text-primary">{{ averageTemp }}°C</div>
      <div class="text-[9px] text-muted-foreground/70">Temperature</div>
     </div>
     <div
      class="bg-secondary rounded-xl p-3 text-center border border-transparent hover:border-primary/50 transition-all duration-200 cursor-default"
     >
      <div
       class="text-[9px] text-muted-foreground uppercase tracking-wider mb-1"
      >
       Humidity
      </div>
      <div class="text-lg font-bold text-primary">{{ averageHumidity }}%</div>
      <div class="text-[9px] text-muted-foreground/70">Average</div>
     </div>
     <div
      class="bg-secondary rounded-xl p-3 text-center border border-transparent hover:border-primary/50 transition-all duration-200 cursor-default"
     >
      <div
       class="text-[9px] text-muted-foreground uppercase tracking-wider mb-1"
      >
       High / Low
      </div>
      <div class="text-lg font-bold text-primary">
       {{ Math.round(maxTemp) }}° / {{ Math.round(minTemp) }}°
      </div>
      <div class="text-[9px] text-muted-foreground/70">This week</div>
     </div>
    </div>

    <!-- 10-Day Forecast -->
    <div class="mb-5">
     <h3 class="text-xs font-semibold text-muted-foreground mb-3">
      10-Day Forecast
     </h3>
     <div class="bg-secondary rounded-xl p-3 overflow-x-auto">
      <div class="flex items-end gap-0.5 min-w-max">
       <button
        v-for="(day, index) in forecastDays"
        :key="day.date"
        type="button"
        class="flex flex-col items-center flex-1 min-w-[48px] py-2 px-1 rounded-lg transition-all cursor-pointer"
        :class="selectedDay === index ? 'bg-primary/20' : 'hover:bg-muted'"
        @click="selectedDay = index"
       >
        <!-- Weather Icon -->
        <component
         :is="symbolToIcon[day.symbols?.[0] || 'Unknown'] || Sun"
         class="w-4 h-4 text-primary mb-1"
        />

        <!-- Max Temperature -->
        <span class="text-[11px] font-semibold text-foreground">
         {{ Math.round(day.maxTemp) }}°
        </span>

        <!-- Min Temperature -->
        <span class="text-[9px] text-muted-foreground mb-1">
         {{ Math.round(day.minTemp) }}°
        </span>

        <!-- Bar -->
        <div class="w-full h-14 flex items-end justify-center px-0.5 mb-1">
         <div
          class="w-full max-w-[18px] rounded-t transition-all duration-300"
          :class="
           selectedDay === index
            ? 'bg-gradient-to-t from-primary to-primary/70'
            : 'bg-gradient-to-t from-primary/70 to-primary/50'
          "
          :style="{ height: `${getBarHeight(day.maxTemp)}%` }"
         ></div>
        </div>

        <!-- Day -->
        <span class="text-[10px] font-medium text-foreground/80">
         {{ formatDay(day.date) }}
        </span>

        <!-- Date -->
        <span class="text-[8px] text-muted-foreground">
         {{ formatDate(day.date) }}
        </span>
       </button>
      </div>
     </div>
    </div>

    <!-- Selected Day Details -->
    <div v-if="selectedDayData" class="bg-secondary rounded-xl p-4">
     <h3 class="text-xs font-semibold text-muted-foreground mb-3">
      {{ formatFullDate(selectedDayData.date) }}
     </h3>
     <div class="grid grid-cols-2 gap-x-4 gap-y-3">
      <!-- Temperature -->
      <div class="flex items-center gap-2">
       <div
        class="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"
       >
        <Thermometer class="w-4 h-4 text-primary" />
       </div>
       <div class="flex flex-col">
        <span class="text-[9px] text-muted-foreground">Temperature</span>
        <span class="text-xs font-semibold text-foreground">
         {{ Math.round(selectedDayData.maxTemp) }}° /
         {{ Math.round(selectedDayData.minTemp) }}°
        </span>
       </div>
      </div>

      <!-- Humidity -->
      <div class="flex items-center gap-2">
       <div
        class="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"
       >
        <Droplets class="w-4 h-4 text-primary" />
       </div>
       <div class="flex flex-col">
        <span class="text-[9px] text-muted-foreground">Humidity</span>
        <span class="text-xs font-semibold text-foreground">
         {{ selectedDayData.avgHumidity }}%
        </span>
       </div>
      </div>

      <!-- Wind -->
      <div class="flex items-center gap-2">
       <div
        class="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"
       >
        <Wind class="w-4 h-4 text-primary" />
       </div>
       <div class="flex flex-col">
        <span class="text-[9px] text-muted-foreground">Wind</span>
        <span class="text-xs font-semibold text-foreground">
         {{ Math.round((selectedDayData.avgWind || 0) * 3.6) }} km/h
        </span>
       </div>
      </div>

      <!-- Precipitation -->
      <div class="flex items-center gap-2">
       <div
        class="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"
       >
        <CloudDrizzle class="w-4 h-4 text-primary" />
       </div>
       <div class="flex flex-col">
        <span class="text-[9px] text-muted-foreground">Precipitation</span>
        <span class="text-xs font-semibold text-foreground">
         {{ (selectedDayData.totalRain || 0).toFixed(1) }} mm
        </span>
       </div>
      </div>
     </div>
    </div>
   </div>
  </div>
 </div>
</template>

<style scoped>
/* Slim scrollbar */
.overflow-x-auto {
 scrollbar-width: thin;
 scrollbar-color: color-mix(in oklch, var(--border) 50%, transparent)
  transparent;
}

.overflow-x-auto::-webkit-scrollbar {
 height: 3px;
}

.overflow-x-auto::-webkit-scrollbar-track {
 background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
 background-color: color-mix(in oklch, var(--border) 50%, transparent);
 border-radius: 3px;
}
</style>
