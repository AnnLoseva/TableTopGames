import ChapterEditorRoute from '@/features/chronicle/routes/ChapterEditorRoute'

export const dynamic = 'force-dynamic'

export default async function ChronicleChapterEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ChapterEditorRoute chapterId={id} />
}
