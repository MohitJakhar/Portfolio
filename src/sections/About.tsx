import { asset } from '../asset';
import type { Layout } from '../layout';

type Props = { layout: Layout; weight: number };

/**
 * The accent half-panel and its dot field are drawn by the backdrop shader, so
 * this section is only the body copy and the three tool marks that sit inline
 * in it. The reading half stays deliberately flat and non-reactive.
 */
export function About({ layout, weight }: Props) {
  const { aboutCopy } = layout;
  return (
    <section
      className="panel panel--about"
      style={{ opacity: weight, pointerEvents: weight > 0.6 ? 'auto' : 'none' }}
      aria-hidden={weight < 0.5}
    >
      <div
        className="about__copy"
        style={{
          left: aboutCopy.left,
          width: aboutCopy.width,
          fontSize: aboutCopy.font,
          // On a phone the copy sits below the accent band rather than being
          // centred against it.
          ...(layout.compact ? { top: aboutCopy.top, transform: 'none' } : null),
        }}
      >
        <p>
          I make things move. My days run through Figma{' '}
          <img className="about__tool" src={asset('img/figma.png')} alt="Figma" />, After Effects{' '}
          <img className="about__tool" src={asset('img/after-effects.png')} alt="After Effects" />{' '}
          and DaVinci Resolve{' '}
          <img className="about__tool" src={asset('img/resolve.png')} alt="DaVinci Resolve" />, and my
          evenings usually involve a motorcycle, a film, or a long detour through somebody
          else&rsquo;s paintings. All three keep turning up in the work, whether I plan it or not.
        </p>
      </div>
    </section>
  );
}
