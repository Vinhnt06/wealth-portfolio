'use client';

import dynamic from 'next/dynamic';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import Link from 'next/link';
import { motion, useScroll } from 'framer-motion';
import { useState, useEffect } from 'react';

// Import client-side Spline component dynamically to avoid SSR errors
const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#000000] flex items-center justify-center">
      <div className="text-zinc-600 text-sm font-mono tracking-widest uppercase">Loading 3D Engine...</div>
    </div>
  ),
});

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (y) => {
      setIsScrolled(y > 50);
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <main className="relative w-full bg-black text-white selection:bg-white selection:text-black min-h-screen">
      {/* Navbar / Banner - Transparent initially, Liquid Glass on scroll */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-300 ${isScrolled
          ? 'liquid-glass border-b border-white/10'
          : 'bg-transparent border-b-0'
          }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <div className="text-xl font-semibold tracking-tighter">YourFin.</div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <Link href="#features" className="hover:text-white transition-colors">{t('nav.features')}</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">{t('nav.pricing')}</Link>
          <Link href="#about" className="hover:text-white transition-colors">{t('nav.about')}</Link>
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login" className="text-sm font-medium hover:text-zinc-300 transition-colors">
            {t('nav.signin')}
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-zinc-200 transition-colors"
          >
            {t('nav.getstarted')}
          </Link>
        </div>
      </motion.header>

      {/* Hero Section - Full Screen Spline */}
      <section className="relative h-[100dvh] w-full">
        <Spline scene="https://prod.spline.design/NlnhqLy4Kkj9lsrF/scene.splinecode" />
        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <span className="text-xs font-sans font-medium text-zinc-500 uppercase tracking-widest">{t('hero.scroll')}</span>
          <motion.div
            className="w-[1px] h-12 bg-gradient-to-b from-zinc-500 to-transparent origin-top"
            animate={{ scaleY: [0, 1, 0], translateY: [0, 10, 20] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        </motion.div>
        {/* Spline Watermark Hider */}
        <div className="absolute bottom-4 right-4 w-40 h-10 bg-black z-10 pointer-events-none" />
      </section>

      {/* Content Section 1: Introduction */}
      <section className="relative min-h-[80vh] w-full flex flex-col items-center justify-center px-6 py-24 md:px-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="max-w-4xl text-center"
        >
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tighter mb-8 leading-[1.1]">
            {t('intro.title')} <br className="hidden md:block" />
            <span className="text-zinc-500">{t('intro.subtitle')}</span>
          </h2>

          <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            {t('intro.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-sm font-medium text-black transition-transform hover:scale-[0.98] active:scale-95"
            >
              {t('intro.cta.primary')}
            </Link>
            <Link
              href="#features"
              className="inline-flex h-14 items-center justify-center rounded-full border border-white/20 px-8 text-sm font-medium text-white transition-all hover:bg-white/10 hover:scale-[0.98] active:scale-95"
            >
              {t('intro.cta.secondary')}
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Content Section 2: Features (Bento Grid) */}
      <section id="features" className="relative min-h-screen w-full px-6 py-24 md:px-12 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="mb-16"
        >
          <h3 className="text-3xl md:text-5xl font-semibold tracking-tighter mb-4">{t('features.title')}</h3>
          <p className="text-zinc-400 text-lg">{t('features.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Item 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
            className="md:col-span-2 h-80 rounded-[2rem] border border-white/10 bg-zinc-900/50 p-8 flex flex-col justify-end transition-colors hover:bg-zinc-900"
          >
            <h4 className="text-2xl font-medium mb-2">{t('features.realtime')}</h4>
            <p className="text-zinc-500">{t('features.realtime.desc')}</p>
          </motion.div>

          {/* Bento Item 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
            className="h-80 rounded-[2rem] border border-white/10 bg-zinc-900/50 p-8 flex flex-col justify-end transition-colors hover:bg-zinc-900"
          >
            <h4 className="text-2xl font-medium mb-2">{t('features.multiasset')}</h4>
            <p className="text-zinc-500">{t('features.multiasset.desc')}</p>
          </motion.div>

          {/* Bento Item 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
            className="h-80 rounded-[2rem] border border-white/10 bg-zinc-900/50 p-8 flex flex-col justify-end transition-colors hover:bg-zinc-900"
          >
            <h4 className="text-2xl font-medium mb-2">{t('features.pl')}</h4>
            <p className="text-zinc-500">{t('features.pl.desc')}</p>
          </motion.div>

          {/* Bento Item 4 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.4 }}
            className="md:col-span-2 h-80 rounded-[2rem] border border-white/10 bg-zinc-900/50 p-8 flex flex-col justify-end transition-colors hover:bg-zinc-900"
          >
            <h4 className="text-2xl font-medium mb-2">{t('features.alerts')}</h4>
            <p className="text-zinc-500">{t('features.alerts.desc')}</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative w-full px-6 py-16 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="text-xl font-semibold tracking-tighter mb-4">YourFin.</div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Premium personal finance platform for modern investors.
            </p>
          </div>

          {/* Links */}
          <div>
            <h5 className="text-sm font-medium mb-4">{t('footer.product')}</h5>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Roadmap</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-medium mb-4">{t('footer.company')}</h5>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-medium mb-4">{t('footer.legal')}</h5>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Security</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-sm">
            © {new Date().getFullYear()} YourFin. {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-6 text-zinc-600 text-sm">
            <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-white transition-colors">Discord</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
