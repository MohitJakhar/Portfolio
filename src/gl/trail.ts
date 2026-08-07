import { program, setClampLinear, uniforms, type GL } from './glutil';

/**
 * A cursor trail field, shared by the backdrop and the hands so both react to
 * the pointer with the same character.
 *
 * A small ping-pong buffer holds, per pixel, a flow vector (RG, biased around
 * 0.5) and an energy value (B). The pointer paints its own velocity into the
 * field; the field then advects along itself and decays. Consumers read it back
 * as a displacement plus a highlight, which gives the slow liquid lag you get
 * from a disturbed surface rather than the hard concentric ring you get from
 * evaluating sin(distance) directly.
 */

const VS = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }
`;

const FS = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2  uMouse;    // 0..1, y up
uniform vec2  uVel;      // pointer velocity, uv per second
uniform float uAspect;
uniform float uRadius;
uniform float uDecay;
uniform float uActive;
uniform float uSpeed;    // 0 when the pointer is parked
uniform float uErode;    // flat energy loss per frame, tapers the tail
uniform float uStrength; // one dial for how hard the cursor bites
varying vec2 vUv;

void main() {
  vec4 prev = texture2D(uPrev, vUv);
  vec2 flow = (prev.rg - 0.5) * 2.0;
  float energy = prev.b;

  // Read the field from slightly upstream of itself: the disturbance travels.
  vec4 adv = texture2D(uPrev, vUv - flow * 0.0018);
  flow = mix(flow, (adv.rg - 0.5) * 2.0, 0.88);
  energy = mix(energy, adv.b, 0.88);

  // Taper: a flat erosion on top of the multiplicative decay eats the weak tail
  // faster than the strong head, so the trail narrows to a point behind the
  // pointer instead of fading as one uniform blob.
  energy = max(0.0, energy * uDecay - uErode);
  flow *= uDecay * smoothstep(0.0, 0.07, energy);

  vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
  // Gated on pointer speed: a still cursor must not keep pumping the field, or
  // the disturbance under it saturates and freezes there instead of settling.
  float brush = exp(-dot(d, d) / (uRadius * uRadius)) * uActive * uSpeed;

  flow += uVel * brush * 0.85 * uStrength;
  energy += brush * 0.55 * uStrength;

  gl_FragColor = vec4(clamp(flow * 0.5 + 0.5, 0.0, 1.0), clamp(energy, 0.0, 1.0), 1.0);
}
`;

const SIZE = 256;

/**
 * Global intensity of the cursor interaction. Everything downstream — the
 * backdrop's grid warp, the hands' displacement, the aberration, the highlight —
 * reads this field, so this single number scales the whole effect.
 */
const STRENGTH = 0.6;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer };

export class TrailField {
  private prog: WebGLProgram;
  private u: (n: string) => WebGLUniformLocation | null;
  private loc: number;
  private targets: [Target, Target];
  private read = 0;

  /** Pointer in uv space (y up) plus a smoothed velocity in uv/second. */
  private ptr: [number, number] = [-1, -1];
  private prev: [number, number] = [-1, -1];
  private vel: [number, number] = [0, 0];
  private active = 0;
  private click = 0;

  constructor(
    private gl: GL,
    private quad: WebGLBuffer,
  ) {
    this.prog = program(gl, VS, FS);
    this.u = uniforms(gl, this.prog);
    this.loc = gl.getAttribLocation(this.prog, 'aPos');
    this.targets = [this.makeTarget(), this.makeTarget()];
    this.clear();
  }

  private makeTarget(): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    setClampLinear(gl);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }

  /** A neutral field is (0.5, 0.5, 0): no flow, no energy. */
  private clear() {
    const gl = this.gl;
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, SIZE, SIZE);
      gl.clearColor(0.5, 0.5, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** `x`/`y` are CSS pixels relative to the canvas; `w`/`h` its CSS size. */
  pointer(x: number, y: number, w: number, h: number, inside: boolean) {
    if (!inside) {
      this.active = 0;
      return;
    }
    this.ptr = [x / Math.max(w, 1), 1 - y / Math.max(h, 1)];
    if (this.active === 0) this.prev = this.ptr;
    this.active = 1;
  }

  impulse() {
    this.click = 1;
  }

  get texture() {
    return this.targets[this.read].tex;
  }

  /** Advances the field by one frame. Leaves FRAMEBUFFER unbound. */
  update(dt: number, aspect: number) {
    const gl = this.gl;
    this.click = Math.max(0, this.click - dt * 1.4);

    const rawVx = (this.ptr[0] - this.prev[0]) / dt;
    const rawVy = (this.ptr[1] - this.prev[1]) / dt;
    this.prev = [this.ptr[0], this.ptr[1]];
    // Smooth so one fast frame can't punch a hole in the field.
    const k = 1 - Math.pow(0.0005, dt);
    this.vel[0] += (rawVx - this.vel[0]) * k;
    this.vel[1] += (rawVy - this.vel[1]) * k;

    const write = this.targets[1 - this.read];
    gl.useProgram(this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, SIZE, SIZE);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.loc);
    gl.vertexAttribPointer(this.loc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.read].tex);
    gl.uniform1i(this.u('uPrev'), 0);
    gl.uniform2f(this.u('uMouse'), this.ptr[0], this.ptr[1]);
    gl.uniform2f(
      this.u('uVel'),
      Math.max(-3, Math.min(3, this.vel[0])),
      Math.max(-3, Math.min(3, this.vel[1])),
    );
    gl.uniform1f(this.u('uAspect'), aspect);
    // A tight brush: the pointer disturbs a small pool, not half the screen.
    gl.uniform1f(this.u('uRadius'), 0.038 + 0.03 * this.click);
    // Frame-rate independent decay, roughly a quarter-second half-life.
    gl.uniform1f(this.u('uDecay'), Math.pow(0.06, dt));
    gl.uniform1f(this.u('uErode'), 0.85 * dt);
    gl.uniform1f(this.u('uStrength'), STRENGTH);
    gl.uniform1f(this.u('uActive'), this.active);
    // A click still counts as a disturbance even from a standstill.
    const speed = Math.hypot(this.vel[0], this.vel[1]);
    gl.uniform1f(
      this.u('uSpeed'),
      Math.min(1.6, speed * 1.6 + this.click * 1.5),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.read = 1 - this.read;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
