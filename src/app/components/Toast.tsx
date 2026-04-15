'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, Warning } from '@phosphor-icons/react';
import { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: Warning,
};

const colors = {
    success: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/50',
    error: 'from-red-500/20 to-red-600/20 border-red-500/50',
    info: 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
    warning: 'from-amber-500/20 to-amber-600/20 border-amber-500/50',
};

const iconColors = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    info: 'text-blue-400',
    warning: 'text-amber-400',
};

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
    const Icon = icons[type];

    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl bg-gradient-to-br ${colors[type]} shadow-2xl min-w-[300px] max-w-md`}
        >
            <Icon className={`w-5 h-5 ${iconColors[type]} flex-shrink-0`} weight="fill" />
            <p className="text-sm text-white/90 font-medium flex-1">{message}</p>
            <button
                onClick={onClose}
                className="text-white/60 hover:text-white/90 transition-colors"
            >
                <XCircle className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

interface ToastContainerProps {
    toasts: Array<{ id: string; message: string; type: ToastType }>;
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <AnimatePresence>
            {toasts.map((toast, index) => (
                <div key={toast.id} style={{ top: `${16 + index * 80}px` }} className="fixed right-4 z-50">
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                </div>
            ))}
        </AnimatePresence>
    );
}
