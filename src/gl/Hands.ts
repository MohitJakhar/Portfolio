import {
  BAYER_GLSL,
  imageTexture,
  loadImage,
  program,
  quad,
  uniforms,
  type GL,
} from './glutil';
import { TrailField } from './trail';

/**
 * The two Creation-of-Adam hands on the Contact slide, drawn on their own
 * transparent canvas that sits above the card. Keeping them here is what makes
 * the water shader apply to the hands and not to the contact details: the text
 * is plain DOM underneath and never enters this pass.
 *
 * The water is a trail field rather than concentric rings. A small ping-pong
 * buffer holds a displacement vector plus an energy value per pixel; the
 * pointer paints its own velocity into it, the field self-advects and decays,
 * and the hand pass reads it back as a UV displacement plus a highlight. The
 * result lags behind the cursor and keeps flowing after it stops, the way a
 * disturbed liquid surface does.
 */

const HAND_VS = /* glsl */ `
attribute vec2 aPos;
uniform vec2  uRes;      // device px
uniform vec2  uSize;     // sprite size, device px
uniform vec2  uOrigin;   // sprite centre, device px, origin top-left
uniform float uRot;      // radians
varying vec2 vUv;
void main() {
  // aPos.y = 0 lands at the top of the sprite (clip.y is negated below), so the
  // texture's first row must map to v = 0 or the hand comes out upside down.
  vUv = aPos;
  vec2 p = (aPos - 0.5) * uSize;
  float c = cos(uRot), s = sin(uRot);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + uOrigin;
  vec2 clip = (p / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const HAND_FS = /* glsl */ `
precision highp float;

uniform sampler2D uTex;
uniform sampler2D uTrail;
uniform vec2  uRes;
uniform vec2  uSize;     // device px
uniform float uRot;
uniform float uDpr;
uniform float uTime;
uniform float uAlpha;
uniform float uCell;
uniform vec3  uAccent;
uniform float uTint;
uniform float uMode;     // 0 dither, 1 halftone
uniform float uQuality;  // 1 = chromatic aberration; 0 = single-tap phone path

varying vec2 vUv;

${BAYER_GLSL}

// Sprite-local UV for a screen-space offset in device px (undoes the rotation).
vec2 toLocal(vec2 offsetPx) {
  float c = cos(-uRot), s = sin(-uRot);
  vec2 r = vec2(offsetPx.x * c - offsetPx.y * s, offsetPx.x * s + offsetPx.y * c);
  return vec2(r.x, -r.y) / uSize;
}

vec4 tap(vec2 uv) {
  return texture2D(uTex, clamp(uv, vec2(0.001), vec2(0.999)));
}

void main() {
  vec2 frag = gl_FragCoord.xy;

  vec4 tr = texture2D(uTrail, frag / uRes);
  vec2 flow = (tr.rg - 0.5) * 2.0;
  float energy = tr.b;

  // A swell rides on top of the disturbance, scaled by the field's own energy:
  // with nothing stirring the water every term below is exactly zero and the
  // hand renders as the plain treatment of the original image.
  float swell = (sin((frag.x * 0.010 + frag.y * 0.006) / uDpr + uTime * 1.05) * 0.5
              +  sin((frag.x * 0.006 - frag.y * 0.012) / uDpr - uTime * 0.78) * 0.5)
              * energy;

  // normalize() is unusable near zero — it would hand back an arbitrary
  // direction and shear the hand while the water is nominally still.
  float fl = length(flow);
  vec2 dir = fl > 1e-3 ? flow / fl : vec2(0.0);
  vec2 dispPx = flow * 52.0 * uDpr
              + dir * sin(energy * 22.0 - uTime * 4.2) * energy * 4.5 * uDpr
              + vec2(swell, swell * 0.55) * 1.6 * uDpr;

  vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (uMode < 0.5) {
    // ---- Dither -----------------------------------------------------------
    // Snap to the grid so the dots stay put while the image slides underneath.
    float cell = uCell * uDpr * (1.0 + 0.55 * energy);
    vec2 gridId = floor((frag + dispPx) / cell);
    vec2 uv = vUv + toLocal((gridId + 0.5) * cell - frag + dispPx);

    vec4 tG = tap(uv);
    // Alpha from the centre tap alone: letting the split channels widen the
    // silhouette sprays stray coloured fragments outside the hand.
    alpha = tG.a;
    if (alpha < 0.02) discard;

    vec3 Lc;
    if (uQuality > 0.5) {
      vec2 su = toLocal(flow * 4.5 * uDpr);
      Lc = vec3(dot(tap(uv - su).rgb, W), dot(tG.rgb, W), dot(tap(uv + su).rgb, W));
    } else {
      Lc = vec3(dot(tG.rgb, W));
    }
    Lc = clamp((Lc - 0.26) / 0.60, 0.0, 1.0);
    Lc = clamp(Lc + flow.x * 0.55 + energy * 0.22 + swell * 0.04, 0.0, 1.0);

    vec3 m = step(vec3(bayer8(gridId)), Lc);
    col = mix(vec3(0.11), mix(vec3(0.96), uAccent, uTint * 0.35), m);

  } else {
    // ---- Halftone ---------------------------------------------------------
    float ang = 0.3926991;                     // 22.5 degrees
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    mat2 inv = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));

    float cell = uCell * 2.6 * uDpr * (1.0 + 0.22 * energy);
    vec2 hp = (rot * (frag + dispPx)) / cell;
    vec2 id = floor(hp) + 0.5;
    vec2 centre = inv * (id * cell);
    vec2 uv = vUv + toLocal(centre - frag + dispPx);

    vec4 tG = tap(uv);
    alpha = tG.a;
    if (alpha < 0.02) discard;

    float L = clamp((dot(tG.rgb, W) - 0.26) / 0.60, 0.0, 1.0);
    L = clamp(L + flow.x * 0.45 + energy * 0.20, 0.0, 1.0);

    float d = length(hp - id) * 2.0;           // 0 at the dot's centre
    float r = sqrt(L);                         // tone survives as dot area
    float ca = energy * 0.22;
    vec3 m = vec3(
      smoothstep(r + ca + 0.09, r + ca - 0.09, d),
      smoothstep(r + 0.09, r - 0.09, d),
      smoothstep(r - ca + 0.09, r - ca - 0.09, d)
    );
    col = mix(vec3(0.11), mix(vec3(0.96), uAccent, uTint * 0.35), m);
  }

  gl_FragColor = vec4(col, alpha * uAlpha);
}
`;

export type HandPlacement = {
  /** Sprite centre in CSS px, origin top-left. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Degrees. */
  rot: number;
  alpha: number;
};

type Sprite = { tex: WebGLTexture | null; place: HandPlacement };

export class Hands {
  private gl: GL;
  private handProg: WebGLProgram;
  private uh: (n: string) => WebGLUniformLocation | null;
  private trail: TrailField;
  private quadBuf: WebGLBuffer;
  private attrib: number;

  private sprites: Sprite[] = [];

  private accent: [number, number, number] = [1, 0.22, 0.22];
  private tint = 0;
  private mode = 0;
  private quality = 1;
  private renderScale = Math.min(window.devicePixelRatio || 1, 2);
  private raf = 0;
  private t0 = performance.now();
  private last = this.t0;

  constructor(
    private canvas: HTMLCanvasElement,
    sources: string[],
  ) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    this.handProg = program(gl, HAND_VS, HAND_FS);
    this.uh = uniforms(gl, this.handProg);
    this.quadBuf = quad(gl);
    this.attrib = gl.getAttribLocation(this.handProg, 'aPos');
    this.trail = new TrailField(gl, this.quadBuf);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.sprites = sources.map(() => ({
      tex: null,
      place: { cx: 0, cy: 0, w: 0, h: 0, rot: 0, alpha: 0 },
    }));

    sources.forEach((src, i) => {
      loadImage(src)
        .then((img) => {
          const tex = imageTexture(gl, img);
          // The instance may already have been disposed (StrictMode remount).
          if (this.sprites[i]) this.sprites[i].tex = tex;
          else gl.deleteTexture(tex);
        })
        .catch(() => {
          /* a missing hand simply doesn't draw */
        });
    });

    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  place(i: number, p: HandPlacement) {
    if (this.sprites[i]) this.sprites[i].place = p;
  }

  setAccent(rgb: [number, number, number], tint: number) {
    this.accent = rgb;
    this.tint = tint;
  }

  setMode(mode: number) {
    this.mode = mode;
  }

  setQuality(opts: { renderScale: number; cheap: boolean }) {
    this.renderScale = opts.renderScale;
    this.quality = opts.cheap ? 0 : 1;
  }

  pointer(x: number, y: number, inside: boolean) {
    this.trail.pointer(x, y, this.canvas.clientWidth, this.canvas.clientHeight, inside);
  }

  impulse() {
    this.trail.impulse();
  }

  private dpr() {
    return this.renderScale;
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

    this.trail.update(dt, this.canvas.width / Math.max(this.canvas.height, 1));

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const visible = this.sprites.some((s) => s.tex && s.place.alpha > 0.001);
    if (!visible) return;

    const dpr = this.dpr();
    gl.useProgram(this.handProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.attrib);
    gl.vertexAttribPointer(this.attrib, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.uh('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uh('uDpr'), dpr);
    gl.uniform1f(this.uh('uTime'), (now - this.t0) / 1000);
    gl.uniform1f(this.uh('uCell'), 3.0);
    gl.uniform3fv(this.uh('uAccent'), this.accent);
    gl.uniform1f(this.uh('uTint'), this.tint);
    gl.uniform1f(this.uh('uMode'), this.mode);
    gl.uniform1f(this.uh('uQuality'), this.quality);
    gl.uniform1i(this.uh('uTex'), 0);
    gl.uniform1i(this.uh('uTrail'), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.trail.texture);

    for (const s of this.sprites) {
      if (!s.tex || s.place.alpha <= 0.001) continue;
      const { cx, cy, w, h, rot, alpha } = s.place;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform2f(this.uh('uSize'), w * dpr, h * dpr);
      gl.uniform2f(this.uh('uOrigin'), cx * dpr, cy * dpr);
      gl.uniform1f(this.uh('uRot'), (rot * Math.PI) / 180);
      gl.uniform1f(this.uh('uAlpha'), alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };

  /** See Backdrop.dispose — the context outlives the instance on purpose. */
  dispose() {
    cancelAnimationFrame(this.raf);
    for (const s of this.sprites) if (s.tex) this.gl.deleteTexture(s.tex);
    this.sprites = [];
  }
}
