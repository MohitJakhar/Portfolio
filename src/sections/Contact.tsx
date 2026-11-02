import { CONTACT } from '../data/contact';

export function Contact({ hidden }: { hidden: boolean }) {
  return (
    <section className="page contact" aria-labelledby="contact-title" hidden={hidden}>
      <h1 id="contact-title" className="page__statement">
        <a href={CONTACT.email.href}>Book a call.</a>
      </h1>

      <p className="page__left contact__note">
        For projects and collaborations.
        <br />
        Email is quickest.
      </p>

      <div className="page__right">
        <h2 className="page__label">Contact</h2>
        <dl className="contact__list">
          <div>
            <dt>Email</dt>
            <dd>
              <a href={CONTACT.email.href}>{CONTACT.email.label}</a>
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={CONTACT.phone.href}>{CONTACT.phone.label}</a>
            </dd>
          </div>
          <div>
            <dt>Instagram</dt>
            <dd>
              <a href={CONTACT.instagram.href} target="_blank" rel="noreferrer noopener">
                {CONTACT.instagram.label}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
