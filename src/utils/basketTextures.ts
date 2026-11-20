const FALLBACK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface BasketTexturePair {
  backSrc: string;
  frontSrc: string;
}

function create2xCanvas(
  logicalWidth: number,
  logicalHeight: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * 2;
  canvas.height = logicalHeight * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.scale(2, 2);
  return { canvas, ctx };
}

function drawDiamondMesh(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step: number,
  color: string,
  lineWidth: number,
  alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let x = -height; x <= width + height; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.moveTo(x + height, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();
  ctx.restore();
}

function buildLargeBackPng(): string {
  const created = create2xCanvas(280, 296);
  if (!created) return FALLBACK_PIXEL;
  const { canvas, ctx } = created;

  // Clip to back interior including curved top oval rim
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20, 18);
  ctx.bezierCurveTo(20, 8, 260, 8, 260, 18);
  ctx.lineTo(234, 276);
  ctx.bezierCurveTo(231, 286, 49, 286, 46, 276);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createLinearGradient(140, 8, 140, 288);
  grad.addColorStop(0, 'rgba(20, 17, 15, 0.9)');
  grad.addColorStop(0.55, 'rgba(38, 33, 30, 0.8)');
  grad.addColorStop(1, 'rgba(15, 12, 11, 0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 280, 296);

  drawDiamondMesh(ctx, 280, 296, 16, '#57534e', 0.9, 0.45);
  ctx.restore();

  // Back half of the rolled top rim
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.bezierCurveTo(18, 7, 262, 7, 262, 18);
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(20, 18);
  ctx.bezierCurveTo(20, 9, 260, 9, 260, 18);
  ctx.strokeStyle = 'rgba(168, 162, 158, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function buildLargeFrontPng(): string {
  const created = create2xCanvas(280, 296);
  if (!created) return FALLBACK_PIXEL;
  const { canvas, ctx } = created;

  // Clip to front basket body
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20, 18);
  ctx.lineTo(46, 276);
  ctx.bezierCurveTo(49, 286, 231, 286, 234, 276);
  ctx.lineTo(260, 18);
  ctx.bezierCurveTo(260, 28, 20, 28, 20, 18);
  ctx.closePath();
  ctx.clip();

  drawDiamondMesh(ctx, 280, 296, 16, '#d6d3d1', 1.05, 0.52);

  const sheen = ctx.createLinearGradient(20, 0, 260, 0);
  sheen.addColorStop(0, 'rgba(12, 10, 9, 0.45)');
  sheen.addColorStop(0.22, 'rgba(255, 255, 255, 0.1)');
  sheen.addColorStop(0.52, 'rgba(120, 113, 108, 0.06)');
  sheen.addColorStop(1, 'rgba(12, 10, 9, 0.45)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 280, 296);
  ctx.restore();

  // Outer wireframe edges & base ring
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 18);
  ctx.lineTo(46, 276);
  ctx.bezierCurveTo(49, 286, 231, 286, 234, 276);
  ctx.lineTo(260, 18);
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(46, 276);
  ctx.bezierCurveTo(49, 286, 231, 286, 234, 276);
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rolled metallic front rim
  ctx.beginPath();
  ctx.moveTo(16, 18);
  ctx.bezierCurveTo(16, 30, 264, 30, 264, 18);
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 5.8;
  ctx.stroke();
  ctx.strokeStyle = '#8b8580';
  ctx.lineWidth = 3.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(18, 17.5);
  ctx.bezierCurveTo(18, 28.5, 262, 28.5, 262, 17.5);
  ctx.strokeStyle = 'rgba(231, 229, 228, 0.9)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function buildSmallBackPng(highlighted: boolean): string {
  const created = create2xCanvas(88, 88);
  if (!created) return FALLBACK_PIXEL;
  const { canvas, ctx } = created;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(15, 19);
  ctx.bezierCurveTo(15, 13, 73, 13, 73, 19);
  ctx.lineTo(65, 76);
  ctx.bezierCurveTo(64, 80, 24, 80, 23, 76);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createLinearGradient(44, 14, 44, 80);
  grad.addColorStop(0, 'rgba(20, 17, 15, 0.9)');
  grad.addColorStop(0.6, 'rgba(38, 33, 30, 0.8)');
  grad.addColorStop(1, 'rgba(15, 12, 11, 0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 88, 88);

  drawDiamondMesh(ctx, 88, 88, 7.5, '#57534e', 0.7, 0.45);
  ctx.restore();

  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 19);
  ctx.bezierCurveTo(14, 13, 74, 13, 74, 19);
  ctx.strokeStyle = highlighted ? '#fbbf24' : '#57534e';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function buildSmallFrontPng(highlighted: boolean): string {
  const created = create2xCanvas(88, 88);
  if (!created) return FALLBACK_PIXEL;
  const { canvas, ctx } = created;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(15, 20);
  ctx.lineTo(23, 76);
  ctx.bezierCurveTo(24, 80, 64, 80, 65, 76);
  ctx.lineTo(73, 20);
  ctx.bezierCurveTo(73, 24, 15, 24, 15, 20);
  ctx.closePath();
  ctx.clip();

  drawDiamondMesh(ctx, 88, 88, 7.5, '#d6d3d1', 0.75, 0.56);

  const sheen = ctx.createLinearGradient(15, 0, 73, 0);
  sheen.addColorStop(0, 'rgba(12, 10, 9, 0.42)');
  sheen.addColorStop(0.24, 'rgba(255, 255, 255, 0.12)');
  sheen.addColorStop(0.55, 'rgba(120, 113, 108, 0.05)');
  sheen.addColorStop(1, 'rgba(12, 10, 9, 0.42)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 88, 88);
  ctx.restore();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(15, 20);
  ctx.lineTo(23, 76);
  ctx.bezierCurveTo(24, 80, 64, 80, 65, 76);
  ctx.lineTo(73, 20);
  ctx.strokeStyle = highlighted ? '#fbbf24' : '#a8a29e';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(23, 76);
  ctx.bezierCurveTo(24, 80, 64, 80, 65, 76);
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(13.5, 19);
  ctx.bezierCurveTo(13.5, 24.5, 74.5, 24.5, 74.5, 19);
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.strokeStyle = highlighted ? '#fbbf24' : '#8b8580';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14.5, 18.7);
  ctx.bezierCurveTo(14.5, 23.7, 73.5, 23.7, 73.5, 18.7);
  ctx.strokeStyle = highlighted ? '#fde68a' : '#e7e5e4';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

let cachedLarge: BasketTexturePair | null = null;
let cachedSmallNeutral: BasketTexturePair | null = null;
let cachedSmallHighlight: BasketTexturePair | null = null;

export function getLargeBasketTextures(): BasketTexturePair {
  if (!cachedLarge) {
    cachedLarge = {
      backSrc: buildLargeBackPng(),
      frontSrc: buildLargeFrontPng(),
    };
  }
  return cachedLarge;
}

export function getSmallBasketTextures(highlighted: boolean): BasketTexturePair {
  if (highlighted) {
    if (!cachedSmallHighlight) {
      cachedSmallHighlight = {
        backSrc: buildSmallBackPng(true),
        frontSrc: buildSmallFrontPng(true),
      };
    }
    return cachedSmallHighlight;
  }
  if (!cachedSmallNeutral) {
    cachedSmallNeutral = {
      backSrc: buildSmallBackPng(false),
      frontSrc: buildSmallFrontPng(false),
    };
  }
  return cachedSmallNeutral;
}
