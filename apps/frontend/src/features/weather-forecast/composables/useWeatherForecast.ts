import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { WeatherResponse, GeolocationState, ForecastPoint } from '../types'

// Default coordinates (Dublin, Ireland - center of Met Eireann coverage)
const DEFAULT_COORDS = {
 lat: 53.3498,
 lon: -6.2603,
}

// Shared state (singleton pattern)
const weatherData = ref<WeatherResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const usingFallback = ref(false)
const geolocation = ref<GeolocationState>({
 status: 'idle',
})

export function useWeatherForecast() {
 // Get user's geolocation
 const requestGeolocation = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve, reject) => {
   geolocation.value = { status: 'loading' }

   if (!navigator.geolocation) {
    const errorMsg = 'Geolocation is not supported by your browser'
    geolocation.value = { status: 'error', error: errorMsg }
    reject(new Error(errorMsg))
    return
   }

   navigator.geolocation.getCurrentPosition(
    (position) => {
     const coords = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
     }
     geolocation.value = { status: 'success', coords }
     resolve(coords)
    },
    (err) => {
     let errorMsg = 'Unable to retrieve your location'
     switch (err.code) {
      case err.PERMISSION_DENIED:
       errorMsg =
        'Location permission denied. Please enable location access in your browser settings to use this feature.'
       break
      case err.POSITION_UNAVAILABLE:
       errorMsg = 'Location information is unavailable'
       break
      case err.TIMEOUT:
       errorMsg = 'Location request timed out'
       break
     }
     geolocation.value = { status: 'error', error: errorMsg }
     reject(new Error(errorMsg))
    },
    {
     enableHighAccuracy: true, // Try GPS first, fallback to network
     timeout: 15000, // Longer timeout for GPS
     maximumAge: 600000, // Cache for 10 minutes
    },
   )
  })
 }

 // Fetch weather forecast from Edge Function
 const fetchForecast = async (lat: number, lon: number) => {
  isLoading.value = true
  error.value = null

  try {
   const { data, error: fnError } = await supabase.functions.invoke(
    'weather-forecast',
    {
     body: { lat, lon },
    },
   )

   if (fnError) {
    throw new Error(fnError.message || 'Failed to fetch weather data')
   }

   if (data.error) {
    throw new Error(data.error)
   }

   weatherData.value = data as WeatherResponse
   return data
  } catch (err) {
   const errorMsg =
    err instanceof Error ? err.message : 'Failed to fetch weather forecast'
   error.value = errorMsg
   throw err
  } finally {
   isLoading.value = false
  }
 }

 // Main function: get location and fetch forecast
 const loadWeatherForecast = async () => {
  try {
   const coords = await requestGeolocation()
   usingFallback.value = false
   await fetchForecast(coords.lat, coords.lon)
  } catch {
   // Geolocation failed (rate limit, permission, etc.) - use Dublin as fallback
   // This is expected behavior, especially on desktop without GPS
   usingFallback.value = true
   geolocation.value = {
    status: 'success',
    coords: DEFAULT_COORDS,
   }
   try {
    await fetchForecast(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon)
   } catch (fetchError) {
    console.error('Weather forecast error:', fetchError)
   }
  }
 }

 // Computed values for easy template access
 const forecast = computed(() => weatherData.value?.forecast ?? [])
 const signals = computed(() => weatherData.value?.signals ?? null)
 const location = computed(() => weatherData.value?.location ?? null)
 const meta = computed(() => weatherData.value?.meta ?? null)

 // Get forecast for next N hours
 const getNextHours = (hours: number): ForecastPoint[] => {
  return forecast.value.slice(0, hours)
 }

 // Get today's forecast (next 24 hours)
 const todayForecast = computed(() => getNextHours(24))

 // Get forecast summary by day
 const dailySummary = computed(() => {
  const days = new Map<
   string,
   {
    date: string
    minTemp: number
    maxTemp: number
    totalRain: number
    avgWind: number
    avgHumidity: number
    symbols: string[]
    _windSum: number
    _humiditySum: number
    _count: number
   }
  >()

  for (const point of forecast.value) {
   const datePart = point.time.split('T')[0]
   const date = datePart ?? point.time

   if (!days.has(date)) {
    days.set(date, {
     date,
     minTemp: point.temperature,
     maxTemp: point.temperature,
     totalRain: point.rain,
     avgWind: point.wind,
     avgHumidity: point.humidity,
     symbols: [point.symbol],
     _windSum: point.wind,
     _humiditySum: point.humidity,
     _count: 1,
    })
   } else {
    const day = days.get(date)
    if (day) {
     day.minTemp = Math.min(day.minTemp, point.temperature)
     day.maxTemp = Math.max(day.maxTemp, point.temperature)
     day.totalRain += point.rain
     day._windSum += point.wind
     day._humiditySum += point.humidity
     day._count += 1
     day.avgWind = day._windSum / day._count
     day.avgHumidity = day._humiditySum / day._count
     if (!day.symbols.includes(point.symbol)) {
      day.symbols.push(point.symbol)
     }
    }
   }
  }

  // Clean up internal tracking properties before returning
  return Array.from(days.values()).map((day) => {
   const clean = { ...day }
   delete (clean as { _windSum?: number })._windSum
   delete (clean as { _humiditySum?: number })._humiditySum
   delete (clean as { _count?: number })._count

   return {
    ...clean,
    avgWind: Math.round(clean.avgWind * 10) / 10,
    avgHumidity: Math.round(clean.avgHumidity),
   }
  })
 })

 // Refresh forecast (re-fetch with existing location)
 const refreshForecast = async () => {
  if (geolocation.value.coords) {
   await fetchForecast(
    geolocation.value.coords.lat,
    geolocation.value.coords.lon,
   )
  } else {
   await loadWeatherForecast()
  }
 }

 return {
  // State
  weatherData,
  isLoading,
  error,
  geolocation,
  usingFallback,

  // Computed
  forecast,
  signals,
  location,
  meta,
  todayForecast,
  dailySummary,

  // Methods
  loadWeatherForecast,
  refreshForecast,
  requestGeolocation,
  fetchForecast,
  getNextHours,
 }
}
