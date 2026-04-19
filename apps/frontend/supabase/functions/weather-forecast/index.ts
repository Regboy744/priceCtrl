import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface ForecastPoint {
 time: string
 temperature: number
 rain: number
 wind: number
 windGust: number
 humidity: number
 cloudiness: number
 symbol: string
}

interface RetailSignals {
 avgTemp: number
 heavyRainPeriods: number
 windyPeriods: number
 demandSignals: string[]
}

interface WeatherResponse {
 forecast: ForecastPoint[]
 signals: RetailSignals
 location: {
  lat: number
  lon: number
  altitude: number
 }
 meta: {
  created: string
  model: string
 }
}

// CORS headers
const corsHeaders = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers':
  'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Parse Met Eireann XML to structured forecast data
function parseMetEireannXml(xmlText: string): {
 forecast: ForecastPoint[]
 location: { lat: number; lon: number; altitude: number }
 meta: { created: string; model: string }
} {
 // Extract created timestamp
 const createdMatch = xmlText.match(/created="([^"]+)"/)
 const created = createdMatch ? createdMatch[1] : new Date().toISOString()

 // Extract model info
 const modelMatch = xmlText.match(/<model name="([^"]+)"/)
 const model = modelMatch ? modelMatch[1] : 'unknown'

 // Extract location info from first time entry
 const locationMatch = xmlText.match(
  /altitude="([^"]+)" latitude="([^"]+)" longitude="([^"]+)"/,
 )
 const location = {
  altitude: locationMatch ? parseFloat(locationMatch[1]) : 0,
  lat: locationMatch ? parseFloat(locationMatch[2]) : 0,
  lon: locationMatch ? parseFloat(locationMatch[3]) : 0,
 }

 const forecast: ForecastPoint[] = []
 const processedTimes = new Set<string>()

 // Match all time blocks - we need both instantaneous readings and precipitation
 const timeBlockRegex =
  /<time[^>]*from="([^"]+)"[^>]*to="([^"]+)"[^>]*>([\s\S]*?)<\/time>/g
 let match

 // First pass: collect instantaneous weather data (where from === to)
 const instantData = new Map<
  string,
  {
   temperature: number
   wind: number
   windGust: number
   humidity: number
   cloudiness: number
  }
 >()

 // Second pass: collect precipitation data (where from !== to)
 const precipData = new Map<string, { rain: number; symbol: string }>()

 const xmlCopy = xmlText
 const allMatches: Array<{
  from: string
  to: string
  content: string
 }> = []

 while ((match = timeBlockRegex.exec(xmlCopy)) !== null) {
  allMatches.push({
   from: match[1],
   to: match[2],
   content: match[3],
  })
 }

 for (const block of allMatches) {
  const { from, to, content } = block

  if (from === to) {
   // Instantaneous reading
   const tempMatch = content.match(/<temperature[^>]*value="([^"]+)"[^>]*\/>/)
   const windMatch = content.match(/<windSpeed[^>]*mps="([^"]+)"[^>]*\/>/)
   const gustMatch = content.match(/<windGust[^>]*mps="([^"]+)"[^>]*\/>/)
   const humidityMatch = content.match(/<humidity[^>]*value="([^"]+)"[^>]*\/>/)
   const cloudMatch = content.match(/<cloudiness[^>]*percent="([^"]+)"[^>]*\/>/)

   instantData.set(from, {
    temperature: tempMatch ? parseFloat(tempMatch[1]) : 0,
    wind: windMatch ? parseFloat(windMatch[1]) : 0,
    windGust: gustMatch ? parseFloat(gustMatch[1]) : 0,
    humidity: humidityMatch ? parseFloat(humidityMatch[1]) : 0,
    cloudiness: cloudMatch ? parseFloat(cloudMatch[1]) : 0,
   })
  } else {
   // Period reading (precipitation)
   const precipMatch = content.match(
    /<precipitation[^>]*value="([^"]+)"[^>]*\/>/,
   )
   const symbolMatch = content.match(/<symbol[^>]*id="([^"]+)"[^>]*\/>/)

   precipData.set(to, {
    rain: precipMatch ? parseFloat(precipMatch[1]) : 0,
    symbol: symbolMatch ? symbolMatch[1] : 'Unknown',
   })
  }
 }

 // Merge data into forecast points
 for (const [time, instant] of instantData) {
  if (processedTimes.has(time)) continue
  processedTimes.add(time)

  const precip = precipData.get(time) || { rain: 0, symbol: 'Unknown' }

  forecast.push({
   time,
   temperature: instant.temperature,
   rain: precip.rain,
   wind: instant.wind,
   windGust: instant.windGust,
   humidity: instant.humidity,
   cloudiness: instant.cloudiness,
   symbol: precip.symbol,
  })
 }

 // Sort by time
 forecast.sort(
  (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
 )

 return {
  forecast: forecast.slice(0, 240), // Limit to ~240 hours (10 days coverage)
  location,
  meta: { created, model },
 }
}

// Calculate retail-focused signals from forecast data
function calculateRetailSignals(forecast: ForecastPoint[]): RetailSignals {
 if (forecast.length === 0) {
  return {
   avgTemp: 0,
   heavyRainPeriods: 0,
   windyPeriods: 0,
   demandSignals: [],
  }
 }

 const avgTemp = Math.round(
  forecast.reduce((sum, f) => sum + f.temperature, 0) / forecast.length,
 )

 // Heavy rain: > 2mm per hour (adjusted from 5mm which is very heavy)
 const heavyRainPeriods = forecast.filter((f) => f.rain > 2).length

 // Windy: > 10 m/s (about 36 km/h, fresh to strong breeze)
 const windyPeriods = forecast.filter((f) => f.wind > 10).length

 const demandSignals: string[] = []

 // Temperature-based signals
 if (avgTemp >= 18) {
  demandSignals.push('Cold drinks, BBQ, ice cream demand up')
 } else if (avgTemp >= 12 && avgTemp < 18) {
  demandSignals.push('Mild weather - balanced category demand')
 } else if (avgTemp <= 8) {
  demandSignals.push('Soups, ready meals, hot drinks demand up')
 }

 // Rain-based signals
 if (heavyRainPeriods > 10) {
  demandSignals.push('Expect reduced footfall, online orders may increase')
 } else if (heavyRainPeriods > 5) {
  demandSignals.push('Some wet periods - plan for variable footfall')
 }

 // Wind-based signals
 if (windyPeriods > 15) {
  demandSignals.push('High wind risk - check fresh produce shelf life')
  demandSignals.push('Delivery scheduling may need adjustment')
 } else if (windyPeriods > 8) {
  demandSignals.push('Moderate wind - monitor outdoor displays')
 }

 // Humidity and cloudiness signals
 const avgHumidity =
  forecast.reduce((sum, f) => sum + f.humidity, 0) / forecast.length
 if (avgHumidity > 85) {
  demandSignals.push('High humidity - bakery/produce quality check advised')
 }

 return {
  avgTemp,
  heavyRainPeriods,
  windyPeriods,
  demandSignals,
 }
}

Deno.serve(async (req: Request) => {
 // Handle CORS preflight
 if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
 }

 try {
  // Parse request body
  const { lat, lon } = await req.json()

  if (typeof lat !== 'number' || typeof lon !== 'number') {
   return new Response(
    JSON.stringify({ error: 'lat and lon are required as numbers' }),
    {
     status: 400,
     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
   )
  }

  // Validate coordinates are roughly in Ireland/UK region
  if (lat < 50 || lat > 56 || lon < -11 || lon > 2) {
   return new Response(
    JSON.stringify({
     error: 'Coordinates outside Met Eireann coverage area (Ireland region)',
    }),
    {
     status: 400,
     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
   )
  }

  // Fetch from Met Eireann Open Access API
  // Format: http://openaccess.pf.api.met.ie/metno-wdb2ts/locationforecast?lat=LAT;long=LON
  const metUrl = `http://openaccess.pf.api.met.ie/metno-wdb2ts/locationforecast?lat=${lat};long=${lon}`
  const metResponse = await fetch(metUrl, {
   headers: {
    Accept: 'application/xml',
   },
  })

  if (!metResponse.ok) {
   return new Response(
    JSON.stringify({
     error: `Met Eireann API error: ${metResponse.status}`,
    }),
    {
     status: 502,
     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
   )
  }

  const xmlText = await metResponse.text()

  // Parse XML and calculate signals
  const { forecast, location, meta } = parseMetEireannXml(xmlText)
  const signals = calculateRetailSignals(forecast)

  const response: WeatherResponse = {
   forecast,
   signals,
   location,
   meta,
  }

  return new Response(JSON.stringify(response), {
   headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
   },
  })
 } catch (error) {
  console.error('Weather forecast error:', error)
  return new Response(
   JSON.stringify({
    error: 'Internal server error',
    details: error instanceof Error ? error.message : 'Unknown error',
   }),
   {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
   },
  )
 }
})
