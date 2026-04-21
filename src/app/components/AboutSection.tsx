'use client';

import { motion } from 'framer-motion';
import { useLanguage } from './LanguageContext';
import Link from 'next/link';
import Image from 'next/image';
import { GithubLogo, LinkedinLogo, FacebookLogo, EnvelopeSimple, ArrowUpRight } from '@phosphor-icons/react';

export function AboutSection() {
    const { t } = useLanguage();

    const socialLinks = [
        {
            name: 'GitHub',
            url: 'https://github.com/Vinhnt06',
            icon: GithubLogo,
            color: 'hover:text-white',
            bg: 'hover:bg-white/10'
        },
        {
            name: 'LinkedIn',
            url: 'https://www.linkedin.com/in/tuanvinh06/',
            icon: LinkedinLogo,
            color: 'hover:text-blue-500',
            bg: 'hover:bg-blue-500/10'
        },
        {
            name: 'Facebook',
            url: 'https://www.facebook.com/whatsupitsvinh/',
            icon: FacebookLogo,
            color: 'hover:text-blue-600',
            bg: 'hover:bg-blue-600/10'
        },
        {
            name: 'Email',
            url: 'mailto:tuanvinh2402@gmail.com',
            icon: EnvelopeSimple,
            color: 'hover:text-rose-500',
            bg: 'hover:bg-rose-500/10'
        }
    ];

    return (
        <section id="about" className="relative min-h-[80vh] w-full px-6 py-24 md:px-12 lg:px-24 bg-black border-t border-white/[0.04]">
            <div className="max-w-[1200px] mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    className="mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter mb-4">
                        {t('about.title') || 'About the Creator'}
                    </h2>
                    <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
                        {t('about.subtitle') || 'A passionate software engineer dedicated to crafting premium, high-performance digital experiences.'}
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Main Bio Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
                        className="md:col-span-8 bg-zinc-900/40 border border-white/[0.06] rounded-3xl p-8 md:p-12 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="font-mono text-9xl tracking-tighter mix-blend-overlay font-bold">V.</span>
                        </div>

                        <div className="relative z-10">
                            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-white/10 mb-8 overflow-hidden">
                                {/* Auto generic avatar fallback if no image */}
                                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-3xl font-bold text-white/50">
                                    NTV
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold mb-4">{t('about.greeting') || "Hi, I'm Nguyễn Tuấn Vinh"}</h3>
                            <div className="space-y-4 text-zinc-400 leading-relaxed font-medium">
                                <p>
                                    {t('about.p1') || 'I specialize in building scalable web applications with a focus on modern user interfaces and complex data architectures.'}
                                </p>
                                <p>
                                    {t('about.p2') || 'YourFin is a passion project combining my interest in financial technology with high-end digital design principles. The goal is to provide institutional-grade tools to retail investors through an immersive, lightning-fast interface.'}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Social Links Bento */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
                        className="md:col-span-4 flex flex-col gap-6"
                    >
                        {/* Status Card */}
                        <div className="flex-1 bg-zinc-900/40 border border-emerald-500/10 rounded-3xl p-8 flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                </span>
                                <span className="text-sm font-semibold tracking-wider text-emerald-500 uppercase">{t('about.status.label') || 'Current Status'}</span>
                            </div>
                            <h4 className="text-xl font-bold tracking-tight">{t('about.status.text') || 'Open for new opportunities'}</h4>
                        </div>

                        {/* Social Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {socialLinks.map((link, idx) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={idx}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 
                                                    transition-all duration-300 ${link.bg} group`}
                                    >
                                        <Icon size={28} weight="duotone" className={`text-zinc-500 transition-colors ${link.color}`} />
                                        <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                                            {link.name}
                                        </span>
                                        <ArrowUpRight size={12} weight="bold" className="absolute top-4 right-4 opacity-0 -translate-x-2 translate-y-2 group-hover:opacity-50 group-hover:translate-x-0 group-hover:translate-y-0 transition-all" />
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
