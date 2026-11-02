import { asset } from '../asset';

export function About({ hidden }: { hidden: boolean }) {
  return (
    <section className="page about" aria-labelledby="about-title" hidden={hidden}>
      <h1 id="about-title" className="page__statement">
        I make things move.
      </h1>

      <figure className="page__left about__photo">
        <img src={asset('img/cap.jpg')} alt="A cap reading “I'm lazy, need to sleep more”" />
      </figure>

      <div className="page__right">
        <h2 className="page__label">About me</h2>
        <p className="page__body">
          My days run through Figma{' '}
          <img className="about__tool" src={asset('img/figma.png')} alt="Figma" />, After Effects{' '}
          <img className="about__tool" src={asset('img/after-effects.png')} alt="After Effects" />{' '}
          and DaVinci Resolve{' '}
          <img className="about__tool" src={asset('img/resolve.png')} alt="DaVinci Resolve" />.
        </p>
        <p className="page__body">
          My evenings usually involve a motorcycle, a film, or a long detour through somebody
          else&rsquo;s paintings. All three keep turning up in the work, whether I plan it or not.
        </p>
      </div>
    </section>
  );
}
