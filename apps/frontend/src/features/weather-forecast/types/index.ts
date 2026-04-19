export interface ForecastPoint {
 time: string
 temperature: number
 rain: number
 wind: number
 windGust: number
 humidity: number
 cloudiness: number
 symbol: string
}

export interface RetailSignals {
 avgTemp: number
 heavyRainPeriods: number
 windyPeriods: number
 demandSignals: string[]
}

export interface WeatherLocation {
 lat: number
 lon: number
 altitude: number
}

export interface WeatherMeta {
 created: string
 model: string
}

export interface WeatherResponse {
 forecast: ForecastPoint[]
 signals: RetailSignals
 location: WeatherLocation
 meta: WeatherMeta
}

export interface GeolocationState {
 status: 'idle' | 'loading' | 'success' | 'error'
 error?: string
 coords?: {
  lat: number
  lon: number
 }
}

export type WeatherSymbol =
 | 'Sun'
 | 'LightCloud'
 | 'PartlyCloud'
 | 'Cloud'
 | 'LightRainSun'
 | 'LightRainThunderSun'
 | 'SleetSun'
 | 'SnowSun'
 | 'LightRain'
 | 'Rain'
 | 'RainThunder'
 | 'Sleet'
 | 'Snow'
 | 'SnowThunder'
 | 'Fog'
 | 'SleetSunThunder'
 | 'SnowSunThunder'
 | 'LightRainThunder'
 | 'SleetThunder'
 | 'DrizzleThunderSun'
 | 'RainThunderSun'
 | 'LightSleetThunderSun'
 | 'HeavySleetThunderSun'
 | 'LightSnowThunderSun'
 | 'HeavySnowThunderSun'
 | 'DrizzleThunder'
 | 'LightSleetThunder'
 | 'HeavySleetThunder'
 | 'LightSnowThunder'
 | 'HeavySnowThunder'
 | 'DrizzleSun'
 | 'RainSun'
 | 'LightSleetSun'
 | 'HeavySleetSun'
 | 'LightSnowSun'
 | 'HeavySnowSun'
 | 'Drizzle'
 | 'LightSleet'
 | 'HeavySleet'
 | 'LightSnow'
 | 'HeavySnow'
 | 'Unknown'
