// Renders boss and enemy shapes for tutorial highlights

// Defensive helper for canvas arc calls (prevents DOMException on negative/non-finite radius)
const safeArcRadius = (r: number): number => (Number.isFinite(r) ? Math.max(0.001, r) : 0.001);

export type EntityType = 'cube' | 'sphere' | 'pyramid' | 'mega' | 'enemy' | 'star';

interface RenderOptions {
  isAngry?: boolean;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
}

export function renderBossToCanvas(
  ctx: CanvasRenderingContext2D,
  type: EntityType,
  centerX: number,
  centerY: number,
  size: number,
  options: RenderOptions = {}
): void {
  const { isAngry = false, rotationX = 0, rotationY = 0, rotationZ = 0 } = options;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  if (type === 'cube') {
    renderCubeBoss(ctx, size / 2, isAngry, rotationX, rotationY, rotationZ);
  } else if (type === 'sphere') {
    renderSphereBoss(ctx, size / 2, isAngry);
  } else if (type === 'pyramid') {
    renderPyramidBoss(ctx, size / 2, isAngry, rotationY);
  } else if (type === 'mega') {
    // Mega boss renders as cube for tutorial (simplified)
    renderCubeBoss(ctx, size / 2, isAngry, rotationX, rotationY, rotationZ);
  } else if (type === 'enemy') {
    renderEnemy(ctx, size, rotationX, rotationY);
  }
  
  ctx.restore();
}

function renderCubeBoss(
  ctx: CanvasRenderingContext2D,
  halfSize: number,
  isAngry: boolean,
  rotationX: number,
  rotationY: number,
  rotationZ: number
): void {
  const baseHue = isAngry ? 0 : 180;
  
  // Define 3D cube vertices
  const vertices = [
    [-halfSize, -halfSize, -halfSize],
    [halfSize, -halfSize, -halfSize],
    [halfSize, halfSize, -halfSize],
    [-halfSize, halfSize, -halfSize],
    [-halfSize, -halfSize, halfSize],
    [halfSize, -halfSize, halfSize],
    [halfSize, halfSize, halfSize],
    [-halfSize, halfSize, halfSize]
  ];
  
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);
  
  const projected = vertices.map(([x, y, z]) => {
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;
    let x2 = x * cosY + z1 * sinY;
    let z2 = -x * sinY + z1 * cosY;
    let x3 = x2 * cosZ - y1 * sinZ;
    let y3 = x2 * sinZ + y1 * cosZ;
    const scale = 300 / (300 + z2);
    return [x3 * scale, y3 * scale, z2];
  });
  
  const faces = [
    { indices: [0, 1, 2, 3], lightness: 40 },
    { indices: [4, 5, 6, 7], lightness: 60 },
    { indices: [0, 3, 7, 4], lightness: 48 },
    { indices: [1, 2, 6, 5], lightness: 52 },
    { indices: [3, 2, 6, 7], lightness: 55 },
    { indices: [0, 1, 5, 4], lightness: 45 }
  ];
  
  const sortedFaces = faces.map(face => {
    const avgZ = face.indices.reduce((sum, i) => sum + projected[i][2], 0) / 4;
    return { ...face, avgZ };
  }).sort((a, b) => a.avgZ - b.avgZ);
  
  sortedFaces.forEach(face => {
    const points = face.indices.map(i => projected[i]);
    
    ctx.fillStyle = `hsl(${baseHue}, 80%, ${face.lightness}%)`;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = `hsl(${baseHue}, 90%, 70%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
  });
}

function renderSphereBoss(
  ctx: CanvasRenderingContext2D,
  radius: number,
  isAngry: boolean
): void {
  const baseHue = 330;
  const intensity = isAngry ? 70 : 60;
  
  // Shape-matched circle shadow (light from top-left)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.arc(5, 5, safeArcRadius(radius), 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
  gradient.addColorStop(0, `hsl(${baseHue}, 100%, ${intensity + 20}%)`);
  gradient.addColorStop(0.7, `hsl(${baseHue}, 90%, ${intensity}%)`);
  gradient.addColorStop(1, `hsl(${baseHue}, 70%, ${intensity - 20}%)`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, safeArcRadius(radius), 0, Math.PI * 2);
  ctx.fill();
}

function renderPyramidBoss(
  ctx: CanvasRenderingContext2D,
  halfSize: number,
  isAngry: boolean,
  rotationY: number
): void {
  const baseHue = isAngry ? 0 : 280;
  const intensity = isAngry ? 65 : 60;
  
  ctx.rotate(rotationY);

  // Shape-matched triangle shadow (light from top-left)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.moveTo(5, -halfSize + 5);
  ctx.lineTo(halfSize + 5, halfSize + 5);
  ctx.lineTo(-halfSize + 5, halfSize + 5);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = `hsl(${baseHue}, 80%, ${intensity}%)`;
  ctx.beginPath();
  ctx.moveTo(0, -halfSize);
  ctx.lineTo(halfSize, halfSize);
  ctx.lineTo(-halfSize, halfSize);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = `hsl(${baseHue}, 70%, ${intensity + 10}%)`;
  ctx.beginPath();
  ctx.moveTo(0, -halfSize);
  ctx.lineTo(0, 0);
  ctx.lineTo(-halfSize, halfSize);
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = `hsl(${baseHue}, 90%, 70%)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -halfSize);
  ctx.lineTo(halfSize, halfSize);
  ctx.lineTo(-halfSize, halfSize);
  ctx.closePath();
  ctx.stroke();
}

function renderEnemy(
  ctx: CanvasRenderingContext2D,
  size: number,
  rotationX: number,
  rotationY: number
): void {
  const baseHue = 30;
  const colorIntensity = 85;
  
  const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ];
  
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  
  const projected = vertices.map(([x, y, z]) => {
    const rx = x;
    const ry = y * cosX - z * sinX;
    const rz = y * sinX + z * cosX;
    const rx2 = rx * cos - rz * sin;
    const rz2 = rx * sin + rz * cos;
    return [rx2 * size / 2, ry * size / 2, rz2];
  });
  
  const faces = [
    { indices: [0, 1, 2, 3], lightness: 40 },
    { indices: [0, 3, 7, 4], lightness: 45 },
    { indices: [1, 5, 6, 2], lightness: 50 },
    { indices: [0, 1, 5, 4], lightness: 45 },
    { indices: [3, 2, 6, 7], lightness: 55 },
    { indices: [4, 5, 6, 7], lightness: 60 }
  ];
  
  const sortedFaces = faces.map(face => ({
    ...face,
    avgZ: face.indices.reduce((sum, i) => sum + projected[i][2], 0) / 4
  })).sort((a, b) => a.avgZ - b.avgZ);
  
  // Shape-matched projected faces shadow (light from top-left)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  sortedFaces.forEach(face => {
    ctx.beginPath();
    ctx.moveTo(projected[face.indices[0]][0] + 4, projected[face.indices[0]][1] + 4);
    face.indices.forEach(i => {
      ctx.lineTo(projected[i][0] + 4, projected[i][1] + 4);
    });
    ctx.closePath();
    ctx.fill();
  });

  sortedFaces.forEach(face => {
    ctx.fillStyle = `hsl(${baseHue}, ${colorIntensity}%, ${face.lightness}%)`;
    ctx.beginPath();
    ctx.moveTo(projected[face.indices[0]][0], projected[face.indices[0]][1]);
    face.indices.forEach(i => {
      ctx.lineTo(projected[i][0], projected[i][1]);
    });
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}
