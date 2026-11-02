import { useEffect, useRef, useState } from 'react';
import { DRIVE, type DriveVideo } from '../data/drive';
import { projects, type Project } from '../data/projects';

/** A Drive filename as a readable title: no extension, no underscores. */
const nameOf = (v: DriveVideo) =>
  v.name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/;/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

const formatOf = (aspect: number) =>
  aspect > 1.5 ? '16:9' : aspect < 0.65 ? '9:16' : aspect > 0.95 && aspect < 1.05 ? '1:1' : '4:5';

const thumb = (v: DriveVideo) => `https://drive.google.com/thumbnail?id=${v.id}&sz=w480`;

type Props = { project: Project; onProject: (p: Project) => void; onBack: () => void };

/**
 * One project: its full-length videos, played from the project's shared Drive
 * folder in Drive's own player (see tools/drive.py). Opens on the video the
 * work view's clip was cut from.
 */
export function ProjectPage({ project, onProject, onBack }: Props) {
  const videos = DRIVE[project.slug] ?? [];
  const first = Math.max(
    0,
    videos.findIndex((v) => v.name === project.source),
  );
  const [current, setCurrent] = useState(first);
  const pageRef = useRef<HTMLElement>(null);

  // A new project starts on its own main video, at the top of the page.
  useEffect(() => {
    setCurrent(first);
    pageRef.current?.scrollTo({ top: 0 });
  }, [project.slug, first]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const i = projects.indexOf(project);
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const v = videos[current];

  const play = (k: number) => {
    setCurrent(k);
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section ref={pageRef} className="page project" aria-labelledby="project-title">
      <h1 id="project-title" className="page__statement project__title">
        {project.title.toLowerCase()}
      </h1>

      <div className="project__meta">
        <button type="button" className="project__back" onClick={onBack}>
          ← Back to work
        </button>
        <p>
          {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          <br />
          <span>Full length, from the project folder</span>
        </p>
      </div>

      {v ? (
        <figure className="project__player">
          <div
            className="project__frame"
            style={{ ['--aspect' as string]: String(v.aspect) }}
          >
            <iframe
              key={v.id}
              src={`https://drive.google.com/file/d/${v.id}/preview`}
              title={nameOf(v)}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
          <figcaption>
            {nameOf(v)}
            <span>{formatOf(v.aspect)}</span>
          </figcaption>
        </figure>
      ) : (
        <p className="project__empty">No videos in this project&rsquo;s folder yet.</p>
      )}

      {videos.length > 1 && (
        <div className="project__more">
          <h2 className="page__label">More from this project</h2>
          <ul>
            {videos.map((x, k) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={k === current ? 'is-on' : ''}
                  aria-current={k === current ? 'true' : undefined}
                  onClick={() => play(k)}
                >
                  <span className="project__thumb">
                    <img src={thumb(x)} alt="" referrerPolicy="no-referrer" decoding="async" />
                  </span>
                  <span className="project__name">{nameOf(x)}</span>
                  <span className="project__format">{formatOf(x.aspect)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="project__nav" aria-label="Other projects">
        <button type="button" onClick={() => onProject(prev)}>
          <span>Previous</span>
          {prev.title}
        </button>
        <button type="button" onClick={() => onProject(next)}>
          <span>Next</span>
          {next.title}
        </button>
      </nav>
    </section>
  );
}
