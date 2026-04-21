import { AboutSection } from '../components/AboutSection';
import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react/dist/ssr';

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-black text-white relative">
            {/* Header with Back Button */}
            <header className="absolute top-0 left-0 w-full p-6 md:p-12 z-50 flex items-center justify-between">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
                >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        <CaretLeft size={20} weight="bold" />
                    </div>
                    <span className="text-sm font-semibold tracking-wider uppercase">Back to Home</span>
                </Link>

                <div className="text-xl font-semibold tracking-tighter">YourFin.</div>
            </header>

            {/* Main Content */}
            <div className="pt-24 flex items-center justify-center min-h-screen">
                <AboutSection />
            </div>
        </main>
    );
}
