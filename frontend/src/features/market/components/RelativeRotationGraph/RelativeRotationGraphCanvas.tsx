'use client';

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { RRGSectorData, RRGPoint, getQuadrantInfo } from '../../utils/rrgCalculator';

export interface CanvasHandle {
  exportImage: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface RelativeRotationGraphCanvasProps {
  sectors: RRGSectorData[];
  showGrid: boolean;
  selectedSectorId?: string | null;
  onSelectSector?: (sectorId: string | null) => void;
  height?: number | string;
  isModal?: boolean;
}

interface TooltipData {
  sector: RRGSectorData;
  x: number;
  y: number;
}

export const RelativeRotationGraphCanvas = forwardRef<CanvasHandle, RelativeRotationGraphCanvasProps>(
  (
    {
      sectors,
      showGrid,
      selectedSectorId,
      onSelectSector,
      height = 680,
      isModal = false,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Viewport transform state: pan offset and zoom scale
    const [zoom, setZoom] = useState<number>(1.0);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const [hoveredSector, setHoveredSector] = useState<TooltipData | null>(null);

    // Coordinate domain bounds (Default centered at 100, 100)
    const boundsRef = useRef({
      minX: 96.5,
      maxX: 104.5,
      minY: 96.0,
      maxY: 104.5,
    });

    // Compute automatic bounds from sector points
    useEffect(() => {
      if (!sectors || sectors.length === 0) return;

      let minX = 98.0;
      let maxX = 102.5;
      let minY = 98.0;
      let maxY = 102.5;

      sectors.forEach((s) => {
        s.points.forEach((p) => {
          if (p.rsRatio < minX) minX = p.rsRatio;
          if (p.rsRatio > maxX) maxX = p.rsRatio;
          if (p.rsMomentum < minY) minY = p.rsMomentum;
          if (p.rsMomentum > maxY) maxY = p.rsMomentum;
        });
      });

      // Equal isotropic span around center 100 for proper RRG aspect ratio
      const rawSpan = Math.max(
        Math.abs(100 - minX),
        Math.abs(maxX - 100),
        Math.abs(100 - minY),
        Math.abs(maxY - 100)
      );
      const span = Math.max(rawSpan + 0.8, 3.0);

      boundsRef.current = {
        minX: Number((100 - span).toFixed(1)),
        maxX: Number((100 + span).toFixed(1)),
        minY: Number((100 - span).toFixed(1)),
        maxY: Number((100 + span).toFixed(1)),
      };
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

    // Convert World (RS-Ratio, RS-Momentum) to Screen (Canvas Pixels)
    const worldToScreen = useCallback(
      (
        rsRatio: number,
        rsMomentum: number,
        width: number,
        height: number,
        currentZoom: number,
        currentPan: { x: number; y: number }
      ) => {
        const paddingLeft = 56;
        const paddingRight = 40;
        const paddingTop = 44;
        const paddingBottom = 48;

        const plotW = width - paddingLeft - paddingRight;
        const plotH = height - paddingTop - paddingBottom;

        const { minX, maxX, minY, maxY } = boundsRef.current;

        // Base normalized [0, 1]
        const normX = (rsRatio - minX) / (maxX - minX);
        const normY = (rsMomentum - minY) / (maxY - minY);

        const baseX = paddingLeft + normX * plotW;
        const baseY = height - paddingBottom - normY * plotH;

        // Apply Zoom around center and Pan offset
        const centerX = width / 2;
        const centerY = height / 2;

        const screenX = centerX + (baseX - centerX) * currentZoom + currentPan.x;
        const screenY = centerY + (baseY - centerY) * currentZoom + currentPan.y;

        return { x: screenX, y: screenY };
      },
      []
    );

    // Convert Screen to World coordinates
    const screenToWorld = useCallback(
      (
        screenX: number,
        screenY: number,
        width: number,
        height: number,
        currentZoom: number,
        currentPan: { x: number; y: number }
      ) => {
        const paddingLeft = 56;
        const paddingRight = 40;
        const paddingTop = 44;
        const paddingBottom = 48;

        const plotW = width - paddingLeft - paddingRight;
        const plotH = height - paddingTop - paddingBottom;

        const centerX = width / 2;
        const centerY = height / 2;

        const baseX = (screenX - currentPan.x - centerX) / currentZoom + centerX;
        const baseY = (screenY - currentPan.y - centerY) / currentZoom + centerY;

        const { minX, maxX, minY, maxY } = boundsRef.current;

        const normX = (baseX - paddingLeft) / plotW;
        const normY = (height - paddingBottom - baseY) / plotH;

        return {
          rsRatio: minX + normX * (maxX - minX),
          rsMomentum: minY + normY * (maxY - minY),
        };
      },
      []
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

      // Set physical canvas resolution for Retina screens
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Draw Deep Obsidian / Dark Navy Canvas Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Calculate Center (100, 100) position
      const centerScreen = worldToScreen(100, 100, width, height, zoom, pan);

      // 2. Draw 4 Quadrant Background Tints (Matching user's reference image)
      // Top-Left: CẢI THIỆN (Blue tint)
      ctx.fillStyle = 'rgba(59, 130, 246, 0.04)';
      ctx.fillRect(0, 0, centerScreen.x, centerScreen.y);

      // Top-Right: DẪN DẮT (Emerald tint)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.fillRect(centerScreen.x, 0, width - centerScreen.x, centerScreen.y);

      // Bottom-Left: TỤT HẬU (Rose/Red tint)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
      ctx.fillRect(0, centerScreen.y, centerScreen.x, height - centerScreen.y);

      // Bottom-Right: SUY YẾU (Amber/Yellow tint)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
      ctx.fillRect(centerScreen.x, centerScreen.y, width - centerScreen.x, height - centerScreen.y);

      // 3. Draw Grid Lines (if enabled)
      const { minX, maxX, minY, maxY } = boundsRef.current;
      const stepX = 1.0;
      const stepY = 1.0;

      const firstX = Math.floor(minX);
      const lastX = Math.ceil(maxX);
      const firstY = Math.floor(minY);
      const lastY = Math.ceil(maxY);

      if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        // Vertical Grid lines
        for (let x = firstX; x <= lastX; x += stepX) {
          if (x === 100) continue; // center axis handled separately
          const sPos = worldToScreen(x, 100, width, height, zoom, pan);
          if (sPos.x >= 0 && sPos.x <= width) {
            ctx.beginPath();
            ctx.moveTo(sPos.x, 0);
            ctx.lineTo(sPos.x, height);
            ctx.stroke();
          }
        }

        // Horizontal Grid lines
        for (let y = firstY; y <= lastY; y += stepY) {
          if (y === 100) continue;
          const sPos = worldToScreen(100, y, width, height, zoom, pan);
          if (sPos.y >= 0 && sPos.y <= height) {
            ctx.beginPath();
            ctx.moveTo(0, sPos.y);
            ctx.lineTo(width, sPos.y);
            ctx.stroke();
          }
        }
      }

      // 4. Draw Center Crosshair Axis at (100, 100) with dashed line
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';

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

      // 5. Draw Axis Ticks & Labels
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // X-Axis labels along bottom
      for (let x = firstX; x <= lastX; x += stepX) {
        const sPos = worldToScreen(x, 100, width, height, zoom, pan);
        if (sPos.x >= 40 && sPos.x <= width - 40) {
          const isCenter = x === 100;
          ctx.fillStyle = isCenter ? '#f8fafc' : '#64748b';
          ctx.fillText(`${x}`, sPos.x, height - 24);
        }
      }

      // Y-Axis labels along left
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = firstY; y <= lastY; y += stepY) {
        const sPos = worldToScreen(100, y, width, height, zoom, pan);
        if (sPos.y >= 30 && sPos.y <= height - 35) {
          const isCenter = y === 100;
          ctx.fillStyle = isCenter ? '#f8fafc' : '#64748b';
          ctx.fillText(`${y}`, 38, sPos.y);
        }
      }

      // Axis Titles
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('RS-Ratio →', width / 2, height - 12);

      ctx.save();
      ctx.translate(14, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('RS-Momentum ↑', 0, 0);
      ctx.restore();

      // 6. Draw 4 Quadrant Name Banners (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
      ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';

      // CẢI THIỆN (Top-Left)
      ctx.fillStyle = '#38bdf8'; // Sky
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('CẢI THIỆN', 48, 20);

      // DẪN DẮT (Top-Right)
      ctx.fillStyle = '#34d399'; // Emerald
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('DẪN DẮT', width - 24, 20);

      // Sub-hint in Top-Right
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`x${zoom.toFixed(1)} · nhấp đúp để về khung gốc`, width - 24, 38);

      // TỤT HẬU (Bottom-Left)
      ctx.font = 'bold 13px "Geist", -apple-system, sans-serif';
      ctx.fillStyle = '#f43f5e'; // Rose
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('TỤT HẬU', 48, height - 34);

      // SUY YẾU (Bottom-Right)
      ctx.fillStyle = '#fbbf24'; // Amber
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SUY YẾU', width - 24, height - 34);

      // 7. Draw Sector Trails & Dots
      const isAnyHovered = hoveredSector !== null;
      const activeSectorId = hoveredSector?.sector.id || selectedSectorId;

      sectors.forEach((sec) => {
        const isCurrentActive = activeSectorId === sec.id;
        const opacity = isAnyHovered && !isCurrentActive ? 0.22 : 1.0;

        const screenPoints = sec.points.map((p) =>
          worldToScreen(p.rsRatio, p.rsMomentum, width, height, zoom, pan)
        );

        if (screenPoints.length === 0) return;

        // Choose line color based on head quadrant
        const qInfo = getQuadrantInfo(sec.quadrant);
        const trailColor = qInfo.color;

        ctx.save();
        ctx.globalAlpha = opacity;

        // 7a. Draw Smooth Curve Connecting Tail Points
        if (screenPoints.length >= 2) {
          ctx.beginPath();
          ctx.strokeStyle = trailColor;
          ctx.lineWidth = isCurrentActive ? 2.5 : 1.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.moveTo(screenPoints[0].x, screenPoints[0].y);

          // Smooth quadratic curve interpolation through midpoints
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

        // 7b. Draw Past Tail Dots (Smaller, fading opacity)
        for (let i = 0; i < screenPoints.length - 1; i++) {
          const pt = screenPoints[i];
          const dotRatio = (i + 1) / screenPoints.length; // 0.25, 0.5, 0.75...
          const dotAlpha = 0.3 + dotRatio * 0.45;

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = trailColor;
          ctx.globalAlpha = opacity * dotAlpha;
          ctx.fill();
        }

        // 7c. Draw Head Marker (Current Point)
        const headPt = screenPoints[screenPoints.length - 1];
        ctx.globalAlpha = opacity;

        // Outer glow on active
        if (isCurrentActive) {
          ctx.beginPath();
          ctx.arc(headPt.x, headPt.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = `${trailColor}33`; // 20% alpha
          ctx.fill();
        }

        // Dot fill & stroke
        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, isCurrentActive ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = trailColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // 7d. Draw Sector Label next to Head Point
        ctx.font = `${isCurrentActive ? 'bold 12px' : '11px'} "Geist", -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Subtle dark shadow behind text for maximum contrast
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        const labelText = sec.name;
        const textMetrics = ctx.measureText(labelText);
        ctx.fillRect(headPt.x + 8, headPt.y - 8, textMetrics.width + 4, 16);

        // Text color matches theme
        ctx.fillStyle = isCurrentActive ? '#ffffff' : trailColor;
        ctx.fillText(labelText, headPt.x + 10, headPt.y);

        ctx.restore();
      });

      ctx.restore();
    }, [sectors, showGrid, zoom, pan, hoveredSector, selectedSectorId, worldToScreen]);

    // Mouse & Touch Event Handlers for Pan / Zoom / Hover
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Only left click
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
      let minDistance = 24; // 24px radius threshold

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

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((z) => {
        const nextZoom = z * zoomFactor;
        return Math.max(0.5, Math.min(4.0, Number(nextZoom.toFixed(2))));
      });
    };

    const handleDoubleClick = () => {
      resetView();
    };

    const handleClick = () => {
      if (hoveredSector) {
        onSelectSector?.(hoveredSector.sector.id);
      } else {
        onSelectSector?.(null);
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden select-none"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoveredSector(null);
          }}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onClick={handleClick}
          className={`w-full h-full block ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />

        {/* Floating Tooltip when hovering over a sector */}
        {hoveredSector && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: hoveredSector.x,
              top: hoveredSector.y,
            }}
          >
            <div className="p-3 rounded-xl bg-zinc-950/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl text-xs font-mono min-w-[220px]">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                <span className="font-bold text-sm text-zinc-100">
                  {hoveredSector.sector.name}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: getQuadrantInfo(hoveredSector.sector.quadrant).bgColor,
                    color: getQuadrantInfo(hoveredSector.sector.quadrant).color,
                    border: `1px solid ${getQuadrantInfo(hoveredSector.sector.quadrant).borderColor}`,
                  }}
                >
                  {getQuadrantInfo(hoveredSector.sector.quadrant).name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5">
                <div>
                  <span className="text-[10px] text-zinc-400 block">RS-Ratio (X)</span>
                  <span className="font-bold text-zinc-200">
                    {hoveredSector.sector.currentPoint.rsRatio.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">RS-Momentum (Y)</span>
                  <span className="font-bold text-zinc-200">
                    {hoveredSector.sector.currentPoint.rsMomentum.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Vận tốc quay</span>
                  <span className="font-bold text-emerald-400">
                    {hoveredSector.sector.velocity.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">% Phiên gần nhất</span>
                  <span
                    className={`font-bold ${
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

              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Cổ phiếu:</span>
                <span className="text-zinc-300 font-bold">
                  {hoveredSector.sector.symbols.join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

RelativeRotationGraphCanvas.displayName = 'RelativeRotationGraphCanvas';
