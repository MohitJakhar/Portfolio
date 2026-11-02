import { useEffect, useState } from 'react';

export type View = 'work' | 'about' | 'contact';

const time = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return [get('hour'), get('minute')] as const;
};

type Props = { view: View; onView: (v: View) => void };

export function Header({ view, onView }: Props) {
  const [[h, m], setNow] = useState(time);
  useEffect(() => {
    const id = window.setInterval(() => setNow(time()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const item = (v: View, label: string) => (
    <button
      type="button"
      className={view === v ? 'is-on' : ''}
      aria-current={view === v ? 'page' : undefined}
      onClick={() => onView(view === v && v !== 'work' ? 'work' : v)}
    >
      {label}
    </button>
  );

  return (
    <header className="head">
      <button type="button" className="head__name" onClick={() => onView('work')}>
        Mohit
        <br />
        Jakhar
      </button>
      <nav className="head__nav" aria-label="Sections">
        {item('work', 'Work')}
        {item('about', 'About')}
        {item('contact', 'Contact')}
      </nav>
      <p className="head__time">
        Local time, IST
        <br />
        <time>
          {h}
          <span className="blink">:</span>
          {m}
        </time>
      </p>
    </header>
  );
}
