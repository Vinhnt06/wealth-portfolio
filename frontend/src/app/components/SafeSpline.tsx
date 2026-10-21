'use client';

import React, { forwardRef, useEffect, useRef, useState, useImperativeHandle } from 'react';
import type { Application, SplineEvent, SplineEventName } from '@splinetool/runtime';

export interface SafeSplineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onLoad'> {
  scene: string;
  onLoad?: (app: Application) => void;
  onSplineMouseDown?: (e: SplineEvent) => void;
  onSplineMouseUp?: (e: SplineEvent) => void;
  onSplineMouseHover?: (e: SplineEvent) => void;
  onSplineKeyDown?: (e: SplineEvent) => void;
  onSplineKeyUp?: (e: SplineEvent) => void;
  onSplineStart?: (e: SplineEvent) => void;
  onSplineLookAt?: (e: SplineEvent) => void;
  onSplineFollow?: (e: SplineEvent) => void;
  onSplineScroll?: (e: SplineEvent) => void;
  renderOnDemand?: boolean;
  wasmPath?: string;
  loadingLabel?: string;
}

export const SafeSpline = forwardRef<HTMLDivElement, SafeSplineProps>(function SafeSpline(
  {
    scene,
    onLoad,
    onSplineMouseDown,
    onSplineMouseUp,
    onSplineMouseHover,
    onSplineKeyDown,
    onSplineKeyUp,
    onSplineStart,
    onSplineLookAt,
    onSplineFollow,
    onSplineScroll,
    renderOnDemand = true,
    wasmPath,
    loadingLabel = 'Loading 3D Engine...',
    className,
    style,
    ...rest
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);

  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let appInstance: Application | null = null;

    setIsLoading(true);
    setHasError(false);

    async function initSpline() {
      if (!canvasRef.current) return;

      try {
        // Dynamically import @splinetool/runtime on client only to support Next.js SSR / Turbopack
        const { Application } = await import('@splinetool/runtime');
        if (!isMounted || !canvasRef.current) return;

        // CRITICAL FIX: Force renderer: 'webgl'
        // Prevents THREE.WebGPURenderer Uncaptured WebGPU GPUValidationError (Buffer1 index[0] is missing)
        // occurring in Chromium browsers with experimental WebGPU enabled.
        const app = new Application(canvasRef.current, {
          renderer: 'webgl',
          renderOnDemand,
          wasmPath,
        });

        appInstance = app;
        appRef.current = app;

        // Register Spline event listeners
        const eventHandlers: [SplineEventName, ((e: SplineEvent) => void) | undefined][] = [
          ['mouseDown', onSplineMouseDown],
          ['mouseUp', onSplineMouseUp],
          ['mouseHover', onSplineMouseHover],
          ['keyDown', onSplineKeyDown],
          ['keyUp', onSplineKeyUp],
          ['start', onSplineStart],
          ['lookAt', onSplineLookAt],
          ['follow', onSplineFollow],
          ['scroll', onSplineScroll],
        ];

        for (const [eventName, handler] of eventHandlers) {
          if (handler) {
            app.addEventListener(eventName, handler);
          }
        }

        await app.load(scene);

        if (isMounted) {
          setIsLoading(false);
          if (onLoad) {
            onLoad(app);
          }
        }
      } catch (err) {
        console.warn('[SafeSpline] Failed to load Spline scene:', err);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    initSpline();

    // Container resize observation for responsive viewport alignment
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && appRef.current) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            try {
              appRef.current?.setSize(Math.round(width), Math.round(height));
            } catch {
              // Ignore resize errors during transitions
            }
          }, 60);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isMounted = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();

      if (appInstance) {
        try {
          appInstance.dispose();
        } catch {
          // Ignore disposal errors on unmount
        }
      }
      appRef.current = null;
    };
  }, [
    scene,
    renderOnDemand,
    wasmPath,
    onLoad,
    onSplineMouseDown,
    onSplineMouseUp,
    onSplineMouseHover,
    onSplineKeyDown,
    onSplineKeyUp,
    onSplineStart,
    onSplineLookAt,
    onSplineFollow,
    onSplineScroll,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className || ''}`}
      style={{ width: '100%', height: '100%', ...style }}
      {...rest}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-zinc-600 text-xs font-mono tracking-widest uppercase animate-pulse">
            {loadingLabel}
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
          <div className="text-zinc-500 text-xs font-mono tracking-wider">
            3D ENGINE UNAVAILABLE
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: hasError ? 'none' : 'block',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.4s ease-in-out',
        }}
      />
    </div>
  );
});

export default SafeSpline;
