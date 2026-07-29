export default function DesktopSizeGuard() {
  return (
    <div className="master-desktop-guard" role="status">
      <strong>Пульт рассчитан на большой экран</strong>
      <span>Минимальный рабочий размер — 1400×840.</span>
    </div>
  )
}
