import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { ActiveParticipant, ChatUser, MasterReveal, MasterWhisper, RightRailTab } from '@/games/vampires/modules/table/types'
import { useLang } from '@/games/vampires/lib/i18n/LanguageProvider'

type MasterPanelProps = {
  rightRailTab: RightRailTab
  isMaster: boolean
  masterReveals: MasterReveal[]
  visibleMasterWhispers: MasterWhisper[]
  room: string
  chatUser: ChatUser | null
  selectedMasterChatUserId: string
  masterChatPlayers: ActiveParticipant[]
  masterChatDraft: string
  formatTime: (value: string) => string
  setSelectedMasterChatUserId: Dispatch<SetStateAction<string>>
  setMasterChatDraft: Dispatch<SetStateAction<string>>
  sendMasterWhisper: (event: FormEvent<HTMLFormElement>) => void
}

export default function MasterPanel({
  rightRailTab,
  isMaster,
  masterReveals,
  visibleMasterWhispers,
  room,
  chatUser,
  selectedMasterChatUserId,
  masterChatPlayers,
  masterChatDraft,
  formatTime,
  setSelectedMasterChatUserId,
  setMasterChatDraft,
  sendMasterWhisper,
}: MasterPanelProps) {
  const { t } = useLang()
  return (
    <section className={`master-sidebar table-right-panel ${rightRailTab === 'master' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Связь с мастером')}>
      <header>
        <div>
          <span>{isMaster ? t('Панель мастера') : t('Чат с мастером')}</span>
          <strong>{isMaster ? masterReveals.length : visibleMasterWhispers.length}</strong>
        </div>
        <div>
          <span>{t('Комната')}</span>
          <strong>{room}</strong>
        </div>
      </header>

      {!chatUser ? (
        <p className="panel-empty">{t('Войдите в аккаунт, чтобы писать мастеру.')}</p>
      ) : (
        <>
          {isMaster ? (
            <section className="master-reveal-list">
              <strong>{t('Показано мастеру')}</strong>
              {masterReveals.length === 0 ? (
                <p className="panel-empty">{t('Игроки пока ничего не показывали.')}</p>
              ) : masterReveals.map(item => (
                <article key={item.id}>
                  <span>{t(item.kind)} · {item.characterName} · {item.username}</span>
                  <strong>{item.title}</strong>
                  {item.meta ? <small>{item.meta}</small> : null}
                  <p>{item.body}</p>
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                </article>
              ))}
            </section>
          ) : null}

          <section className="master-chat-panel">
            {isMaster ? (
              <label>
                <span>{t('Игрок')}</span>
                <select value={selectedMasterChatUserId} onChange={event => setSelectedMasterChatUserId(event.target.value)}>
                  <option value="">{t('Все сообщения')}</option>
                  {masterChatPlayers.map(player => (
                    <option value={player.userId} key={player.userId}>{player.username} · {player.characterName}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="master-chat-list">
              {visibleMasterWhispers.length === 0 ? (
                <p className="panel-empty">{isMaster ? t('Выберите игрока или дождитесь сообщения.') : t('Здесь будет приватный диалог с мастером.')}</p>
              ) : visibleMasterWhispers.map(message => (
                <article className={message.fromUserId === chatUser.id ? 'own' : ''} key={message.id}>
                  <strong>{message.fromMaster ? t('Мастер') : message.fromUsername}</strong>
                  <p>{message.message}</p>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </article>
              ))}
            </div>
            <form className="master-chat-composer" onSubmit={sendMasterWhisper}>
              <textarea
                value={masterChatDraft}
                onChange={event => setMasterChatDraft(event.target.value)}
                placeholder={isMaster ? t('Ответ игроку...') : t('Сообщение мастеру...')}
                rows={3}
              />
              <button type="submit" disabled={!masterChatDraft.trim() || (isMaster && !selectedMasterChatUserId)}>
                {t('Отправить')}
              </button>
            </form>
          </section>
        </>
      )}
    </section>
  )
}
