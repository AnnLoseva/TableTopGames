import { SpeedInsights } from "@vercel/speed-insights/next"

export { createAccountClient as createClient } from '@/platform/account/supabase'

export const showSpeedInsights = SpeedInsights
