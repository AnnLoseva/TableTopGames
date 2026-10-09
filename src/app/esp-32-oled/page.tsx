import type { Metadata } from 'next'
import Esp32OledRoute from '@/features/esp32-oled/components/Esp32OledRoute'

export const metadata: Metadata = {
  title: 'ESP32 OLED',
  description: 'Manage animations on an ESP32-C3 with a 128×64 OLED',
}

export default function Page() {
  return <Esp32OledRoute />
}

