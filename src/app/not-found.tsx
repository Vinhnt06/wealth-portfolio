'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { House, ArrowLeft } from '@phosphor-icons/react';
import { useLanguage } from './components/LanguageContext';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useSession } from 'next-auth/react';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Loading 3D Scene...</div>
        </div>
    ),
});

export default function NotFound() {
    const { t } = useLanguage();
    const { status } = useSession();

    return (
        <main className="relative w-full h-[100dvh] bg-black text-white overflow-hidden selection:bg-white selection:text-black">
            {/* Spline 3D Background */}
            <div className="absolute inset-0 z-0">
                <Spline scene="https://prod.spline.design/nK1QatZ4h2dcb-x4/scene.splinecode" />
            </div>

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col items-start justify-end h-full px-8 md:px-16 pb-24 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.5 }}
                    className="max-w-lg pointer-events-auto"
                >
                    {/* Error Code */}
                    <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 uppercase mb-4">
                        {t('error.404')}
                    </p>

                    {/* Headline */}
                    <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-4">
                        {t('error.not_found')}
                    </h1>

                    {/* Description */}
                    <p className="text-zinc-500 text-sm md:text-base leading-relaxed mb-8 max-w-md">
                        {t('error.not_found_desc')}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4">
                        <Link
                            href={status === 'authenticated' ? '/dashboard' : '/'}
                            className="inline-flex items-center gap-2.5 h-12 px-6 rounded-full bg-white text-black text-sm font-semibold transition-transform hover:scale-[0.98] active:scale-95"
                        >
                            <House size={16} weight="bold" />
                            {t('error.back_home')}
                        </Link>
                        <button
                            onClick={() => window.history.back()}
                            className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-white/15 text-sm font-semibold text-zinc-300 transition-all hover:bg-white/5 hover:scale-[0.98] active:scale-95"
                        >
                            <ArrowLeft size={16} weight="bold" />
                            {t('error.go_back')}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Header: Logo and Language Switcher */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 md:px-16 py-6 z-20"
            >
                <Link href="/" className="text-xl font-semibold tracking-tighter text-white hover:text-zinc-300 transition-colors">
                    YourFin.
                </Link>
                <LanguageSwitcher />
            </motion.div>

            {/* Spline Watermark Hider - Bottom Right */}
            <div className="absolute bottom-4 right-4 w-40 h-10 bg-black z-20 pointer-events-none" />
        </main>
    );
}
