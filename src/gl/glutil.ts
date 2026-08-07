export type GL = WebGLRenderingContext;

export function compile(gl: GL, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) {
    throw new Error(
      `could not create shader (contextLost=${gl.isContextLost()}, err=${gl.getError()})`,
    );
  }
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}

export function program(gl: GL, vsSrc: string, fsSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error('program link failed: ' + log);
  }
  return p;
}

/** A unit quad in [0,1]², shared by every pass. */
export function quad(gl: GL) {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    gl.STATIC_DRAW,
  );
  return buf;
}

export function uniforms(gl: GL, p: WebGLProgram) {
  const cache = new Map<string, WebGLUniformLocation | null>();
  return (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
    return cache.get(name)!;
  };
}

/** A 1×1 mid-grey stand-in so the first frame never samples an unbound unit. */
export function blankTexture(gl: GL) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([90, 90, 90, 255]),
  );
  setClampLinear(gl);
  return t;
}

export function setClampLinear(gl: GL) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

export function imageTexture(gl: GL, img: TexImageSource) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  setClampLinear(gl);
  return t;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Decode once, reuse forever — the About transition depends on not refetching. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('failed to load ' + src));
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

/** Ordered 8×8 Bayer threshold, computed rather than sampled from a texture. */
export const BAYER_GLSL = /* glsl */ `
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`;
