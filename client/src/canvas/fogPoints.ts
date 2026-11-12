export function downsamplePoints(
  points: Array<{ x: number; y: number }>,
  minDistance: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 1) {
    return points;
  }
  const result: Array<{ x: number; y: number }> = [];
  const first = points[0];
  if (!first) {
    return result;
  }
  result.push(first);
  let last = first;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (!point) {
      continue;
    }
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    if (Math.hypot(dx, dy) >= minDistance) {
      result.push(point);
      last = point;
    }
  }
  const finalPoint = points[points.length - 1];
  if (finalPoint && result[result.length - 1] !== finalPoint) {
    result.push(finalPoint);
  }
  return result.slice(0, 240);
}
