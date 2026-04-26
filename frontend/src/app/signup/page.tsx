'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLanguage } from '../components/LanguageContext';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
            <div className="text-zinc-600 text-sm font-mono tracking-widest uppercase">Loading 3D...</div>
        </div>
    ),
});

export default function SignupPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        dateOfBirth: '',
        age: '',
        occupation: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    dateOfBirth: formData.dateOfBirth || undefined,
                    age: formData.age ? parseInt(formData.age) : undefined,
                    occupation: formData.occupation || undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Signup failed');
                setLoading(false);
                return;
            }

            // Auto login after signup
            await signIn('credentials', {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            router.push('/dashboard');
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const handleGoogleSignup = () => {
        signIn('google', { callbackUrl: '/dashboard' });
    };

    return (
        <main className="min-h-screen flex flex-col md:flex-row bg-black text-white">
            {/* Left: Spline 3D */}
            <motion.section
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full md:w-1/2 min-h-[400px] md:min-h-screen bg-zinc-950 overflow-hidden"
            >
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full transform translate-x-[15%]">
                        <Spline scene="https://prod.spline.design/7Uld6Oz2cKWvsxOq/scene.splinecode" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 right-[-5%] w-40 h-10 bg-black z-10 pointer-events-none" />
                </div>

                <div className="relative z-10 h-full flex flex-col justify-end p-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="max-w-lg"
                    >
                        <h1 className="text-white font-bold text-5xl md:text-7xl tracking-tighter leading-tight mb-4">
                            Join YourFin
                        </h1>
                        <p className="text-zinc-400 text-lg max-w-sm">
                            Start managing your wealth with precision and intelligence.
                        </p>
                    </motion.div>
                </div>
            </motion.section>

            {/* Right: Signup Form */}
            <motion.section
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="w-full md:w-1/2 bg-black flex items-center justify-center p-8 md:p-24 overflow-y-auto"
            >
                <div className="w-full max-w-md space-y-6">
                    <motion.header
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="space-y-2"
                    >
                        <Link href="/" className="inline-block mb-6 text-zinc-500 hover:text-white transition-colors text-sm">
                            {t('signup.back')}
                        </Link>
                        <h2 className="text-white font-bold text-3xl tracking-tight">{t('signup.title')}</h2>
                        <p className="text-zinc-400">{t('signup.subtitle')}</p>
                    </motion.header>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <motion.form
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="firstName" className="block text-sm font-medium text-zinc-400">
                                    {t('signup.firstName')}
                                </label>
                                <input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder={t('signup.firstName.placeholder')}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="lastName" className="block text-sm font-medium text-zinc-400">
                                    {t('signup.lastName')}
                                </label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder={t('signup.lastName.placeholder')}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium text-zinc-400">
                                {t('signup.email')}
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={t('signup.email.placeholder')}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="phone" className="block text-sm font-medium text-zinc-400">
                                {t('signup.phone')}
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder={t('signup.phone.placeholder')}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-medium text-zinc-400">
                                {t('signup.password')}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={t('signup.password.placeholder')}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-400">
                                {t('signup.confirmPassword')}
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder={t('signup.confirmPassword.placeholder')}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-white focus:border-white transition-all outline-none"
                            />
                        </div>



                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : t('signup.submit')}
                        </motion.button>
                    </motion.form>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                            <span className="bg-black px-4 text-zinc-600">{t('signup.or')}</span>
                        </div>
                    </motion.div>

                    <motion.button
                        onClick={handleGoogleSignup}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-all"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="text-sm font-medium">{t('signup.google')}</span>
                    </motion.button>

                    <motion.footer
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                        className="text-center"
                    >
                        <p className="text-sm text-zinc-400">
                            {t('signup.hasAccount')}{' '}
                            <Link href="/login" className="text-white font-semibold hover:underline underline-offset-4 ml-1">
                                {t('signup.login')}
                            </Link>
                        </p>
                    </motion.footer>
                </div>
            </motion.section>
        </main>
    );
}
