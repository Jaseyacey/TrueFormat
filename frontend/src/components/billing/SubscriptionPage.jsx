import { useEffect, useMemo, useState } from 'react';
import { resolveApiBase } from '../../utils/apiBase.js';
import { navigate } from '../../utils/navigation.js';

const API_BASE = resolveApiBase();

async function getApiError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

function PlanCard({ title, price, cadence, details, cta, onSelect, disabled }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#1f2937]/55 p-5">
      <h3 className="text-xl font-semibold text-[#F8FAFC]">{title}</h3>
      <p className="mt-2 text-3xl font-black text-[#F8FAFC]">{price}</p>
      <p className="text-sm text-[#94A3B8]">{cadence}</p>
      <p className="mt-3 text-sm text-[#CBD5E1]">{details}</p>
      <button
        type="button"
        className="mt-4 w-full rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onSelect}
        disabled={disabled}
      >
        {cta}
      </button>
    </article>
  );
}

export default function SubscriptionPage({ defaultEmail = '' }) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const checkoutSuccess = search.get('success') === '1';
  const checkoutCanceled = search.get('canceled') === '1';
  const sessionId = search.get('session_id') || '';

  useEffect(() => {
    if (!checkoutSuccess || !sessionId) return;
    let active = true;

    const verifyPayment = async () => {
      setStatus('Verifying your payment...');
      try {
        const res = await fetch(`${API_BASE}/billing/checkout-session?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error(await getApiError(res, `Verification failed (${res.status})`));
        const data = await res.json();
        if (!active) return;
        if (data?.payment_processed) {
          setStatus('Payment completed. You can now log in.');
          if (data?.email) setEmail(data.email);
          return;
        }
        setStatus('Payment is still processing. Refresh this page in a few seconds.');
      } catch (e) {
        if (active) setStatus(e.message || 'Unable to verify payment status.');
      }
    };

    verifyPayment();
    return () => {
      active = false;
    };
  }, [checkoutSuccess, sessionId]);

  useEffect(() => {
    if (checkoutCanceled) {
      setStatus('Checkout was canceled. Choose a plan to continue.');
    }
  }, [checkoutCanceled]);

  const startCheckout = async (billingCycle) => {
    if (!email.trim()) {
      setStatus('Enter your account email to continue.');
      return;
    }

    setIsLoading(true);
    setStatus('Creating secure checkout...');
    try {
      const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          billing_cycle: billingCycle,
        }),
      });
      if (!res.ok) throw new Error(await getApiError(res, `Checkout failed (${res.status})`));
      const data = await res.json();
      if (!data?.checkout_url) throw new Error('Checkout URL missing from server response.');
      window.location.href = data.checkout_url;
    } catch (e) {
      setStatus(e.message || 'Unable to start checkout.');
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#27272A]/55 p-7 backdrop-blur-md">
      <h2 className="text-2xl font-semibold text-[#F8FAFC]">Subscription</h2>
      <p className="mt-2 text-sm text-[#94A3B8]">Complete payment to unlock app access.</p>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-[#CBD5E1]" htmlFor="subscription-email">
          Account email
        </label>
        <input
          id="subscription-email"
          className="w-full rounded-lg border border-white/15 bg-[#27272A]/65 px-3 py-2 text-sm text-[#F8FAFC] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <PlanCard
          title="Monthly"
          price="£500"
          cadence="per month"
          details="Flexible billing with monthly renewal."
          cta="Choose Monthly"
          onSelect={() => startCheckout('monthly')}
          disabled={isLoading}
        />
        <PlanCard
          title="Annual"
          price="£5000"
          cadence="per year"
          details="Pay annually and keep billing simple."
          cta="Choose Annual"
          onSelect={() => startCheckout('annual')}
          disabled={isLoading}
        />
      </div>

      {status && <p className="mt-4 text-sm font-medium text-[#94A3B8]">{status}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-[#CBD5E1] transition hover:border-[#38BDF8] hover:text-[#F8FAFC]"
          onClick={() => navigate('/login')}
        >
          Go to Log in
        </button>
      </div>
    </section>
  );
}
