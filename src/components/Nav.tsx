import { lerp } from '../design';
import type { Layout } from '../layout';
import type { Section } from '../types';

const ITEMS: { id: Section; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

const INDEX: Record<Section, number> = { work: 0, about: 1, contact: 2 };

type Props = {
  layout: Layout;
  from: Section;
  to: Section;
  t: number;
  /** 0 = ink on paper, 1 = white on a dark or accent field. */
  onDark: number;
  onGo: (s: Section) => void;
};

export function Nav({ layout, from, to, t, onDark, onGo }: Props) {
  const { nav } = layout;
  const a = nav.rules[INDEX[from]];
  const b = nav.rules[INDEX[to]];
  const rule = {
    left: lerp(a.left, b.left, t),
    width: lerp(a.width, b.width, t),
  };

  // #1d1d1d -> #ffffff, so the row reads on both the plate and the paper.
  const ink = Math.round(lerp(29, 255, onDark));
  const color = `rgb(${ink} ${ink} ${ink})`;

  return (
    <nav className="nav" style={{ color }} aria-label="Sections">
      {ITEMS.map((item, i) => (
        <button
          key={item.id}
          type="button"
          className="nav__item"
          style={{
            left: nav.lefts[i],
            top: nav.top,
            width: nav.itemW,
            height: nav.itemH,
            fontSize: nav.font,
          }}
          aria-current={to === item.id ? 'page' : undefined}
          onClick={() => onGo(item.id)}
        >
          {item.label}
        </button>
      ))}
      <span
        className="nav__rule"
        style={{
          left: rule.left,
          width: rule.width,
          top: nav.ruleTop,
          height: Math.max(1, 1.6 * layout.s),
          background: color,
        }}
        aria-hidden
      />
    </nav>
  );
}
