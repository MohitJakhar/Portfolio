import { useEffect, useRef } from 'react';
import { formatOf, mp4, poster, projects, webm, type Project } from '../data/projects';

type Props = {
  project: Project | null;
  onChange: (next: Project) => void;
  onClose: () => void;
};

/** One project, flat and large, with sound controls. */
export function Viewer({ project, onChange, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = (dir: number) => {
    if (!project) return;
    const i = projects.indexOf(project);
    onChange(projects[(i + dir + projects.length) % projects.length]);
  };

  useEffect(() => {
    if (!project) return;
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => back?.focus?.();
  }, [Boolean(project)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Muted so the browser lets it autoplay; the controls carry the sound.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !project) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, [project]);

  if (!project) return null;
  const small = window.matchMedia('(max-width: 760px)').matches;

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={project.title}>
      <div className="viewer__frame" style={{ ['--aspect' as string]: String(project.aspect) }}>
        <video
          key={project.slug}
          ref={videoRef}
          poster={poster(project, small)}
          controls
          loop
          playsInline
        >
          <source src={webm(project, small)} type="video/webm" />
          <source src={mp4(project, small)} type="video/mp4" />
        </video>
      </div>

      <div className="viewer__bar">
        <p>
          {project.title}
          <br />
          <span>
            {formatOf(project)}
          </span>
        </p>
        <div className="viewer__nav">
          <button type="button" onClick={() => step(-1)}>
            Prev
          </button>
          <button type="button" onClick={() => step(1)}>
            Next
          </button>
          <button ref={closeRef} type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
