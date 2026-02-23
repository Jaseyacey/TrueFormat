import { useEffect } from 'react';
import { navigate } from '../../utils/navigation.js';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = '404 - Page Not Found | TrueFormat';
  }, []);

  return (
    <main className="rounded-3xl border border-white/10 bg-[#020617]/90 px-5 py-14 text-[#F8FAFC] shadow-2xl shadow-black/45 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#38BDF8]">Page Not Found</p>
        <h1 className="mt-3 text-8xl font-black leading-none sm:text-9xl">404</h1>
        <p className="mt-4 text-3xl font-extrabold sm:text-4xl">Are you lost?</p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[#CBD5E1] sm:text-lg">
          The page you requested does not exist or may have moved.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-lg bg-[#38BDF8] px-6 py-3 text-sm font-bold text-[#020617] transition hover:bg-[#7DD3FC]"
            onClick={() => navigate('/')}
          >
            Go Home
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-[#CBD5E1] transition hover:border-[#38BDF8] hover:text-[#F8FAFC]"
            onClick={() => navigate('/contact')}
          >
            Contact Us
          </button>
        </div>
      </section>
    </main>
  );
}
