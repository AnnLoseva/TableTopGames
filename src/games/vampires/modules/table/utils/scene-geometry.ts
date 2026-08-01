/** Scene-stage geometry: what intersects the visible table rectangle. */

export type SceneBounds = {
  width: number
  height: number
}

export type SceneObjectRect = {
  x: number
  y: number
  width: number
  height: number
}

/** Rect-vs-stage intersection; an object fully outside the stage does not intersect. */
export function intersectsScene(object: SceneObjectRect, scene: SceneBounds): boolean {
  return (
    object.x < scene.width
    && object.y < scene.height
    && object.x + object.width > 0
    && object.y + object.height > 0
  )
}

/** Player Table-mode visibility rule: every object must intersect the stage. */
export function isObjectVisibleToPlayer({
  object,
  scene,
}: {
  object: SceneObjectRect
  scene: SceneBounds
}): boolean {
  return intersectsScene(object, scene)
}

/** Smallest zoom that covers the whole player viewport with the stage. */
export function getMinimumStageCoverZoom(
  viewport: { width: number; height: number },
  stage: SceneBounds,
): number {
  return Math.max(
    viewport.width / Math.max(1, stage.width),
    viewport.height / Math.max(1, stage.height),
  )
}

/**
 * Clamps one pan axis so the stage rectangle never scrolls out of a "Стол"-mode
 * viewport: if the stage (at the current zoom) is bigger than the viewport, the
 * viewport stays fully inside the stage; if smaller, the stage is centered and
 * panning that axis is locked.
 */
function clampPanAxis(value: number, viewportSize: number, stagePxSize: number): number {
  if (stagePxSize <= viewportSize) return (viewportSize - stagePxSize) / 2
  return Math.min(0, Math.max(viewportSize - stagePxSize, value))
}

/** Clamps a pan point so the stage stays within a "Стол"-mode viewport on both axes. */
export function clampPanToStage(
  pan: { x: number; y: number },
  zoom: number,
  viewport: { width: number; height: number },
  stage: SceneBounds,
): { x: number; y: number } {
  return {
    x: clampPanAxis(pan.x, viewport.width, stage.width * zoom),
    y: clampPanAxis(pan.y, viewport.height, stage.height * zoom),
  }
}
