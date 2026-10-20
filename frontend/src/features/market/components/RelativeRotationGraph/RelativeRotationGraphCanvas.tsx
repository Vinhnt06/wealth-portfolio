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

    // Provide comfortable margin around outermost points (at least 5.5 units)
    spanRef.current = Math.max(5.5, Number((maxDist + 1.2).toFixed(1)));
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

    // 2. 4 Quadrant Background Tints (Matching user reference image)
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
    const step = currentSpan > 8 ? 2 : currentSpan > 3 ? 1 : 0.5;

    const minX = Math.floor(100 - currentSpan);
    const maxX = Math.ceil(100 + currentSpan);
    const minY = Math.floor(100 - currentSpan);
    const maxY = Math.ceil(100 + currentSpan);

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      // Vertical Grid lines
      for (let x = minX; x <= maxX; x += step) {
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
      for (let y = minY; y <= maxY; y += step) {
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

    // 5. Axis Labels (Values along axes)
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X-Axis tick values along bottom
    for (let x = minX; x <= maxX; x += step) {
      const sPos = worldToScreen(x, 100, width, height, zoom, pan);
      if (sPos.x >= 35 && sPos.x <= width - 35) {
        const isCenter = Math.abs(x - 100) < 0.001;
        ctx.fillStyle = isCenter ? '#ffffff' : '#64748b';
        ctx.fillText(`${x}`, sPos.x, height - 24);
      }
    }

    // Y-Axis tick values along left
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = minY; y <= maxY; y += step) {
      const sPos = worldToScreen(100, y, width, height, zoom, pan);
      if (sPos.y >= 30 && sPos.y <= height - 35) {
        const isCenter = Math.abs(y - 100) < 0.001;
        ctx.fillStyle = isCenter ? '#ffffff' : '#64748b';
        ctx.fillText(`${y}`, 36, sPos.y);
      }
    }

    // Axis Titles
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('RS-Ratio →', width / 2, height - 10);

    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('RS-Momentum ↑', 0, 0);
    ctx.restore();

    // 6. 4 Quadrant Banners
    ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';

    // CẢI THIỆN (Top-Left)
    ctx.fillStyle = '#38bdf8'; // Sky
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CẢI THIỆN', 48, 18);

    // DẪN DẮT (Top-Right)
    ctx.fillStyle = '#10b981'; // Emerald
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('DẪN DẮT', width - 24, 18);

    // Sub-hint in Top-Right
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(`x${zoom.toFixed(1)} · nhấp đúp để về gốc`, width - 24, 36);

    // TỤT HẬU (Bottom-Left)
    ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';
    ctx.fillStyle = '#f43f5e'; // Rose
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('TỤT HẬU', 48, height - 32);

    // SUY YẾU (Bottom-Right)
    ctx.fillStyle = '#f59e0b'; // Amber
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SUY YẾU', width - 24, height - 32);

    // 7. Draw Sector Trails & Markers
    const isAnyHovered = hoveredSector !== null;
    const activeSectorId = hoveredSector?.sector.id || selectedSectorId;

    sectors.forEach((sec) => {
      const isCurrentActive = activeSectorId === sec.id;
      const opacity = isAnyHovered && !isCurrentActive ? 0.2 : 1.0;

      const screenPoints = sec.points.map((p) =>
        worldToScreen(p.rsRatio, p.rsMomentum, width, height, zoom, pan)
      );

      if (screenPoints.length === 0) return;

      const qInfo = getQuadrantInfo(sec.quadrant);
      const trailColor = qInfo.color;

      ctx.save();
      ctx.globalAlpha = opacity;

      // 7a. Smooth Quadratic Curve for Trail
      if (screenPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = isCurrentActive ? 2.6 : 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 0; i < screenPoints.length - 1; i++) {
          const current = screenPoints[i];
          const next = screenPoints[i + 1];
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
        const lastPt = screenPoints[screenPoints.length - 1];
        ctx.lineTo(lastPt.x, lastPt.y);
        ctx.stroke();
      }

      // 7b. Past Historical Dots (Fade in toward head)
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const pt = screenPoints[i];
        const progress = (i + 1) / screenPoints.length;
        const dotRadius = 2.0 + progress * 1.5;
        const dotAlpha = 0.35 + progress * 0.45;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = trailColor;
        ctx.globalAlpha = opacity * dotAlpha;
        ctx.fill();
      }

      // 7c. Head Marker (Current Point)
      const headPt = screenPoints[screenPoints.length - 1];
      ctx.globalAlpha = opacity;

      // Glowing outer ring if active or leading
      if (isCurrentActive) {
        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = `${trailColor}33`;
        ctx.fill();
      }

      // Main Dot
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, isCurrentActive ? 6.0 : 4.8, 0, Math.PI * 2);
      ctx.fillStyle = trailColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 7d. Smart Label with Pill Tag (Anti-Collision & Edge-Aware)
      const labelText = sec.shortName;
      ctx.font = `${isCurrentActive ? 'bold 12px' : '11px'} "Geist", -apple-system, sans-serif`;
      const textWidth = ctx.measureText(labelText).width;
      const pillWidth = textWidth + 10;
      const pillHeight = 18;

      // Smart flip if near right or left border
      const placeLeft = headPt.x > width - 110;
      const pillX = placeLeft ? headPt.x - pillWidth - 8 : headPt.x + 8;
      const pillY = headPt.y - pillHeight / 2;

      // Pill Background Box
      ctx.fillStyle = isCurrentActive
        ? 'rgba(15, 23, 42, 0.95)'
        : 'rgba(9, 13, 22, 0.88)';
      ctx.strokeStyle = isCurrentActive ? trailColor : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;

      // Rounded rectangle for pill
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(pillX + r, pillY);
      ctx.lineTo(pillX + pillWidth - r, pillY);
      ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + r);
      ctx.lineTo(pillX + pillWidth, pillY + pillHeight - r);
      ctx.quadraticCurveTo(
        pillX + pillWidth,
        pillY + pillHeight,
        pillX + pillWidth - r,
        pillY + pillHeight
      );
      ctx.lineTo(pillX + r, pillY + pillHeight);
      ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - r);
      ctx.lineTo(pillX, pillY + r);
      ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pill Label Text
      ctx.fillStyle = isCurrentActive ? '#ffffff' : trailColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pillX + 5, headPt.y);

      ctx.restore();
    });

    ctx.restore();
  }, [sectors, showGrid, zoom, pan, hoveredSector, selectedSectorId, worldToScreen]);

  // Mouse & Touch Handlers for Dragging, Hovering & Zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
      return;
    }

    // Hit-testing for Hover Tooltip
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestSector: RRGSectorData | null = null;
    let minDistance = 24; // 24px radius

    sectors.forEach((sec) => {
      const headPoint = sec.points[sec.points.length - 1];
      if (!headPoint) return;

      const sPos = worldToScreen(
        headPoint.rsRatio,
        headPoint.rsMomentum,
        rect.width,
        rect.height,
        zoom,
        pan
      );

      const dist = Math.hypot(mouseX - sPos.x, mouseY - sPos.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestSector = sec;
      }
    });

    if (closestSector) {
      setHoveredSector({
        sector: closestSector,
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

  const handleClick = () => {
    if (hoveredSector) {
      if (selectedSectorId === hoveredSector.sector.id) {
        onSelectSector?.(null);
      } else {
        onSelectSector?.(hoveredSector.sector.id);
      }
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

      {/* Floating Hover Tooltip */}
      {hoveredSector && (
        <div
          className="pointer-events-none absolute z-30 transform -translate-x-1/2 -translate-y-full mb-3"
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
                  backgroundColor: getQuadrantInfo(hoveredSector.sector.quadrant)
                    .bgColor,
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
                <span className="text-slate-500 block text-[10px]">Vận tốc (V)</span>
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

            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-400 flex flex-wrap gap-1">
              <span className="text-slate-500">Mã trụ:</span>
              {hoveredSector.sector.symbols.slice(0, 5).join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
