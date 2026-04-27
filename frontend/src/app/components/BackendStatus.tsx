'use client';

import { useState, useEffect } from 'react';

export function BackendStatus() {
    const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                setStatus(data.status === 'UP' ? 'up' : 'down');
            } catch (error) {
                setStatus('down');
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === 'checking' ? 'bg-yellow-500 animate-pulse' :
                    status === 'up' ? 'bg-green-500' :
                        'bg-red-500 animate-pulse'
                }`} />
            <span className="text-xs text-zinc-500 font-mono">
                {status === 'checking' ? 'Checking...' :
                    status === 'up' ? 'Backend UP' :
                        'Backend DOWN'}
            </span>
        </div>
    );
}
