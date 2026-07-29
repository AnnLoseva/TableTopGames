import { SpeedInsights } from '@vercel/speed-insights/next'
import MainScreen from './components/MainScreen'

export default function HomeRoute() {
  return (
    <>
      <MainScreen />
      <SpeedInsights />
    </>
  )
}
