'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { useLanguage } from '../components/LanguageContext';
import { SignOut, House, WarningCircle } from '@phosphor-icons/react';

export default function SignOutPage() {
    const { t } = useLanguage();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await signOut({ callbackUrl: '/' });
    };

    return (
        <main className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-6 selection:bg-white selection:text-black">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-zinc-800/20 blur-[160px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 100, damping: 22 }}
                className="relative z-10 w-full max-w-sm"
            >
                {/* Card */}
                <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-8 md:p-10 text-center backdrop-blur-sm">
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 120, damping: 15 }}
                        className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center"
                    >
                        <WarningCircle size={28} weight="duotone" className="text-rose-400" />
                    </motion.div>

                    {/* Text */}
                    <h1 className="text-2xl font-bold tracking-tight mb-2">
                        {t('signout.title') || 'Sign Out'}
                    </h1>
                    <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-[280px] mx-auto">
                        {t('signout.desc') || 'Are you sure you want to sign out of your account?'}
                    </p>

                    {/* Buttons */}
                    <div className="space-y-3">
                        <motion.button
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3.5 bg-rose-500 text-white font-bold text-sm rounded-xl
                                       hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                       flex items-center justify-center gap-2.5"
                        >
                            <SignOut size={16} weight="bold" />
                            {isSigningOut
                                ? (t('signout.loading') || 'Signing out...')
                                : (t('signout.confirm') || 'Yes, Sign Out')
                            }
                        </motion.button>

                        <Link
                            href="/dashboard"
                            className="block w-full py-3.5 text-sm font-bold text-zinc-400 rounded-xl border border-white/10
                                       hover:text-white hover:bg-white/5 hover:border-white/20 transition-all
                                       flex items-center justify-center gap-2.5"
                        >
                            <House size={16} weight="bold" />
                            {t('signout.cancel') || 'No, Go Back'}
                        </Link>
                    </div>
                </div>

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 text-center"
                >
                    <Link href="/" className="text-lg font-semibold tracking-tighter text-zinc-600 hover:text-zinc-400 transition-colors">
                        YourFin.
                    </Link>
                </motion.div>
            </motion.div>
        </main>
    );
}
