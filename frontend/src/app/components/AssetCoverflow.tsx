'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import Image from 'next/image';
import { useLanguage } from './LanguageContext';
import { AnimatedButton } from './ButtonAnimations';

// Asset data - Precious Metals represented by Diamond
const assets = [
    {
        id: 'precious-metals',
        image: '/media/landingPage/gold_landingpage.jpg',
        nameKey: 'assets.precious_metals',
        descKey: 'assets.precious_metals.desc',
    },
    {
        id: 'crypto',
        image: '/media/landingPage/assets/crypto_assets.jpg',
        nameKey: 'assets.crypto',
        descKey: 'assets.crypto.desc',
    },
    {
        id: 'forex',
        image: '/media/landingPage/assets/forex_asstes.jpg',
        nameKey: 'assets.forex',
        descKey: 'assets.forex.desc',
    },
    {
        id: 'stocks',
        image: '/media/landingPage/assets/stocks_assets.jpg',
        nameKey: 'assets.stocks',
        descKey: 'assets.stocks.desc',
    },
    {
        id: 'cash',
        image: '/media/landingPage/assets/cash_assets.jpg',
        nameKey: 'assets.cash',
        descKey: 'assets.cash.desc',
    },
    {
        id: 'savings',
        image: '/media/landingPage/assets/saving_assets.jpg',
        nameKey: 'assets.savings',
        descKey: 'assets.savings.desc',
    },
    {
        id: 'realestate',
        image: '/media/landingPage/assets/realestate_assets.jpg',
        nameKey: 'assets.realestate',
        descKey: 'assets.realestate.desc',
    },
    {
        id: 'alternative',
        image: '/media/landingPage/assets/alternative_assets.jpg',
        nameKey: 'assets.alternative',
        descKey: 'assets.alternative.desc',
    },
    {
        id: 'collectibles',
        image: '/media/landingPage/assets/collectivles_assets.jpg',
        nameKey: 'assets.collectibles',
        descKey: 'assets.collectibles.desc',
    },
];

// Default 3D settings
const DEFAULT_SETTINGS = {
    perspective: 1000,
    rotateY: 45,
    depth: 150,
    activeScale: 1.0,
    inactiveScale: 0.85,
    inactiveOpacity: 0.5,
    snapDuration: 0.6,
    snapEase: 'power3.out',
};

export function AssetCoverflow() {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const slidesRef = useRef<(HTMLDivElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const indexRef = useRef(0);
    const trackX = useRef(0);
    const drag = useRef({
        active: false,
        startX: 0,
        startTrackX: 0,
        lastX: 0,
        lastTime: 0,
        velocity: 0,
    });
    const { t } = useLanguage();

    const slideWidth = 320;
    const slideHeight = 400;
    const gap = 20;
    const count = assets.length;
    const step = slideWidth + gap;

    const centerXFor = useCallback(
        (i: number) => {
            const el = containerRef.current;
            if (!el) return -i * step;
            return el.offsetWidth / 2 - i * step - slideWidth / 2;
        },
        [step, slideWidth]
    );

    // Per-slide 3D transforms
    const render = useCallback(() => {
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;

        track.style.transform = `translateX(${trackX.current}px)`;
        const center = el.offsetWidth / 2;

        slidesRef.current.forEach((slide, i) => {
            if (!slide) return;
            const slideCenter = i * step + slideWidth / 2 + trackX.current;
            const norm = (slideCenter - center) / step;
            const abs = Math.abs(norm);

            const ry = norm * DEFAULT_SETTINGS.rotateY;
            const tz = -abs * DEFAULT_SETTINGS.depth;
            const sc = Math.max(
                DEFAULT_SETTINGS.inactiveScale,
                DEFAULT_SETTINGS.activeScale - abs * (DEFAULT_SETTINGS.activeScale - DEFAULT_SETTINGS.inactiveScale)
            );
            const op = Math.max(
                DEFAULT_SETTINGS.inactiveOpacity,
                1 - abs * (1 - DEFAULT_SETTINGS.inactiveOpacity)
            );

            slide.style.transform = `perspective(${DEFAULT_SETTINGS.perspective}px) rotateY(${ry}deg) translateZ(${tz}px) scale(${sc})`;
            slide.style.opacity = `${op}`;
            slide.style.zIndex = `${100 - Math.round(abs * 10)}`;
        });
    }, [step, slideWidth]);

    const snapTo = useCallback(
        (i: number, instant = false) => {
            const target = ((i % count) + count) % count;
            const x = centerXFor(target);

            if (instant) {
                trackX.current = x;
                render();
                indexRef.current = target;
                setActiveIndex(target);
                return;
            }

            indexRef.current = target;
            setActiveIndex(target);

            gsap.killTweensOf(trackX);
            gsap.to(trackX, {
                current: x,
                duration: DEFAULT_SETTINGS.snapDuration,
                ease: DEFAULT_SETTINGS.snapEase,
                onUpdate: render,
            });
        },
        [centerXFor, count, render]
    );

    // Initial render
    useEffect(() => {
        slidesRef.current = slidesRef.current.slice(0, count);
        snapTo(0, true);
    }, [count, snapTo]);

    // Drag interaction with velocity tracking
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onStart = (e: MouseEvent | TouchEvent) => {
            gsap.killTweensOf(trackX);
            drag.current.active = true;
            const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
            drag.current.startX = x;
            drag.current.startTrackX = trackX.current;
            drag.current.lastX = x;
            drag.current.lastTime = Date.now();
            drag.current.velocity = 0;
            container.style.cursor = 'grabbing';
        };

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!drag.current.active) return;
            if (e.cancelable) e.preventDefault();
            const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const now = Date.now();
            const dt = now - drag.current.lastTime;
            if (dt > 0) {
                drag.current.velocity = ((x - drag.current.lastX) / dt) * 1000;
            }
            drag.current.lastX = x;
            drag.current.lastTime = now;
            trackX.current = drag.current.startTrackX + (x - drag.current.startX);
            render();
        };

        const onEnd = () => {
            if (!drag.current.active) return;
            drag.current.active = false;
            container.style.cursor = 'grab';

            // Velocity-projected snap
            const projected = trackX.current + drag.current.velocity * 0.12;
            const center = container.offsetWidth / 2;
            let best = 0;
            let bestDist = Infinity;
            for (let i = 0; i < count; i++) {
                const sc = i * step + slideWidth / 2 + projected;
                const d = Math.abs(sc - center);
                if (d < bestDist) {
                    bestDist = d;
                    best = i;
                }
            }
            snapTo(best);
        };

        container.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        container.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);

        return () => {
            container.removeEventListener('mousedown', onStart);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            container.removeEventListener('touchstart', onStart);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [count, step, slideWidth, render, snapTo]);

    const goPrev = () => snapTo(indexRef.current - 1);
    const goNext = () => snapTo(indexRef.current + 1);

    return (
        <>
            <div
                ref={containerRef}
                className="relative w-full h-full overflow-hidden flex items-center cursor-grab select-none py-24"
            >
                <div
                    ref={trackRef}
                    className="flex items-center"
                    style={{ gap: `${gap}px` }}
                >
                    {assets.map((asset, i) => (
                        <div
                            key={`${asset.id}-${i}`}
                            ref={(el) => {
                                slidesRef.current[i] = el;
                            }}
                            className="relative rounded-lg overflow-hidden flex-shrink-0"
                            style={{
                                width: `${slideWidth}px`,
                                height: `${slideHeight}px`,
                                willChange: 'transform, opacity',
                                transformStyle: 'preserve-3d',
                            }}
                        >
                            <Image
                                src={asset.image}
                                alt={t(asset.nameKey)}
                                fill
                                className="object-cover pointer-events-none"
                                quality={90}
                                draggable={false}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                            {i === activeIndex && (
                                <div className="absolute bottom-8 left-0 right-0 text-center z-10 px-6">
                                    <h4 className="font-sans font-bold text-3xl tracking-tighter uppercase text-white">
                                        {t(asset.nameKey)}
                                    </h4>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Navigation Arrows */}
                <button
                    onClick={goPrev}
                    aria-label="Previous asset"
                    className="absolute left-4 md:left-12 z-20 w-12 h-12 rounded-full glass-panel border border-white/20 flex items-center justify-center hover:border-white/40 transition-all hover:scale-110"
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button
                    onClick={goNext}
                    aria-label="Next asset"
                    className="absolute right-4 md:right-12 z-20 w-12 h-12 rounded-full glass-panel border border-white/20 flex items-center justify-center hover:border-white/40 transition-all hover:scale-110"
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Dynamic Description */}
            <div className="max-w-4xl mx-auto text-center mt-12">
                <p className="font-sans text-zinc-400 text-base mb-8">
                    {t(assets[activeIndex].descKey)}
                </p>
            </div>
        </>
    );
}
