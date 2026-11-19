'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  RRGSectorData,
  getQuadrantInfo,
} from '@/features/market/utils/rrgCalculator';

export interface RelativeRotationGraphCanvasRef {
  exportImage: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}
export type CanvasHandle = RelativeRotationGraphCanvasRef;

interface RelativeRotationGraphCanvasProps {
  sectors: RRGSectorData[];
  selectedSectorId?: string | null;
  onSelectSector?: (sectorId: string | null) => void;
  showGrid?: boolean;
  benchmark?: string;
  isFullscreen?: boolean;
  height?: number | string;
  isModal?: boolean;
  className?: string;
}

interface TooltipData {
  sector: RRGSectorData;
  x: number;
  y: number;
}

export const RelativeRotationGraphCanvas = forwardRef<
  RelativeRotationGraphCanvasRef,
  RelativeRotationGraphCanvasProps
>(function RelativeRotationGraphCanvas(
  {
    sectors,
    selectedSectorId,
    onSelectSector,
    showGrid = true,
    benchmark = 'VNINDEX',
    isFullscreen = false,
    height,
    className = '',
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredSector, setHoveredSector] = useState<TooltipData | null>(null);

  // Dynamic span around 100 for isotropic 1:1 scaling
  const spanRef = useRef<number>(6.0);
  // Vị trí nhãn tên ngành đã vẽ (toạ độ màn hình) — dùng chung cho vẽ và bắt chuột
  const labelBoxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

  useEffect(() => {
    if (!sectors || sectors.length === 0) return;

    let maxDist = 3.0;
    sectors.forEach((s) => {
      s.points.forEach((p) => {
        const dx = Math.abs(p.rsRatio - 100);
        const dy = Math.abs(p.rsMomentum - 100);
        if (dx > maxDist) maxDist = dx;
        if (dy > maxDist) maxDist = dy;
      });
    });

    // Provide comfortable margin around outermost points
    spanRef.current = Math.max(3.0, Math.min(8.0, Number((maxDist + 0.8).toFixed(1))));
  }, [sectors]);

  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(3.5, Number((z * 1.25).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.6, Number((z / 1.25).toFixed(2))));
  }, []);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `RRG_Market_Watch_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }, []);

  useImperativeHandle(ref, () => ({
    exportImage,
    resetView,
    zoomIn,
    zoomOut,
  }));

  // True Isotropic 1:1 Coordinate Mapping centered strictly at (100, 100)
  const getScale = useCallback(
    (width: number, height: number, currentZoom: number) => {
      const margin = 80;
      const availableSize = Math.max(200, Math.min(width - margin, height - margin));
      return (availableSize / (2 * spanRef.current)) * currentZoom;
    },
    []
  );

  const worldToScreen = useCallback(
    (
      rsRatio: number,
      rsMomentum: number,
      width: number,
      height: number,
      currentZoom: number,
      currentPan: { x: number; y: number }
    ) => {
      const scale = getScale(width, height, currentZoom);
      const centerX = width / 2 + currentPan.x;
      const centerY = height / 2 + currentPan.y;

      const screenX = centerX + (rsRatio - 100) * scale;
      const screenY = centerY - (rsMomentum - 100) * scale; // Invert Y

      return { x: screenX, y: screenY };
    },
    [getScale]
  );

  const screenToWorld = useCallback(
    (
      screenX: number,
      screenY: number,
      width: number,
      height: number,
      currentZoom: number,
      currentPan: { x: number; y: number }
    ) => {
      const scale = getScale(width, height, currentZoom);
      const centerX = width / 2 + currentPan.x;
      const centerY = height / 2 + currentPan.y;

      return {
        rsRatio: 100 + (screenX - centerX) / scale,
        rsMomentum: 100 - (screenY - centerY) / scale,
      };
    },
    [getScale]
  );

  // Active sector tracking (Selected sector takes priority, or hovered sector)
  const activeSectorId = selectedSectorId || hoveredSector?.sector.id || null;

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Deep Obsidian / Dark Navy Canvas Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Center Crosshair (100, 100)
    const centerScreen = worldToScreen(100, 100, width, height, zoom, pan);

    // 2. 4 Quadrant Background Tints
    // Top-Left: CẢI THIỆN (Blue tint)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.fillRect(0, 0, centerScreen.x, centerScreen.y);

    // Top-Right: DẪN DẮT (Emerald tint)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
    ctx.fillRect(centerScreen.x, 0, width - centerScreen.x, centerScreen.y);

    // Bottom-Left: TỤT HẬU (Rose/Red tint)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.04)';
    ctx.fillRect(0, centerScreen.y, centerScreen.x, height - centerScreen.y);

    // Bottom-Right: SUY YẾU (Amber/Yellow tint)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
    ctx.fillRect(
      centerScreen.x,
      centerScreen.y,
      width - centerScreen.x,
      height - centerScreen.y
    );

    // 3. Grid Lines
    const currentSpan = spanRef.current / zoom;
    const step = currentSpan > 6 ? 1 : 0.5;

    const minX = Math.floor((100 - currentSpan) * 2) / 2;
    const maxX = Math.ceil((100 + currentSpan) * 2) / 2;
    const minY = Math.floor((100 - currentSpan) * 2) / 2;
    const maxY = Math.ceil((100 + currentSpan) * 2) / 2;

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      // Vertical Grid lines
      for (let x = minX; x <= maxX + 0.001; x += step) {
        if (Math.abs(x - 100) < 0.001) continue;
        const sPos = worldToScreen(x, 100, width, height, zoom, pan);
        if (sPos.x >= 0 && sPos.x <= width) {
          ctx.beginPath();
          ctx.moveTo(sPos.x, 0);
          ctx.lineTo(sPos.x, height);
          ctx.stroke();
        }
      }

      // Horizontal Grid lines
      for (let y = minY; y <= maxY + 0.001; y += step) {
        if (Math.abs(y - 100) < 0.001) continue;
        const sPos = worldToScreen(100, y, width, height, zoom, pan);
        if (sPos.y >= 0 && sPos.y <= height) {
          ctx.beginPath();
          ctx.moveTo(0, sPos.y);
          ctx.lineTo(width, sPos.y);
          ctx.stroke();
        }
      }
    }

    // 4. Center Crosshair Axis at (100, 100) with dashed lines
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';

    // Vertical line (RS-Ratio = 100)
    ctx.beginPath();
    ctx.moveTo(centerScreen.x, 0);
    ctx.lineTo(centerScreen.x, height);
    ctx.stroke();

    // Horizontal line (RS-Momentum = 100)
    ctx.beginPath();
    ctx.moveTo(0, centerScreen.y);
    ctx.lineTo(width, centerScreen.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Axis Labels (Values along axes formatted like 97.5, 98.0, 98.5 ... 100 ... 102.5)
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';

    const axisBottomY = height - 20;

    // X-Axis tick values along bottom
    ctx.textAlign = 'center';
    for (let x = minX; x <= maxX + 0.001; x += step) {
      const sPos = worldToScreen(x, 100, width, height, zoom, pan);
      if (sPos.x >= 45 && sPos.x <= width - 45) {
        const isCenter = Math.abs(x - 100) < 0.001;
        ctx.fillStyle = isCenter ? '#ffffff' : '#94a3b8';
        ctx.font = isCenter
          ? 'bold 11px "JetBrains Mono", monospace'
          : '11px "JetBrains Mono", monospace';
        const label = isCenter ? '100' : x.toFixed(1);
        ctx.fillText(label, sPos.x, axisBottomY);
      }
    }

    // Y-Axis tick values along left
    ctx.textAlign = 'right';
    for (let y = minY; y <= maxY + 0.001; y += step) {
      const sPos = worldToScreen(100, y, width, height, zoom, pan);
      if (sPos.y >= 30 && sPos.y <= height - 38) {
        const isCenter = Math.abs(y - 100) < 0.001;
        ctx.fillStyle = isCenter ? '#ffffff' : '#94a3b8';
        ctx.font = isCenter
          ? 'bold 11px "JetBrains Mono", monospace'
          : '11px "JetBrains Mono", monospace';
        const label = isCenter ? '100' : y.toFixed(1);
        ctx.fillText(label, 44, sPos.y);
      }
    }

    // Axis Titles (RS-Ratio label placed directly below 100 on the bottom axis)
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('RS-Ratio →', centerScreen.x, height - 10);

    // RS-Momentum label rotated vertically on the left
    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('RS-Momentum —', 0, 0);
    ctx.restore();

    // 6. 4 Quadrant Banners
    ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';

    // CẢI THIỆN (Top-Left)
    ctx.fillStyle = '#38bdf8'; // Sky
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CẢI THIỆN', 54, 18);

    // DẪN DẮT (Top-Right)
    ctx.fillStyle = '#10b981'; // Emerald
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('DẪN DẮT', width - 24, 18);

    // Sub-hint in Top-Right
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(`x${zoom.toFixed(1)} · nhấp đúp để về gốc`, width - 24, 36);

    // Clockwise Cycle Orientation indicator at top center
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('↻ Luân chuyển: Cải thiện ➔ Dẫn dắt ➔ Suy yếu ➔ Tụt hậu', width / 2, 18);

    // TỤT HẬU (Bottom-Left)
    ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';
    ctx.fillStyle = '#ef4444'; // Red
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('TỤT HẬU', 54, height - 38);

    // SUY YẾU (Bottom-Right)
    ctx.fillStyle = '#f59e0b'; // Amber
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SUY YẾU', width - 24, height - 38);

    // 7. Draw Sector Trails & Markers with Smart Z-Index Sorting
    const isAnyActive = Boolean(activeSectorId);

    // Sort so the active ray renders last (highest z-index)
    const sortedSectors = [...sectors].sort((a, b) => {
      if (a.id === activeSectorId) return 1;
      if (b.id === activeSectorId) return -1;
      return 0;
    });

    // 7-pre. Xếp chỗ nhãn tên ngành tránh chồng nhau: thử lần lượt các vị trí quanh điểm đầu,
    // chọn vị trí không đè lên nhãn đã đặt / điểm đầu của ngành khác / mép khung.
    const LABEL_H = 14;
    const headScreens = sectors
      .filter((sec) => sec.points.length > 0)
      .map((sec) => {
        const hp = sec.points[sec.points.length - 1];
        return { id: sec.id, pt: worldToScreen(hp.rsRatio, hp.rsMomentum, width, height, zoom, pan) };
      });
    const placedBoxes: { x: number; y: number; w: number; h: number }[] = [];
    const labelPlacements = new Map<string, { textX: number; textY: number; align: CanvasTextAlign; box: { x: number; y: number; w: number; h: number }; moved: boolean }>();
    const overlapArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const CANDIDATES: [number, number, CanvasTextAlign][] = [
      [9, 0, 'left'], [-9, 0, 'right'], [9, -13, 'left'], [9, 13, 'left'], [-9, -13, 'right'], [-9, 13, 'right'],
      [0, -16, 'center'], [0, 16, 'center'], [9, -26, 'left'], [9, 26, 'left'], [-9, -26, 'right'], [-9, 26, 'right'],
    ];
    const placementOrder = [...headScreens].sort((a, b) => (a.id === activeSectorId ? -1 : b.id === activeSectorId ? 1 : a.pt.y - b.pt.y));
    for (const { id, pt } of placementOrder) {
      const sec = sectors.find((x) => x.id === id);
      if (!sec) continue;
      ctx.font = `${id === activeSectorId ? 'bold 12px' : '600 11px'} "Geist", -apple-system, sans-serif`;
      const w = ctx.measureText(sec.shortName).width;
      let best: { textX: number; textY: number; align: CanvasTextAlign; box: { x: number; y: number; w: number; h: number }; score: number; moved: boolean } | null = null;
      for (const [dx, dy, align] of CANDIDATES) {
        const textX = pt.x + dx;
        const textY = pt.y + dy;
        const left = align === 'left' ? textX : align === 'right' ? textX - w : textX - w / 2;
        const box = { x: left - 2, y: textY - LABEL_H / 2, w: w + 4, h: LABEL_H };
        let score = 0;
        for (const b of placedBoxes) score += overlapArea(box, b);
        for (const h of headScreens) if (h.id !== id) score += overlapArea(box, { x: h.pt.x - 6, y: h.pt.y - 6, w: 12, h: 12 });
        if (box.x < 50 || box.x + box.w > width - 4 || box.y < 4 || box.y + box.h > height - 30) score += 10_000;
        if (!best || score < best.score) best = { textX, textY, align, box, score, moved: Math.abs(dy) > 13 };
        if (score === 0) break;
      }
      if (best) {
        placedBoxes.push(best.box);
        labelPlacements.set(id, best);
      }
    }
    labelBoxesRef.current = new Map([...labelPlacements].map(([id, p]) => [id, p.box]));

    sortedSectors.forEach((sec) => {
      const isCurrentActive = activeSectorId === sec.id;
      // Dim inactive rays down to 0.12 so the focused ray is unmistakably clear
      const opacity = isAnyActive ? (isCurrentActive ? 1.0 : 0.12) : 1.0;

      const screenPoints = sec.points.map((p) =>
        worldToScreen(p.rsRatio, p.rsMomentum, width, height, zoom, pan)
      );

      if (screenPoints.length === 0) return;

      const qInfo = getQuadrantInfo(sec.quadrant);
      const trailColor = qInfo.color;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Glow effect for active ray
      if (isCurrentActive) {
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = 12;
      }

      // 7a. Clean Straight Line Segments for Trail (Standard JdK RRG)
      // Connects consecutive sessions directly: p[0] -> p[1] -> ... -> p[n]
      if (screenPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = isCurrentActive ? 3.0 : 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        ctx.stroke();
      }

      // Reset shadow blur before dots & pills
      ctx.shadowBlur = 0;

      // 7b. Past Historical Dots (Firmly sitting on the trail vertices)
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const pt = screenPoints[i];
        const progress = (i + 1) / screenPoints.length;
        const dotRadius = isCurrentActive ? 3.0 + progress * 1.5 : 2.0 + progress * 1.2;
        const dotAlpha = 0.35 + progress * 0.45;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = trailColor;
        ctx.globalAlpha = opacity * dotAlpha;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 7c. Head Marker (Current Point)
      const headPt = screenPoints[screenPoints.length - 1];
      ctx.globalAlpha = opacity;

      // Glowing outer ring if active
      if (isCurrentActive) {
        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = `${trailColor}33`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Directional arrowhead at the tip showing heading vector
      if (screenPoints.length >= 2) {
        const prevPt = screenPoints[screenPoints.length - 2];
        const dx = headPt.x - prevPt.x;
        const dy = headPt.y - prevPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1.0) {
          const angle = Math.atan2(dy, dx);
          const arrowLen = isCurrentActive ? 9.5 : 6.5;
          const arrowAngle = Math.PI / 6;

          ctx.beginPath();
          ctx.moveTo(
            headPt.x + Math.cos(angle) * (isCurrentActive ? 4.5 : 2.5),
            headPt.y + Math.sin(angle) * (isCurrentActive ? 4.5 : 2.5)
          );
          ctx.lineTo(
            headPt.x - arrowLen * Math.cos(angle - arrowAngle),
            headPt.y - arrowLen * Math.sin(angle - arrowAngle)
          );
          ctx.lineTo(
            headPt.x - arrowLen * 0.5 * Math.cos(angle),
            headPt.y - arrowLen * 0.5 * Math.sin(angle)
          );
          ctx.lineTo(
            headPt.x - arrowLen * Math.cos(angle + arrowAngle),
            headPt.y - arrowLen * Math.sin(angle + arrowAngle)
          );
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = trailColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Main Head Dot (Distinct circle with quadrant ring & center)
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, isCurrentActive ? 6.0 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isCurrentActive ? '#ffffff' : '#090d16';
      ctx.fill();
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = isCurrentActive ? 2.5 : 2.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, isCurrentActive ? 3.0 : 2.0, 0, Math.PI * 2);
      ctx.fillStyle = trailColor;
      ctx.fill();

      // 7d. Nhãn tên ngành tại vị trí đã xếp (tránh chồng nhau); nếu phải dời xa thì có đường dẫn mảnh
      const labelText = sec.shortName;
      ctx.font = `${isCurrentActive ? 'bold 12px' : '600 11px'} "Geist", -apple-system, sans-serif`;
      const place = labelPlacements.get(sec.id);
      const textX = place ? place.textX : headPt.x + 8;
      const textY = place ? place.textY : headPt.y;
      ctx.textAlign = place ? place.align : 'left';
      ctx.textBaseline = 'middle';

      if (place?.moved) {
        ctx.beginPath();
        ctx.strokeStyle = trailColor;
        ctx.globalAlpha = opacity * 0.45;
        ctx.lineWidth = 0.8;
        ctx.moveTo(headPt.x, headPt.y);
        ctx.lineTo(textX, textY + (textY > headPt.y ? -LABEL_H / 2 : LABEL_H / 2));
        ctx.stroke();
        ctx.globalAlpha = opacity;
      }

      // Subtle shadow for legibility over grid lines
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillStyle = isCurrentActive ? '#ffffff' : trailColor;
      ctx.fillText(labelText, textX, textY);
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    ctx.restore();
  }, [sectors, showGrid, zoom, pan, activeSectorId, worldToScreen]);

  // Helper: Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
  const distToSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number => {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  // Find sector near mouse (checks Head Dot, Pill Box, and Trail Segments)
  const findSectorAtPosition = useCallback(
    (
      mouseX: number,
      mouseY: number,
      width: number,
      height: number
    ): RRGSectorData | null => {
      // 1. First check Head Dot (< 26px) & Pill Box
      for (const sec of sectors) {
        const headPoint = sec.points[sec.points.length - 1];
        if (!headPoint) continue;

        const sPos = worldToScreen(
          headPoint.rsRatio,
          headPoint.rsMomentum,
          width,
          height,
          zoom,
          pan
        );

        // Head dot radius hit-test
        const distHead = Math.hypot(mouseX - sPos.x, mouseY - sPos.y);
        if (distHead < 26) return sec;

        // Bắt chuột trên nhãn tên ngành (đúng vị trí đã vẽ)
        const box = labelBoxesRef.current.get(sec.id);
        if (box && mouseX >= box.x - 3 && mouseX <= box.x + box.w + 3 && mouseY >= box.y - 3 && mouseY <= box.y + box.h + 3) {
          return sec;
        }
      }

      // 2. Second check along Trail Curve segments (< 12px)
      for (const sec of sectors) {
        const screenPoints = sec.points.map((p) =>
          worldToScreen(p.rsRatio, p.rsMomentum, width, height, zoom, pan)
        );

        for (let i = 0; i < screenPoints.length - 1; i++) {
          const p1 = screenPoints[i];
          const p2 = screenPoints[i + 1];
          const d = distToSegment(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y);
          if (d < 12) return sec;
        }
      }

      return null;
    },
    [sectors, worldToScreen, zoom, pan]
  );

  // Mouse & Touch Handlers
  const dragDistanceRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragDistanceRef.current = 0;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragDistanceRef.current += Math.hypot(dx, dy);
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const matchedSector = findSectorAtPosition(mouseX, mouseY, rect.width, rect.height);

    if (matchedSector) {
      setHoveredSector({
        sector: matchedSector,
        x: mouseX,
        y: mouseY,
      });
    } else {
      setHoveredSector(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If dragged more than 6px, it was a pan operation, not a click
    if (dragDistanceRef.current > 6) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const matchedSector = findSectorAtPosition(mouseX, mouseY, rect.width, rect.height);

    if (matchedSector) {
      // Toggle selection: click same sector to deselect, or select new sector
      if (selectedSectorId === matchedSector.id) {
        onSelectSector?.(null);
      } else {
        onSelectSector?.(matchedSector.id);
      }
    } else {
      // Click on empty space: clear selection and restore all rays
      onSelectSector?.(null);
    }
  };

  const handleDoubleClick = () => {
    resetView();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3.5, Math.max(0.6, Number((z * zoomDelta).toFixed(2)))));
  };

  // Currently focused sector for the Inspector Card
  const focusedSector = sectors.find((s) => s.id === selectedSectorId) || null;
  const focusedQInfo = focusedSector ? getQuadrantInfo(focusedSector.quadrant) : null;

  return (
    <div
      style={height ? { height } : undefined}
      className={`relative w-full h-full select-none overflow-hidden bg-[#090d16] rounded-xl border border-white/5 ${className}`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      />

      {/* Pinned Stage Inspector HUD (When a ray is clicked/focused) */}
      {focusedSector && focusedQInfo && (
        <div className="absolute top-4 left-4 z-30 animate-fadeIn max-w-[340px] pointer-events-auto">
          <div className="bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-xl p-3.5 shadow-2xl shadow-black/90">
            {/* Header: Name + Quadrant Badge + Close button */}
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full ring-2 ring-white/30 shrink-0"
                  style={{ backgroundColor: focusedQInfo.color }}
                />
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    {focusedSector.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {focusedSector.shortName} · Chuẩn đối chiếu {benchmark}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase font-mono shadow-sm"
                  style={{
                    color: focusedQInfo.color,
                    backgroundColor: focusedQInfo.bgColor,
                    border: `1px solid ${focusedQInfo.borderColor}`,
                  }}
                >
                  {focusedQInfo.name}
                </span>
                <button
                  onClick={() => onSelectSector?.(null)}
                  title="Hiện lại tất cả tia (Bỏ chọn)"
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Stage Description & Strategy Note */}
            <div
              className="p-2 rounded-lg text-[11px] leading-relaxed mb-2.5 font-sans"
              style={{
                backgroundColor: focusedQInfo.bgColor,
                border: `1px solid ${focusedQInfo.borderColor}`,
                color: '#e2e8f0',
              }}
            >
              <div className="font-semibold text-[10px] uppercase tracking-wider mb-0.5" style={{ color: focusedQInfo.color }}>
                Đặc điểm giai đoạn {focusedQInfo.name}:
              </div>
              {focusedQInfo.description}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="text-slate-400 block text-[10px]">JdK RS-Ratio</span>
                <span className="text-white font-bold text-xs">
                  {focusedSector.currentPoint.rsRatio.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {focusedSector.currentPoint.rsRatio >= 100 ? 'Mạnh hơn VNINDEX' : 'Yếu hơn VNINDEX'}
                </span>
              </div>

              <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="text-slate-400 block text-[10px]">JdK RS-Momentum</span>
                <span className="text-white font-bold text-xs">
                  {focusedSector.currentPoint.rsMomentum.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {focusedSector.currentPoint.rsMomentum >= 100 ? 'Đà tăng gia tốc' : 'Đà tăng giảm tốc'}
                </span>
              </div>

              <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Vận tốc luân chuyển</span>
                <span className="text-slate-200 font-bold text-xs">
                  {focusedSector.velocity.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  Góc hướng: {focusedSector.angle}°
                </span>
              </div>

              <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Biến động giá phiên</span>
                <span
                  className={`font-bold text-xs ${
                    focusedSector.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {focusedSector.changePercent >= 0 ? '+' : ''}
                  {focusedSector.changePercent.toFixed(2)}%
                </span>
                <span className="text-[9px] text-slate-500 block">
                  Khoảng cách tâm: {focusedSector.distanceFromCenter.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Reset focus CTA */}
            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
              <span>Đang làm mờ các tia khác</span>
              <button
                onClick={() => onSelectSector?.(null)}
                className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 transition-colors"
              >
                Hiện lại tất cả tia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover Tooltip (When hovering without selecting that sector) */}
      {hoveredSector && hoveredSector.sector.id !== selectedSectorId && (
        <div
          className="pointer-events-none absolute z-20 transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${hoveredSector.x}px`,
            top: `${hoveredSector.y}px`,
          }}
        >
          <div className="bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl shadow-black/80 min-w-[210px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: hoveredSector.sector.color }}
                />
                <span className="text-xs font-semibold text-white">
                  {hoveredSector.sector.name}
                </span>
              </div>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase"
                style={{
                  color: getQuadrantInfo(hoveredSector.sector.quadrant).color,
                  backgroundColor: getQuadrantInfo(hoveredSector.sector.quadrant).bgColor,
                }}
              >
                {getQuadrantInfo(hoveredSector.sector.quadrant).name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">RS-Ratio</span>
                <span className="text-white font-medium">
                  {hoveredSector.sector.currentPoint.rsRatio.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">RS-Momentum</span>
                <span className="text-white font-medium">
                  {hoveredSector.sector.currentPoint.rsMomentum.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Vận tốc</span>
                <span className="text-slate-300 font-medium">
                  {hoveredSector.sector.velocity.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Biến động</span>
                <span
                  className={`font-medium ${
                    hoveredSector.sector.changePercent >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hoveredSector.sector.changePercent >= 0 ? '+' : ''}
                  {hoveredSector.sector.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/5 text-[9px] text-emerald-400 flex items-center justify-between">
              <span>Bấm vào để xem rõ giai đoạn</span>
              <span>Làm mờ tia khác</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
