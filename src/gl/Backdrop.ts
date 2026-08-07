import {
  BAYER_GLSL,
  blankTexture,
  imageTexture,
  loadImage,
  program,
  quad,
  uniforms,
  type GL,
} from './glutil';
import { TrailField } from './trail';

const VS = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }
`;

const FS = /* glsl */ `
precision highp float;

uniform vec2  uRes;       // drawing buffer size, device px
uniform float uDpr;
uniform float uTime;
uniform sampler2D uTrail; // cursor flow field, see trail.ts

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec2  uSizeA;
uniform vec2  uSizeB;
uniform float uMix;       // A -> B crossfade of the backdrop plate

uniform float uWork;      // section weights, always summing to 1
uniform float uAbout;
uniform float uContact;
uniform float uSplit;     // x of the About panel edge, device px

uniform vec3  uAccent;
uniform float uCell;      // base pattern cell, css px
uniform float uReveal;    // 0 -> 1 on first load
uniform float uMode;      // 0 dither, 1 halftone

${BAYER_GLSL}

// Cover-fit: fill the viewport, crop the overflowing axis.
vec2 coverUV(vec2 p, vec2 res, vec2 tex) {
  float ra = res.x / max(res.y, 1.0);
  float ta = tex.x / max(tex.y, 1.0);
  vec2 k = ra > ta ? vec2(1.0, ta / ra) : vec2(ra / ta, 1.0);
  vec2 uv = (p / res - 0.5) * k + 0.5;
  // gl_FragCoord counts up from the bottom; texture rows count down from the
  // top. Without this the plate renders upside down.
  return vec2(uv.x, 1.0 - uv.y);
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Crossfaded colour of the plate at one point, in device pixels.
vec3 plateColor(vec2 pt) {
  vec3 a = texture2D(uTexA, coverUV(pt, uRes, uSizeA)).rgb;
  vec3 b = texture2D(uTexB, coverUV(pt, uRes, uSizeB)).rgb;
  return mix(a, b, uMix);
}

float plate(vec2 pt) { return luma(plateColor(pt)); }

float ambient(vec2 p) {
  return sin(p.x * 0.0062 / uDpr + uTime * 0.55)
       * sin(p.y * 0.0051 / uDpr - uTime * 0.41)
       + 0.45 * sin((p.x + p.y) * 0.0031 / uDpr + uTime * 0.9);
}

void main() {
  vec2 frag = gl_FragCoord.xy;

  // ---- cursor field -------------------------------------------------------
  // Restrained on purpose: the pointer nudges the surface along the flow it has
  // stirred up. No rings, no shockwave. See trail.ts for the strength dial.
  vec4  tr     = texture2D(uTrail, frag / uRes);
  vec2  flow   = (tr.rg - 0.5) * 2.0;
  float energy = tr.b;

  // Each branch below produces two things: the finished Work tone, and a 0..1
  // coverage the accent panel is patterned with.
  vec3 cWork;
  vec3 coverage;

  if (uMode < 0.5) {
    // ---- Dither: 1 bit through an 8x8 ordered Bayer matrix ----------------
    vec2  warp = flow * 14.0 * uDpr;
    float push = energy * 0.07;
    float cell = uCell * uDpr * (1.0 + 0.10 * energy);

    // Chromatic aberration: the channels read the grid at slightly different
    // points along the flow, so it fringes only where the surface is disturbed.
    vec2 split = flow * 9.0 * uDpr;
    vec2 gR = floor((frag + warp - split) / cell);
    vec2 gG = floor((frag + warp) / cell);
    vec2 gB = floor((frag + warp + split) / cell);

    vec2 tap = (gG + 0.5) * cell;
    vec3 Lc = vec3(plate((gR + 0.5) * cell), plate(tap), plate((gB + 0.5) * cell));
    vec3 th = vec3(bayer8(gR), bayer8(gG), bayer8(gB));
    float n = ambient(tap);

    // The gamma lift keeps dark clips from collapsing to a near-black page.
    vec3 v = clamp(pow(clamp(Lc, 0.0, 1.0), vec3(0.72)) + push * 0.16 + n * 0.03, 0.0, 1.0);
    vec3 m = step(th, v);
    cWork = mix(vec3(0.02 + Lc.g * 0.07), vec3(0.20 + Lc.g * 0.34), m);
    coverage = step(th, vec3(clamp(0.60 + n * 0.09 + push * 0.24, 0.0, 1.0)));

  } else {
    // ---- Halftone: circular dots on a rotated screen ----------------------
    const float ang = 0.3926991;               // 22.5 degrees
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    mat2 inv = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));

    float cell = uCell * 2.6 * uDpr * (1.0 + 0.22 * energy);
    vec2 hp = (rot * (frag + flow * 16.0 * uDpr)) / cell;
    vec2 id = floor(hp) + 0.5;
    vec2 centre = inv * (id * cell);

    float L = plate(centre);
    float n = ambient(centre);
    float d = length(hp - id) * 2.0;            // 0 at the dot's centre

    // Coverage drives the dot's radius, so tone survives as dot area.
    float r = sqrt(clamp(pow(clamp(L, 0.0, 1.0), 0.8) + n * 0.03 + energy * 0.06, 0.0, 1.0));
    float ca = energy * 0.22;                   // per-channel radius offset
    vec3 m = vec3(
      smoothstep(r + ca + 0.09, r + ca - 0.09, d),
      smoothstep(r + 0.09, r - 0.09, d),
      smoothstep(r - ca + 0.09, r - ca - 0.09, d)
    );

    cWork = mix(vec3(0.02 + L * 0.05), vec3(0.22 + L * 0.36), m);

    float rp = sqrt(clamp(0.62 + n * 0.09 + energy * 0.22, 0.0, 1.0));
    coverage = vec3(smoothstep(rp + 0.09, rp - 0.09, d));
  }

  vec3 cAccent = mix(uAccent * 0.72, uAccent, coverage);
  vec3 flat_ = vec3(0.945);

  // About: the pattern is confined to the accent half. The reading side is flat
  // paper, with no texture and no cursor response — and so is Contact, which
  // keeps its plain grey so only the hands carry the effect.
  float onPanel = 1.0 - smoothstep(uSplit - 1.0, uSplit + 1.0, frag.x);
  vec3 cAbout = mix(flat_, cAccent, onPanel);

  vec3 col = cWork * uWork + cAbout * uAbout + flat_ * uContact;

  gl_FragColor = vec4(col * uReveal, 1.0);
}
`;

export type Weights = { work: number; about: number; contact: number };

export class Backdrop {
  private gl: GL;
  private u: (n: string) => WebGLUniformLocation | null;
  private texA: WebGLTexture;
  private texB: WebGLTexture;
  private sizeA: [number, number] = [1, 1];
  private sizeB: [number, number] = [1, 1];
  private mix = 1;
  private currentSrc = '';
  private srcToken = 0;
  /** Live source for the incoming plate, uploaded once per frame. */
  private video: HTMLVideoElement | null = null;

  private trail: TrailField;
  private quadBuf: WebGLBuffer;
  private attrib: number;
  private prog: WebGLProgram;

  private weights: Weights = { work: 1, about: 0, contact: 0 };
  private accent: [number, number, number] = [1, 0.22, 0.22];
  private mode = 0;
  private reveal = 0;
  private raf = 0;
  private t0 = performance.now();
  private last = this.t0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    this.prog = program(gl, VS, FS);
    gl.useProgram(this.prog);
    this.u = uniforms(gl, this.prog);

    this.quadBuf = quad(gl);
    this.attrib = gl.getAttribLocation(this.prog, 'aPos');
    this.trail = new TrailField(gl, this.quadBuf);

    this.texA = blankTexture(gl);
    this.texB = blankTexture(gl);
    gl.useProgram(this.prog);
    gl.uniform1i(this.u('uTexA'), 0);
    gl.uniform1i(this.u('uTexB'), 1);
    gl.uniform1i(this.u('uTrail'), 2);

    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  /**
   * Point the backdrop at a project: crossfade to its poster frame, then let
   * the clip itself take over as soon as it has data. The poster is decoded
   * *before* the swap so the outgoing plate stays on screen until the incoming
   * one is ready — the crossfade never flashes.
   */
  async setSource(posterSrc: string, video: HTMLVideoElement | null) {
    if (posterSrc === this.currentSrc) return;
    this.currentSrc = posterSrc;
    const token = ++this.srcToken;
    const img = await loadImage(posterSrc).catch(() => null);
    if (!img || token !== this.srcToken) return;

    const gl = this.gl;
    // Stop feeding the previous clip into the texture we are about to retire.
    this.video = null;
    // Whatever was incoming becomes the outgoing plate — including, if a clip
    // was playing, its last decoded frame.
    gl.deleteTexture(this.texA);
    this.texA = this.texB;
    this.sizeA = this.sizeB;
    this.texB = imageTexture(gl, img);
    this.sizeB = [img.naturalWidth, img.naturalHeight];
    this.mix = 0;
    this.video = video;
  }

  setWeights(w: Weights) {
    this.weights = w;
  }

  setAccent(rgb: [number, number, number]) {
    this.accent = rgb;
  }

  setMode(mode: number) {
    this.mode = mode;
  }

  pointer(x: number, y: number, inside: boolean) {
    this.trail.pointer(x, y, this.canvas.clientWidth, this.canvas.clientHeight, inside);
  }

  impulse() {
    this.trail.impulse();
  }

  private dpr() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  resize = () => {
    const dpr = this.dpr();
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
  };

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const gl = this.gl;
    const dt = Math.min(Math.max((now - this.last) / 1000, 1 / 240), 1 / 20);
    this.last = now;

    this.resize();

    this.mix = Math.min(1, this.mix + dt * 1.6);
    this.reveal = Math.min(1, this.reveal + dt * 1.1);

    this.trail.update(dt, this.canvas.width / Math.max(this.canvas.height, 1));

    const dpr = this.dpr();
    gl.useProgram(this.prog);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.attrib);
    gl.vertexAttribPointer(this.attrib, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.u('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u('uDpr'), dpr);
    gl.uniform1f(this.u('uTime'), (now - this.t0) / 1000);
    gl.uniform1f(this.u('uMix'), this.mix);
    gl.uniform2f(this.u('uSizeA'), this.sizeA[0], this.sizeA[1]);
    gl.uniform2f(this.u('uSizeB'), this.sizeB[0], this.sizeB[1]);
    gl.uniform1f(this.u('uWork'), this.weights.work);
    gl.uniform1f(this.u('uAbout'), this.weights.about);
    gl.uniform1f(this.u('uContact'), this.weights.contact);
    gl.uniform1f(this.u('uSplit'), this.canvas.width * 0.5);
    gl.uniform3fv(this.u('uAccent'), this.accent);
    gl.uniform1f(this.u('uCell'), 3.0);
    gl.uniform1f(this.u('uReveal'), this.reveal);
    gl.uniform1f(this.u('uMode'), this.mode);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texB);
    // Push the current video frame into the incoming plate.
    const v = this.video;
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      this.sizeB = [v.videoWidth, v.videoHeight];
    }
    gl.uniform2f(this.u('uSizeB'), this.sizeB[0], this.sizeB[1]);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.trail.texture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  /**
   * Only the loop is torn down. The context is deliberately left alive: a
   * canvas hands back the same context object forever, so killing it here
   * would poison a re-mount (React StrictMode does exactly that in dev).
   */
  dispose() {
    cancelAnimationFrame(this.raf);
    this.gl.deleteTexture(this.texA);
    this.gl.deleteTexture(this.texB);
  }
}
