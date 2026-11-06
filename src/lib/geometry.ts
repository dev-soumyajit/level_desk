import type { Rect } from './types';
export function rawBounds(rect: Rect, matrix: number[]) {
  const [a,b,c,d,e,f] = matrix;
  const det = a*d-b*c;
  if (Math.abs(det) < .00001) throw new Error('Unsupported page geometry.');
  const invert = (x: number,y: number) => [(d*(x-e)-c*(y-f))/det, (-b*(x-e)+a*(y-f))/det];
  const pts = [invert(rect.x,rect.y),invert(rect.x+rect.width,rect.y),invert(rect.x,rect.y+rect.height),invert(rect.x+rect.width,rect.y+rect.height)];
  return { left: Math.min(...pts.map(p=>p[0])), right: Math.max(...pts.map(p=>p[0])), bottom: Math.min(...pts.map(p=>p[1])), top: Math.max(...pts.map(p=>p[1])) };
}
