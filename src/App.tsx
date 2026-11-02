import { useCallback, useState } from 'react';
import { Header, type View } from './components/Header';
import { Viewer } from './components/Viewer';
import { About } from './sections/About';
import { Contact } from './sections/Contact';
import { Stack } from './sections/Stack';
import type { Project } from './data/projects';

export default function App() {
  const [view, setView] = useState<View>('work');
  const [open, setOpen] = useState<Project | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <div className="app">
      <Header
        view={view}
        onView={(v) => {
          setOpen(null);
          setView(v);
        }}
      />
      <main className="main">
        <Stack onOpen={setOpen} hidden={view !== 'work'} />
        <About hidden={view !== 'about'} />
        <Contact hidden={view !== 'contact'} />
      </main>
      <Viewer project={open} onChange={setOpen} onClose={close} />
    </div>
  );
}
