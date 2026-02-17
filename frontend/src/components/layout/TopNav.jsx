import { navigate } from '../../utils/navigation.js';

function NavLink({ path, children }) {
  return (
    <button
      type="button"
      className="rounded-lg px-3 py-2 text-sm font-medium text-[#94A3B8] transition hover:bg-white/5 hover:text-[#F8FAFC]"
      onClick={() => navigate(path)}
    >
      {children}
    </button>
  );
}

export default function TopNav({ authed, onLogout }) {
  return (
    <header className="sticky top-3 z-50 mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#38BDF8]/20 bg-[linear-gradient(90deg,#020617_0%,#03122d_55%,#020617_100%)] px-4 py-3 backdrop-blur-md sm:items-center">
      <button type="button" className="flex items-center gap-3" onClick={() => navigate('/')}>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#38BDF8]/40 bg-[#0f1f3a] shadow-[0_0_20px_rgba(56,189,248,0.22)]">
          <img src="/trueformat-logo.svg" alt="TrueFormat logo" className="h-8 w-8 rounded-full" />
        </span>
        <span className="text-2xl font-black leading-none tracking-tight text-[#F8FAFC] sm:text-4xl">TrueFormat</span>
      </button>

      <nav className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
        <NavLink path="/">Home</NavLink>
        <NavLink path="/blog">Blog</NavLink>
        <NavLink path="/terms">Terms</NavLink>
        <NavLink path="/privacy">Privacy</NavLink>
        {authed ? (
          <>
            <NavLink path="/app">App</NavLink>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-[#94A3B8] transition hover:border-[#38BDF8] hover:text-[#F8FAFC]"
              onClick={onLogout}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink path="/login">Log in</NavLink>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-[#CBD5E1] transition hover:border-[#38BDF8] hover:text-[#F8FAFC] sm:ml-1"
              onClick={() => navigate('/signup')}
            >
              Request Demo
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569] sm:ml-1"
              onClick={() => navigate('/signup')}
            >
              Get Started
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
