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

/** Player visibility rule: own tokens are always visible, everything else must intersect the stage. */
export function isObjectVisibleToPlayer({
  object,
  scene,
  isOwnToken,
}: {
  object: SceneObjectRect
  scene: SceneBounds
  isOwnToken: boolean
}): boolean {
  if (isOwnToken) return true
  return intersectsScene(object, scene)
}
