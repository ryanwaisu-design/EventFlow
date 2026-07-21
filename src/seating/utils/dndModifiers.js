/**
 * dnd-kit modifier：拖曳預覽中心對準游標
 *（避免在縮放／平移畫布內，名字離游標過遠）
 */
export function snapCenterToCursor({ activatorEvent, draggingNodeRect, transform }) {
  if (!draggingNodeRect || !activatorEvent) return transform;

  const point =
    'clientX' in activatorEvent
      ? activatorEvent
      : activatorEvent.touches?.[0] || activatorEvent.changedTouches?.[0];

  if (!point || typeof point.clientX !== 'number') return transform;

  return {
    ...transform,
    x: transform.x + (point.clientX - draggingNodeRect.left) - draggingNodeRect.width / 2,
    y: transform.y + (point.clientY - draggingNodeRect.top) - draggingNodeRect.height / 2,
  };
}
