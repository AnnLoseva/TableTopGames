import { redirect } from 'next/navigation'

type OldCharacterSheetRedirectProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function OldCharacterSheetRedirect({ searchParams }: OldCharacterSheetRedirectProps) {
  const params = (await searchParams) || {}
  const roomParam = params.room
  const room = Array.isArray(roomParam) ? roomParam[0] : roomParam
  redirect(room ? `/character-sheet?room=${encodeURIComponent(room)}` : '/character-sheet')
}
