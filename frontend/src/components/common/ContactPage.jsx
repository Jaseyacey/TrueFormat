import { useState } from 'react';
import { supabase } from '../../supabaseClient.js';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setStatus('Supabase is not configured. Please set your environment variables.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    const trimmedCompany = company.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setStatus('Please complete name, email, and message.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Sending message...');

    const { error } = await supabase.from('contact_us').insert([
      {
        name: trimmedName,
        email: trimmedEmail,
        company: trimmedCompany || null,
        message: trimmedMessage,
      },
    ]);

    if (error) {
      setStatus(error.message || 'Unable to send message. Please try again.');
      setIsSubmitting(false);
      return;
    }

    setName('');
    setEmail('');
    setCompany('');
    setMessage('');
    setStatus('Message sent. We will get back to you shortly.');
    setIsSubmitting(false);
  };

  const inputClass =
    'w-full rounded-lg border border-white/15 bg-[#27272A]/65 px-3 py-2 text-sm text-[#F8FAFC] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30';

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#27272A]/55 p-7 backdrop-blur-md">
      <h2 className="mb-2 text-2xl font-semibold text-[#F8FAFC]">Contact Us</h2>
      <p className="mb-4 text-sm text-[#94A3B8]">Tell us about your invoice workflow and what you need from TrueFormat.</p>

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className={inputClass}
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="text"
          placeholder="Company (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <textarea
          className={`${inputClass} min-h-28`}
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {status && <p className="mt-3 text-sm font-medium text-[#94A3B8]">{status}</p>}

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-[#94A3B8]">
        <p className="font-semibold text-[#CBD5E1]">Registered Office</p>
        <p className="mt-1">54 Wandsworth High Street, SW18 4RD</p>
      </div>
    </section>
  );
}
