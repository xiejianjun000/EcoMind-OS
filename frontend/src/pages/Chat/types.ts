import type { CityAQI } from "@/services/envDataService"

export interface EnvDataCard {
  type: 'aqi' | 'water' | 'stations'
  city: string
  aqi?: CityAQI
  waterQuality?: ReturnType<typeof import("@/services/envDataService").getCityWaterQuality>
  stations?: ReturnType<typeof import("@/services/envDataService").getCityStations>
}

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  expert?: { id: string; name: string }
  timestamp: string
  isStreaming?: boolean
  envData?: EnvDataCard
}
