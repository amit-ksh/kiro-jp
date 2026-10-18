/** Original Kiro JP geometry. Coordinates share a 256-unit canvas. */
export type BrandStroke = readonly [number, number, number, number];
export const brandInk = "#FFFFFF";
export const brandAccent = "#FF5C00";
export const brandBackground = "#37469E";
export const brandStrokeWidth = 10;
// A clean, joined 日 silhouette avoids the capsule end-caps protruding at its corners.
export const brandOpeningPath =
  "M-39-49H39V47H-39Z M-29-39V-6H29V-39Z M-29 4V37H29V4Z";
export const brandFrames: readonly (readonly BrandStroke[])[] = [
  // 日 — Japanese/day. Extra segments remain hidden until the next shape.
  [
    [-38, -48, -38, 42],
    [-38, 42, 38, 42],
    [38, -48, 38, 42],
    [-38, -48, 38, -48],
    [-38, -3, 38, -3],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
  ],
  // 本 — book/origin. This is a visual transition, not a kanji lesson.
  [
    [-52, -21, 52, -21],
    [-43, 38, 0, -21],
    [0, -51, 0, 51],
    [0, -21, 43, 38],
    [-28, 25, 28, 25],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
  ],
  // An open book with an orange speech/ribbon accent.
  [
    [-50, -42, -50, 30],
    [-50, 30, 0, 46],
    [0, -26, 0, 46],
    [-50, -42, 0, -26],
    [0, -26, 50, -42],
    [50, -42, 50, 30],
    [0, 46, 50, 30],
    [35, 35, 51, 49],
  ],
];
export function strokePose(stroke: BrandStroke) {
  const [x1, y1, x2, y2] = stroke;
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    length: Math.hypot(x2 - x1, y2 - y1),
    angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
  };
}
export function brandStrokeOpacity(frame: number, index: number) {
  return frame < 2 && index >= 5 ? 0 : 1;
}
