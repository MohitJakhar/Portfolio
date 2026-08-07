/**
 * One entry per folder in the shared Drive "Portfolio" root.
 * `driveFolderId` is kept so the per-project pages can enumerate the rest of
 * each folder later — for now a single representative clip is used.
 */
export type Project = {
  slug: string;
  title: string;
  driveFolderId: string;
  /** Source filename inside the Drive folder, for traceability. */
  source: string;
  /** Intrinsic aspect ratio (w / h) of the clip. */
  aspect: number;
};

export const projects: Project[] = [
  {
    slug: 'personal',
    title: 'Personal',
    driveFolderId: '1NpkBJqsM5s9fS8cTggCN4GlgzVusEIBy',
    source: 'eden.mp4',
    aspect: 1080 / 1350,
  },
  {
    slug: 'miscellaneous',
    title: 'Miscellaneous',
    driveFolderId: '1zL7mM-qCcj2chC2tKs5sJ26AjH9Io7nx',
    source: 'showreel-updated-15th-jan.webm',
    aspect: 16 / 9,
  },
  {
    slug: 'amazon',
    title: 'Amazon',
    driveFolderId: '1NVexNEWNzFpW3-Ogo51WKU9WmoeqanS-',
    source: 'swipe.mp4',
    aspect: 2160 / 3840,
  },
  {
    slug: 'gangour',
    title: 'Gangour',
    driveFolderId: '1azF1MaAbCg1-tt-l9frOyEZSSgRxh6Eh',
    source: 'compilation.mp4',
    aspect: 1080 / 1350,
  },
  {
    slug: 'hsbc',
    title: 'HSBC',
    driveFolderId: '1fR_KWLEgFHyg3S7jk8sh968A3D04JHBQ',
    source: 'Hsbc Announcement _16;9_0702.mp4',
    aspect: 16 / 9,
  },
  {
    slug: 'netar',
    title: 'Netar',
    driveFolderId: '1QlQzckZfeoAlY9lonjQ1WYajd15NGIsD',
    source: 'Netar kyoorius 2.mp4',
    aspect: 16 / 9,
  },
  {
    slug: 'pair',
    title: 'Pair',
    driveFolderId: '1z-suWly7E74Zz0hHUkAhtooUpEgKIY7B',
    source: 'pair june 4.mp4',
    aspect: 1080 / 1920,
  },
  {
    slug: 'presentations-ai',
    title: 'Presentations AI',
    driveFolderId: '1iV0hLshMwBvskWU_YeFwWbp0jlxvSpV4',
    source: 'enterprise video_16-9_40secs.mp4',
    aspect: 16 / 9,
  },
  {
    slug: 'sycamore',
    title: 'Sycamore',
    driveFolderId: '1G33TSmJPSgVO0EFQE3XnEyWMgzrum-T-',
    source: 'Sycamore Video 29 June (1).mov',
    aspect: 16 / 9,
  },
  {
    slug: 'vettam',
    title: 'Vettam',
    driveFolderId: '1Gx1agg0UOQAyRKw9ca_M6Qyw7p4F6AZl',
    source: 'Vettam Product explainer.mp4',
    aspect: 16 / 9,
  },
  {
    slug: 'yu',
    title: 'Yu',
    driveFolderId: '1wQGnEvb6ps9ahzVffTvg9ez2h_nvPpb2',
    source: 'yu awards final.mp4',
    aspect: 16 / 9,
  },
];

export const mp4 = (p: Project) => `/media/video/${p.slug}.mp4`;
export const webm = (p: Project) => `/media/video/${p.slug}.webm`;
export const poster = (p: Project) => `/media/poster/${p.slug}.jpg`;
/** Full-bleed frame used as the backdrop plate behind the dither. */
export const plate = (p: Project) => `/media/poster/${p.slug}-plate.jpg`;

let webmOk: boolean | null = null;

/**
 * Single best source for imperative playback (the backdrop feeds one <video>
 * straight into a GL texture, so it can't use <source> negotiation).
 */
export const bestSrc = (p: Project) => {
  if (webmOk === null) {
    webmOk = !!document
      .createElement('video')
      .canPlayType('video/webm; codecs="vp9"');
  }
  return webmOk ? webm(p) : mp4(p);
};
