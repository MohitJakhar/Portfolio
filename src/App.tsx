import { useCallback, useEffect, useState } from 'react';
import { Header, type View } from './components/Header';
import { About } from './sections/About';
import { Contact } from './sections/Contact';
import { ProjectPage } from './sections/ProjectPage';
import { Stack } from './sections/Stack';
import { projects, type Project } from './data/projects';

type Route = { view: View; project: Project | null };

/**
 * The address is the route, in the hash so GitHub Pages needs no rewrites:
 * `#about`, `#contact`, `#project/<slug>`, or nothing for the work view. The
 * back button and shared links both work.
 */
const parse = (hash: string): Route => {
  const h = hash.replace(/^#\/?/, '');
  if (h === 'about' || h === 'contact') return { view: h, project: null };
  const m = /^project\/([\w-]+)$/.exec(h);
  const p = m ? projects.find((x) => x.slug === m[1]) : undefined;
  return { view: 'work', project: p ?? null };
};

const go = (hash: string) => {
  if (window.location.hash !== hash) window.location.hash = hash;
};

export default function App() {
  const [route, setRoute] = useState(() => parse(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openProject = useCallback((p: Project) => go(`#project/${p.slug}`), []);
  const back = useCallback(() => go('#work'), []);

  const { view, project } = route;

  return (
    <div className="app">
      <Header view={view} onView={(v) => go(`#${v}`)} />
      <main className="main">
        <Stack onOpen={openProject} hidden={view !== 'work' || project !== null} />
        <About hidden={view !== 'about'} />
        <Contact hidden={view !== 'contact'} />
        {project && <ProjectPage project={project} onProject={openProject} onBack={back} />}
      </main>
    </div>
  );
}
