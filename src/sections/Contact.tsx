import { CONTACT } from '../design';
import type { Layout } from '../layout';

type Props = { layout: Layout; weight: number };

/**
 * Card, details and CTA only. The hands live on their own WebGL canvas above
 * this markup so the ripple shader never touches the contact details.
 */
export function Contact({ layout, weight }: Props) {
  const enabled = weight > 0.6;
  const c = layout.contact;

  return (
    <section
      className="panel panel--contact"
      style={{ opacity: weight, pointerEvents: enabled ? 'auto' : 'none' }}
      aria-hidden={weight < 0.5}
    >
      <div className="contact__card" style={{ ...c.card }} />

      <div className="contact__details">
        {CONTACT.rows.map((row, i) => (
          <a
            key={row.label}
            className="contact__row"
            href={row.href}
            style={{ top: c.rows[i], height: c.rowH, fontSize: c.rowFont }}
            tabIndex={enabled ? 0 : -1}
          >
            {row.label}
          </a>
        ))}

        <a
          className="contact__row contact__row--insta"
          href={CONTACT.instagram.href}
          target="_blank"
          rel="noreferrer noopener"
          style={{ top: c.instaY, height: c.rowH, fontSize: c.rowFont }}
          tabIndex={enabled ? 0 : -1}
        >
          <span
            className="contact__insta-mark"
            style={{
              width: c.instaMark,
              height: c.instaMark,
              borderWidth: Math.max(1, 2 * layout.s),
              borderRadius: 9 * layout.s,
            }}
            aria-hidden
          >
            <span
              style={{
                width: c.instaInner,
                height: c.instaInner,
                borderWidth: Math.max(1, 2 * layout.s),
                borderRadius: 9 * layout.s,
              }}
            />
          </span>
          {CONTACT.instagram.handle}
        </a>

        <a
          className="contact__cta"
          href={CONTACT.rows[0].href}
          style={{
            left: c.cta.left,
            top: c.cta.top,
            width: c.cta.width,
            height: c.cta.height,
            borderRadius: 73 * layout.s,
          }}
          tabIndex={enabled ? 0 : -1}
        >
          <span
            className="contact__cta-face"
            style={{
              width: c.cta.innerW,
              height: c.cta.innerH,
              borderRadius: 73 * layout.s,
              fontSize: c.rowFont,
            }}
          >
            Book A Call
          </span>
        </a>
      </div>
    </section>
  );
}
