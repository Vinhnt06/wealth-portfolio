'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../LanguageContext';
import { LanguageSwitcher } from '../LanguageSwitcher';
import {
    House,
    User,
    List,
    X,
    TrendUp,
    Bell,
    Newspaper,
    GraduationCap,
    ClockCounterClockwise,
    Gear,
    ChartBar,
    SignOut,
    CaretDown,
    WarningCircle,
} from '@phosphor-icons/react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { t } = useLanguage();
    const { data: session } = useSession();

    const user = session?.user as any;
    const firstName = user?.firstName || user?.name?.split(' ')[0] || 'User';
    const lastName = user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '';
    const displayName = `${firstName} ${lastName}`.trim();
    const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
    const avatarUrl = user?.image;

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setIsSidebarOpen(true);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const navItems = [
        { icon: House, labelKey: 'dash.nav.overview', href: '/dashboard' },
        { icon: TrendUp, labelKey: 'dash.nav.markets', href: '/dashboard/markets' },
        { icon: Newspaper, labelKey: 'dash.nav.news', href: '/dashboard/news' },
        { icon: GraduationCap, labelKey: 'dash.nav.learn', href: '/dashboard/learn' },
        { icon: ClockCounterClockwise, labelKey: 'dash.nav.history', href: '/dashboard/history' },
    ];

    const topNavItems = [
        { labelKey: 'dash.nav.portfolio', href: '/dashboard', active: true },
        { labelKey: 'dash.nav.analytics', href: '/dashboard/analytics', active: false },
        { labelKey: 'dash.nav.settings', href: '/dashboard/settings', active: false },
    ];

    const isActive = (href: string) => href === '/dashboard';

    return (
        <div className="min-h-[100dvh] bg-black text-white">
            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-lg border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <Link href="/dashboard" className="text-xl font-semibold tracking-tighter">YourFin.</Link>
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors active:scale-95"
                    >
                        {isSidebarOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
                    </button>
                </div>
            </header>

            {/* Sidebar */}
            <AnimatePresence>
                {(isSidebarOpen || !isMobile) && (
                    <motion.aside
                        initial={isMobile ? { x: -256 } : false}
                        animate={{ x: 0 }}
                        exit={{ x: -256 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed top-16 left-0 h-[calc(100dvh-4rem)] w-64 bg-[#0C0C0C] border-r border-white/5 z-40"
                    >
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-9 h-9 bg-white/8 rounded-lg flex items-center justify-center">
                                    <User size={18} className="text-zinc-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white leading-none">{t('dash.nav.portfolio')}</p>
                                    <p className="text-[9px] text-zinc-600 font-bold tracking-[0.15em] uppercase mt-0.5">{t('dash.premium')}</p>
                                </div>
                            </div>
                            <button className="w-full py-2.5 rounded-lg bg-white text-black text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-zinc-200 transition-colors active:scale-[0.98]">
                                {t('dash.deposit')}
                            </button>
                        </div>

                        <nav className="mt-2">
                            {navItems.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => isMobile && setIsSidebarOpen(false)}
                                        className={`flex items-center gap-3.5 px-5 py-2.5 transition-all duration-200 group border-l-2 ${active
                                            ? 'bg-white/5 border-white'
                                            : 'border-transparent hover:bg-white/[0.03]'
                                            }`}
                                    >
                                        <item.icon
                                            size={18}
                                            weight={active ? 'fill' : 'regular'}
                                            className={active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}
                                        />
                                        <span className={`text-[13px] font-medium ${active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'} transition-colors`}>
                                            {t(item.labelKey)}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Sidebar Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/5">
                            <Link
                                href="/profile"
                                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-blue-600 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                    ) : initials}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">{displayName}</p>
                                    <p className="text-[9px] text-zinc-600">{t('dash.view_profile')}</p>
                                </div>
                            </Link>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main */}
            <main className="md:ml-64 min-h-[100dvh] pt-16 bg-[#0A0A0A]">
                {/* Desktop Top Nav */}
                <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 bg-[#0F0F0F]/95 backdrop-blur-lg border-b border-white/5 items-center justify-between px-6 z-50">
                    <div className="flex items-center gap-10">
                        <Link href="/dashboard" className="text-xl font-semibold tracking-tighter">YourFin.</Link>
                        <nav className="flex items-center gap-8 h-16" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            {topNavItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative flex items-center h-full text-sm font-semibold transition-colors group ${item.active ? 'text-white' : 'text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {t(item.labelKey)}
                                    <span className={`absolute bottom-0 left-0 h-[2px] bg-white transition-all duration-300 ${item.active ? 'w-full' : 'w-0 group-hover:w-full'
                                        }`} />
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-5">
                        <input
                            type="text"
                            placeholder={t('dash.search')}
                            className="px-4 py-2 bg-black/60 rounded-lg text-[10px] tracking-wider text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700 w-56 border border-white/5 font-medium"
                        />
                        <LanguageSwitcher />
                        <button className="text-zinc-500 hover:text-white transition-colors relative">
                            <Bell size={18} />
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover border border-white/10" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white">
                                        {initials}
                                    </div>
                                )}
                                <CaretDown size={12} className={`transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                                    >
                                        <div className="p-3 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className="px-2 py-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-md">
                                                    <p className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Premium Tier</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <Link
                                                href="/profile"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-zinc-300 hover:text-white"
                                            >
                                                <User size={16} />
                                                {t('dash.profile')}
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    setIsUserMenuOpen(false);
                                                    setIsLogoutModalOpen(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-sm text-zinc-300 hover:text-red-400"
                                            >
                                                <SignOut size={16} />
                                                {t('dash.signout')}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isSidebarOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {isLogoutModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsLogoutModalOpen(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-sm px-4"
                        >
                            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
                                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                    <WarningCircle size={28} weight="duotone" className="text-rose-400" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">{t('signout.title') || 'Sign Out'}</h3>
                                <p className="text-zinc-500 text-sm mb-7">{t('signout.desc') || 'Are you sure you want to sign out of your account?'}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsLogoutModalOpen(false)}
                                        className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all"
                                    >
                                        {t('signout.cancel') || 'Cancel'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsLoggingOut(true);
                                            await signOut({ callbackUrl: '/' });
                                        }}
                                        disabled={isLoggingOut}
                                        className="flex-1 py-3 px-4 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <SignOut size={16} weight="bold" />
                                        {isLoggingOut ? (t('signout.loading') || 'Signing out...') : (t('signout.confirm') || 'Sign Out')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
