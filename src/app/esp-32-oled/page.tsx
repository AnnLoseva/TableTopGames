import type { Metadata } from 'next'
import Esp32OledRoute from '@/features/esp32-oled/components/Esp32OledRoute'

export const metadata: Metadata = {
  title: 'ESP32 OLED',
  description: 'Управление анимациями на ESP32-C3 с OLED 128×64',
}

export default function Page() {
  return <Esp32OledRoute />
}

