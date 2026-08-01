import type { Dispatch, DragEvent, FormEvent, RefObject, SetStateAction } from 'react'
import type { LeftToolbarTab, SceneMusicTrack, TableScene, TableSceneFolder } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type SceneManagerProps = {
  leftToolbarTab: LeftToolbarTab
  activeScene: TableScene | null | undefined
  selectedScene: TableScene | null | undefined
  sceneStatus: string
  scenes: TableScene[]
  sceneFolders: TableSceneFolder[]
  selectedSceneMusic: SceneMusicTrack[]
  room: string
  sceneMusicDraft: string
  isUploading: boolean
  sceneMusicFileInputRef: RefObject<HTMLInputElement | null>
  createScene: (folderId?: string | null) => Promise<void>
  renameScene: () => Promise<void>
  deleteScene: () => Promise<void>
  activateScene: (sceneId: string) => Promise<void>
  createSceneFolder: () => Promise<string | null>
  renameSceneFolder: (folder: TableSceneFolder) => Promise<void>
  deleteSceneFolder: (folder: TableSceneFolder) => Promise<void>
  moveSceneToFolder: (sceneId: string, folderId: string | null) => Promise<void>
  copyScene: (scene: TableScene, folderId: string | null) => Promise<void>
  setSceneViewMode: (viewMode: 'table' | 'free') => Promise<void>
  loadSceneMusic: (targetRoom: string, sceneId: string) => Promise<void>
  setSelectedSceneId: Dispatch<SetStateAction<string | null>>
  handleSceneMusicDrop: (event: DragEvent<HTMLElement>) => Promise<void>
  addSceneMusic: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setSceneMusicDraft: Dispatch<SetStateAction<string>>
  reorderSceneMusic: (track: SceneMusicTrack, direction: 'up' | 'down') => Promise<void>
  publishSceneTrack: (track: SceneMusicTrack, options?: { play?: boolean }) => void
  patchSceneMusic: (track: SceneMusicTrack, patch: Partial<Pick<SceneMusicTrack, 'title' | 'orderIndex' | 'isDefault' | 'autoplay'>>) => Promise<void>
  renameSceneMusic: (track: SceneMusicTrack) => Promise<void>
  deleteSceneMusic: (track: SceneMusicTrack) => Promise<void>
}

export default function SceneManager({
  leftToolbarTab,
  activeScene,
  selectedScene,
  sceneStatus,
  scenes,
  sceneFolders,
  selectedSceneMusic,
  room,
  sceneMusicDraft,
  isUploading,
  sceneMusicFileInputRef,
  createScene,
  renameScene,
  deleteScene,
  activateScene,
  createSceneFolder,
  renameSceneFolder,
  deleteSceneFolder,
  moveSceneToFolder,
  copyScene,
  setSceneViewMode,
  loadSceneMusic,
  setSelectedSceneId,
  handleSceneMusicDrop,
  addSceneMusic,
  setSceneMusicDraft,
  reorderSceneMusic,
  publishSceneTrack,
  patchSceneMusic,
  renameSceneMusic,
  deleteSceneMusic,
}: SceneManagerProps) {
  const { t, tf } = useLang()

  const renderSceneRow = (scene: TableScene) => (
    <article
      className={`scene-list-row ${scene.id === selectedScene?.id ? 'selected' : ''} ${scene.isActive ? 'active' : ''}`}
      key={scene.id}
      onClick={() => {
        setSelectedSceneId(scene.id)
        void loadSceneMusic(room, scene.id)
      }}
    >
      <div className="scene-thumb">
        {scene.thumbnailUrl ? <img src={scene.thumbnailUrl} alt="" /> : <span>{scene.name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div>
        <strong>{scene.name}</strong>
        <span>{scene.isActive ? t('сейчас на столе') : t('подготовлена')}</span>
      </div>
      <div className="scene-list-row-actions">
        <button type="button" disabled={scene.isActive} onClick={event => {
          event.stopPropagation()
          void activateScene(scene.id)
        }}>
          {scene.isActive ? t('Активна') : t('Включить')}
        </button>
        <button type="button" onClick={event => {
          event.stopPropagation()
          void copyScene(scene, scene.folderId)
        }} title={t('Скопировать сцену со слоями, токенами и музыкой')}>
          {t('Копировать')}
        </button>
        <select
          value={scene.folderId || ''}
          onClick={event => event.stopPropagation()}
          onChange={event => {
            event.stopPropagation()
            void moveSceneToFolder(scene.id, event.target.value || null)
          }}
          title={t('Переместить в папку')}
        >
          <option value="">{t('Без папки')}</option>
          {sceneFolders.map(folder => (
            <option value={folder.id} key={folder.id}>{folder.name}</option>
          ))}
        </select>
      </div>
    </article>
  )

  const ungroupedScenes = scenes.filter(scene => !scene.folderId)

  return (
    <section className={`scene-control-panel ${leftToolbarTab === 'scenes' ? '' : 'table-right-panel-hidden'}`}>
      <header>
        <div>
          <span>{t('Активная сцена')}</span>
          <strong>{activeScene?.name || t(sceneStatus)}</strong>
        </div>
      </header>
      <div className="scene-toolbar">
        <button type="button" onClick={() => void createScene(null)}>{t('Создать')}</button>
        <button type="button" onClick={() => void createSceneFolder()}>{t('Новая сессия')}</button>
        <button type="button" onClick={() => void renameScene()} disabled={!selectedScene}>{t('Переименовать')}</button>
        <button type="button" onClick={() => void deleteScene()} disabled={!selectedScene || scenes.length <= 1}>{t('Удалить')}</button>
      </div>
      <div className="scene-view-mode" aria-label={t('Режим просмотра игроков')}>
        <span>{t('Режим игроков')}</span>
        <div>
          <button
            type="button"
            className={(activeScene?.viewMode || 'table') === 'table' ? 'active' : ''}
            onClick={() => void setSceneViewMode('table')}
            disabled={!activeScene}
          >
            {t('Стол')}
          </button>
          <button
            type="button"
            className={activeScene?.viewMode === 'free' ? 'active' : ''}
            onClick={() => void setSceneViewMode('free')}
            disabled={!activeScene}
          >
            {t('Свободный')}
          </button>
        </div>
        <small>
          {(activeScene?.viewMode || 'table') === 'table'
            ? t('Игроки видят только границы фоновой картинки.')
            : t('Игроки могут перемещаться по всей рабочей области.')}
        </small>
      </div>
      <div className="scene-list">
        {scenes.length === 0 ? (
          <p className="panel-empty">{t('Сцены пока не загружены.')}</p>
        ) : (
          <>
            {sceneFolders.map(folder => {
              const folderScenes = scenes.filter(scene => scene.folderId === folder.id)
              return (
                <details open className="scene-folder-group" key={folder.id}>
                  <summary>
                    <span>{folder.name}</span>
                    <em>{folderScenes.length}</em>
                    <button type="button" onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      void createScene(folder.id)
                    }} title={t('Новая сцена в этой сессии')}>+</button>
                    <button type="button" onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      void renameSceneFolder(folder)
                    }} title={t('Переименовать сессию')}>✎</button>
                    <button type="button" className="danger" onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      void deleteSceneFolder(folder)
                    }} title={t('Удалить сессию')}>×</button>
                  </summary>
                  {folderScenes.length === 0 ? (
                    <p className="panel-empty">{t('Пусто')}</p>
                  ) : folderScenes.map(renderSceneRow)}
                </details>
              )
            })}
            {ungroupedScenes.length > 0 ? (
              <details open className="scene-folder-group">
                <summary>
                  <span>{t('Без папки')}</span>
                  <em>{ungroupedScenes.length}</em>
                </summary>
                {ungroupedScenes.map(renderSceneRow)}
              </details>
            ) : null}
          </>
        )}
      </div>
      <div className="scene-music-box scene-music-box-prominent">
        <header>
          <strong>{t('Музыка сцены')}</strong>
          <span>{selectedSceneMusic.length ? tf('{count} треков', { count: selectedSceneMusic.length }) : t('мини-плейлист пуст')}</span>
        </header>
        <div
          className="scene-music-actions"
          onDragOver={event => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDrop={handleSceneMusicDrop}
        >
          <button type="button" onClick={() => sceneMusicFileInputRef.current?.click()} disabled={!selectedScene || isUploading}>
            {t('Загрузить песню')}
          </button>
          <span>{t('Можно перетащить аудио сюда')}</span>
        </div>
        <form className="media-url-form" onSubmit={addSceneMusic}>
          <input
            value={sceneMusicDraft}
            onChange={event => setSceneMusicDraft(event.target.value)}
            placeholder={t('YouTube-ссылки через пробел')}
          />
          <button type="submit" disabled={!sceneMusicDraft.trim() || !selectedScene}>{t('Добавить')}</button>
        </form>
        <div className="scene-track-list">
          {selectedSceneMusic.map(track => (
            <article className="scene-track-row" key={track.id}>
              <div>
                <strong>{track.title}</strong>
                <span>{track.isDefault ? t('по умолчанию') : track.sourceType}{track.autoplay ? t(' · автозапуск') : ''}</span>
              </div>
              <button type="button" onClick={() => void reorderSceneMusic(track, 'up')}>↑</button>
              <button type="button" onClick={() => void reorderSceneMusic(track, 'down')}>↓</button>
              <button type="button" onClick={() => publishSceneTrack(track, { play: true })}>▶</button>
              <button type="button" onClick={() => void patchSceneMusic(track, { isDefault: true })}>★</button>
              <button type="button" onClick={() => void patchSceneMusic(track, { autoplay: !track.autoplay })}>{track.autoplay ? 'A' : 'a'}</button>
              <button type="button" onClick={() => void renameSceneMusic(track)}>T</button>
              <button type="button" className="danger" onClick={() => void deleteSceneMusic(track)}>×</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
