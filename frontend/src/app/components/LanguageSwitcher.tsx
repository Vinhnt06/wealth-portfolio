'use client';

import { motion } from 'framer-motion';
import { useLanguage } from './LanguageContext';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center bg-zinc-900/50 rounded-full p-1 border border-white/10">
            <motion.button
                onClick={() => setLanguage('en')}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${language === 'en' ? 'text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                whileTap={{ scale: 0.95 }}
            >
                {language === 'en' && (
                    <motion.div
                        layoutId="language-pill"
                        className="absolute inset-0 bg-white rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                )}
                <span className="relative z-10">EN</span>
            </motion.button>

            <motion.button
                onClick={() => setLanguage('vi')}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${language === 'vi' ? 'text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                whileTap={{ scale: 0.95 }}
            >
                {language === 'vi' && (
                    <motion.div
                        layoutId="language-pill"
                        className="absolute inset-0 bg-white rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                )}
                <span className="relative z-10">VI</span>
            </motion.button>
        </div>
    );
}
