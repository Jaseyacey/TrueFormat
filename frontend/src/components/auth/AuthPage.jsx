import { navigate } from '../../utils/navigation.js';

export default function AuthPage({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  otpCode,
  setOtpCode,
  authStatus,
  onSubmit,
  onResendOtp,
  isOtpStep,
}) {
  const inputClass =
    'w-full rounded-lg border border-white/15 bg-[#27272A]/65 px-3 py-2 text-sm text-[#F8FAFC] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30';

  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[#27272A]/55 p-7 backdrop-blur-md">
      <h2 className="mb-4 text-2xl font-semibold text-[#F8FAFC]">
        {mode === 'login' ? 'Log in to TrueFormat' : isOtpStep ? 'Verify your email' : 'Create your TrueFormat account'}
      </h2>

      <form className="grid gap-3" onSubmit={onSubmit}>
        {!isOtpStep ? (
          <>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'signup' ? 'Company email address' : 'Email'}
              required
            />
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              minLength={8}
              required
            />
            {mode === 'signup' && (
              <input
                className={inputClass}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                minLength={8}
                required
              />
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-[#94A3B8]">
              Enter the 6-digit code sent to <span className="font-semibold text-[#F8FAFC]">{email}</span>.
            </p>
            <input
              className={inputClass}
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
            />
          </>
        )}
        <button
          className="rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569]"
          type="submit"
        >
          {mode === 'login' ? 'Log in' : isOtpStep ? 'Verify code' : 'Sign up'}
        </button>
      </form>

      {authStatus && <p className="mt-3 text-sm font-medium text-[#94A3B8]">{authStatus}</p>}
      {mode === 'signup' && isOtpStep && (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-[#38BDF8] underline underline-offset-2"
          onClick={onResendOtp}
        >
          Resend code
        </button>
      )}
      <p className="mt-3 text-sm text-[#94A3B8]">
        {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="font-semibold text-[#38BDF8] underline underline-offset-2"
          onClick={() => navigate(mode === 'login' ? '/signup' : '/login')}
        >
          {mode === 'login' ? 'Create account' : 'Log in'}
        </button>
      </p>
    </section>
  );
}
