import { lerpBox, type Layout } from '../layout';
import type { Section } from '../types';

type Props = {
  layout: Layout;
  from: Section;
  to: Section;
  t: number;
  /** Weight of the Work section — drives the accent wash over the cap. */
  work: number;
  /** Weight of Contact, where both of these elements have left the frame. */
  contact: number;
};

/**
 * The cap photo and the name block exist once for the whole site and are simply
 * re-positioned between sections. That is what makes Work -> About seamless:
 * the <img> is never unmounted, so the browser never re-decodes or re-requests
 * the asset — it only ever animates.
 */
export function SharedLayer({ layout, from, to, t, work, contact }: Props) {
  const cap = lerpBox(layout.cap[from], layout.cap[to], t);
  const id = lerpBox(layout.identity[from], layout.identity[to], t);
  const present = 1 - contact;

  return (
    <div className="shared" aria-hidden={contact > 0.5}>
      <figure className="cap" style={{ ...cap, opacity: present }}>
        <img src="/img/cap.jpg" alt="A cap reading “I'm lazy, need to sleep more”" />
        <span className="cap__wash" style={{ opacity: work }} />
      </figure>

      {/* The frame centres this block inside its 106px box, which is what puts
          the name clear of the cap's bottom edge rather than flush against it. */}
      <div className="identity" style={{ ...id, opacity: present }}>
        <p className="identity__name" style={{ fontSize: layout.identity.name }}>
          Mohit Jakhar
        </p>
        <p className="identity__role" style={{ fontSize: layout.identity.role }}>
          Motion Graphics Designer
        </p>
      </div>
    </div>
  );
}
