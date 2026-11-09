// Pure worker placement maths, kept separate from Three.js so assignment and
// layout rules can be unit-tested without a browser or WebGL context.

export const MAX_AVATARS_PER_STATION = 32;

/** Number of avatars for a workstation, from the editable "Assigned workers". */
export function workerCount(component) {
  if (!component || component.type !== 'workstation') return 0;
  const value = Math.round(Number(component.props?.workers) || 0);
  return Math.min(MAX_AVATARS_PER_STATION, Math.max(0, value));
}

/**
 * Place avatars in a front arc around the workstation. Eight avatars fit on the
 * first ring; further workers use an outer ring so bodies never overlap.
 */
export function workerLayout(component, count) {
  const safeCount = Math.min(MAX_AVATARS_PER_STATION, Math.max(0, Math.round(count) || 0));
  if (!safeCount) return [];
  const baseY = component?.position?.y || 0;
  const rotation = component?.rotation?.y || 0;
  const spread = safeCount === 1 ? 0 : Math.PI * 0.78;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const positions = [];

  for (let index = 0; index < safeCount; index += 1) {
    const ringIndex = Math.floor(index / 8);
    const ringCount = Math.min(8, safeCount - ringIndex * 8);
    const indexInRing = index % 8;
    const t = ringCount === 1 ? 0.5 : indexInRing / (ringCount - 1);
    const angle = safeCount === 1 ? 0 : -spread / 2 + t * spread;
    const radius = 1.38 + ringIndex * 0.92;
    const localX = Math.sin(angle) * radius;
    const localZ = Math.cos(angle) * radius;
    positions.push({
      x: (component?.position?.x || 0) + localX * cos + localZ * sin,
      y: baseY,
      z: (component?.position?.z || 0) - localX * sin + localZ * cos,
      rotationY: Math.atan2(-localX, -localZ),
    });
  }
  return positions;
}
