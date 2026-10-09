// Three.js world: a minimal infinity-mirror club corridor. Neon frames recede into a dark glossy floor that mirrors them,
// vertical neon tubes line the walls, soft particles drift. Palette: deep purple/black, electric cyan, neon fuchsia.
// render(t) is a pure function of the song time: same t -> same frame (deterministic, seek/capture safe).
// No camera shake, no strobe: the 125 BPM kick only breathes the light (smooth cosine pulse + a slow travelling wave).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Typography } from './typography.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FUCHSIA = new THREE.Color('#ff2fb4'), CYAN = new THREE.Color('#2fd8ff');

const GLSL_HASH = /* glsl */`
float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
`;

// ---------------------------------------------------------------- shaders
const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`;
const SKY_FS = /* glsl */`
precision highp float;
uniform float uBeat;
varying vec3 vDir;
void main(){
  float y = vDir.y;
  vec3 col = mix(vec3(.05,.0,.10), vec3(.008,.0,.02), smoothstep(-.1, .6, y));
  // faint fuchsia glow at the vanishing point of the corridor
  float d = max(dot(normalize(vec3(vDir.x, vDir.y*1.6, vDir.z)), vec3(0.,0.,-1.)), 0.);
  col += vec3(.9,.1,.55)*pow(d, 36.)*(.22 + .1*uBeat);
  col += vec3(.1,.5,.9)*pow(d, 8.)*.04;
  gl_FragColor = vec4(col, 1.);
}`;

// glossy dark floor: transparent so the mirrored (dimmed) lower half of the frames shows through
const GROUND_VS = /* glsl */`
varying vec3 vWorld; varying float vDist;
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vWorld = wp.xyz; vec4 mv = viewMatrix*wp; vDist = -mv.z; gl_Position = projectionMatrix*mv; }`;
const GROUND_FS = /* glsl */`
precision highp float;
uniform float uBeat;
varying vec3 vWorld; varying float vDist;
void main(){
  vec2 p = vWorld.xz;
  vec2 g = abs(fract(p/3.) - .5);
  float grid = max(smoothstep(.485, .5, g.x), smoothstep(.485, .5, g.y));
  vec3 col = vec3(.02,.0,.045);
  col += vec3(.1,.7,1.)*grid*(.07 + .05*uBeat)*exp(-vDist*.02);
  float a = mix(.74, .94, smoothstep(0., 90., vDist));
  gl_FragColor = vec4(col, a);
}`;

// shared by neon frames and tubes: additive colour, dimmed below the floor (the "mirror"), faded with distance and very close up
const NEON_VS = /* glsl */`
varying vec3 vW; varying float vD;
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vec4 mv = viewMatrix*wp; vD = -mv.z; gl_Position = projectionMatrix*mv; }`;
const NEON_FS = /* glsl */`
precision highp float;
uniform vec3 uColor; uniform float uA;
varying vec3 vW; varying float vD;
void main(){
  float dim = vW.y < 0. ? .26 : 1.;
  float fade = exp(-vD*.0105) * smoothstep(1., 9., vD);
  gl_FragColor = vec4(uColor*uA*dim*fade, 1.);
}`;

const POINTS_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uS, uBeat, uPx;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p;
  p.x = (aSeed.x - .5)*13. + sin(uTime*.3 + aSeed.w*30.)*.5;
  p.y = .3 + mod(aSeed.y*8. + uTime*(.1 + aSeed.w*.18), 8.);
  float d = mod(aSeed.z*140. - uS, 140.);
  p.z = -uS - d + 20.;
  vec4 mv = viewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  float ws = .05 + .1*aSeed.w + uBeat*.02;
  gl_PointSize = clamp(ws*uPx/max(-mv.z, .1), 1., 20.);
  vCol = aSeed.w > .5 ? vec3(1.,.25,.7) : vec3(.2,.8,1.);
  vA = smoothstep(140., 70., d) * smoothstep(0., 6., d);
}`;
const POINTS_FS = /* glsl */`
precision highp float;
varying vec3 vCol; varying float vA;
void main(){
  float r = length(gl_PointCoord - .5)*2.;
  float a = smoothstep(1., 0., r); a *= a;
  gl_FragColor = vec4(vCol*a*vA*.8, a*vA*.6);
}`;

const FINAL = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAber: { value: 0 }, uFade: { value: 1 }, uDim: { value: 0.35 }, uRes: { value: new THREE.Vector2(1920, 1080) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
precision highp float;
uniform sampler2D tDiffuse; uniform float uTime, uAber, uFade, uDim; uniform vec2 uRes;
varying vec2 vUv;
${GLSL_HASH}
void main(){
  vec2 uv = vUv;
  vec2 off = (uv - .5)*uAber;
  vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
  col += (h21(uv*uRes + floor(uTime*24.)) - .5)*.01;                     // fine film grain
  float mid = smoothstep(.95, .05, length((uv - .5)*vec2(1.05, 1.6)));
  col *= 1. - uDim*mid;                                                    // calm the centre so text reads
  col *= mix(.5, 1., smoothstep(1.0, .3, length(uv - .5)*1.15));           // vignette
  col *= uFade;
  gl_FragColor = vec4(col, 1.);
}`,
};

const neonMat = (color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uA: { value: 0.5 } }, vertexShader: NEON_VS, fragmentShader: NEON_FS,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
});

// ---------------------------------------------------------------- world
export class World {
  constructor(canvas, an, lines, quality = 1) {
    this.an = an; this.lines = lines; this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2500);
    this.typo = new Typography();
    this.precompute();
    this.U = { uTime: { value: 0 }, uBeat: { value: 0 }, uS: { value: 0 }, uPx: { value: 900 } };
    this.buildWorld();
    this.buildPost();
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
  }

  // audio envelopes + rail distance, all indexed by analysis frame
  precompute() {
    const an = this.an, n = an.low.length, fps = an.fps;
    this.kickE = new Float32Array(n); this.bassS = new Float32Array(n); this.S = new Float32Array(n);
    const kd = Math.exp(-4 / fps), bk = Math.min(1, 2 / fps);
    for (let i = 1; i < n; i++) {
      this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
      this.bassS[i] = this.bassS[i - 1] + (an.low[i] - this.bassS[i - 1]) * bk;
      this.S[i] = this.S[i - 1] + (4.5 + 2 * this.bassS[i]) / fps;
    }
    this.totalS = this.S[n - 1];
  }
  sampleS(t) {
    const x = clamp(t * this.an.fps, 0, this.S.length - 1.001), i = Math.floor(x);
    return this.S[i] + (this.S[i + 1] - this.S[i]) * (x - i);
  }

  buildWorld() {
    const U = this.U, scene = this.scene;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 16), new THREE.ShaderMaterial({
      uniforms: { uBeat: U.uBeat }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 700).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uBeat: U.uBeat }, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, transparent: true, depthWrite: false,
    }));
    this.ground.frustumCulled = false; this.ground.renderOrder = -5; scene.add(this.ground);

    // infinity-mirror frames: thin rectangular neon rings every STEP units, alternating fuchsia / cyan, centred on the floor plane
    const len = this.totalS + 260, STEP = 4.5, W = 14, H = 10, T = 0.11;
    const shape = new THREE.Shape([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(new THREE.Path([[-W / 2 + T, -H / 2 + T], [-W / 2 + T, H / 2 - T], [W / 2 - T, H / 2 - T], [W / 2 - T, -H / 2 + T]].map(([x, y]) => new THREE.Vector2(x, y))));
    const frameGeo = new THREE.ShapeGeometry(shape);
    this.frames = [];
    for (let z = 12, k = 0; z < len; z += STEP, k++) {
      const m = new THREE.Mesh(frameGeo, neonMat(k % 2 ? CYAN : FUCHSIA));
      m.position.z = -z; m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
      this.frames.push({ m, z });
    }

    // vertical neon tubes behind the frames (mirrored below the floor, dimmed by the shader)
    const r = rng(11);
    const tubeGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
    this.tubes = [];
    for (let z = 10, k = 0; z < len; z += 9) {
      for (const sd of [-1, 1]) {
        const m = new THREE.Mesh(tubeGeo, neonMat((k + (sd > 0 ? 1 : 0)) % 2 ? CYAN : FUCHSIA));
        m.scale.y = 5 + r() * 4.5; m.position.set(sd * (8.2 + r() * 1.2), 0, -z - r() * 3);
        m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
        this.tubes.push({ m, z, ph: r() * 6.28 });
      }
      k++;
    }

    // soft drifting particles
    const PN = 3500, ps = new Float32Array(PN * 4), pr = rng(5);
    for (let i = 0; i < ps.length; i++) ps[i] = pr();
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    pgeo.setAttribute('aSeed', new THREE.BufferAttribute(ps, 4));
    this.points = new THREE.Points(pgeo, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uS: U.uS, uBeat: U.uBeat, uPx: U.uPx }, vertexShader: POINTS_VS, fragmentShader: POINTS_FS,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 2; scene.add(this.points);
  }

  buildPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // typography overlay drawn after the 3D scene so bloom softly lights the letters too
    this.tex = new THREE.CanvasTexture(this.typo.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.textScene = new THREE.Scene();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.textScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })));
    const tp = new RenderPass(this.textScene, this.ortho);
    tp.clear = false; tp.clearDepth = true;
    this.composer.addPass(tp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.5, 0.65, 0.5);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
  }

  resize(cw, ch) {
    let w = cw, h = Math.round(cw * 9 / 16);
    if (h > ch) { h = ch; w = Math.round(ch * 16 / 9); }
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, true);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
    this.U.uPx.value = (h * pr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.camera.aspect = 16 / 9; this.camera.updateProjectionMatrix();
  }

  features(t) {
    const an = this.an, i = clamp(Math.floor(t * an.fps), 0, this.kickE.length - 1);
    const bp = (t - an.offset) / an.beatDur, bf = bp - Math.floor(bp);
    // smooth beat pulse: cosine^3, peaks on the kick, no hard attack -> a soft light "breath" at 125 BPM
    const beatPulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * bf), 3);
    return { kick: this.kickE[i], bass: this.bassS[i], hat: an.high[i], beatPos: bp, beatPulse, section: 0, duration: an.duration };
  }

  // slow, smooth drifting camera inside the corridor; a new gentle pose every 8 bars blended with smoothstep (no cuts)
  cameraAt(t, S) {
    const an = this.an, cam = this.camera, span = 8 * an.barDur;
    const blk = Math.max(0, Math.floor((t - an.firstBar) / span));
    const poseOf = (b) => {
      const r = rng(b * 31 + 7), sg = r() < 0.5 ? -1 : 1;
      return { x: sg * (r() * 1.8), y: 1.3 + r() * 1.5, lx: -sg * r() * 1.5, ly: 1.2 + r() * 1.5, fov: 58 + r() * 8 };
    };
    const u = clamp((t - (an.firstBar + blk * span)) / 3.5), e = u * u * (3 - 2 * u);
    const a = poseOf(Math.max(0, blk - 1)), b = poseOf(blk), m = (k) => a[k] + (b[k] - a[k]) * e;
    cam.position.set(m('x') + Math.sin(t * 0.21) * 0.35, m('y') + Math.sin(t * 0.33) * 0.12, -S);
    cam.lookAt(m('lx'), m('ly'), -S - 30);
    cam.fov = m('fov'); cam.updateProjectionMatrix();
    return blk;
  }

  render(t) {
    const an = this.an, U = this.U;
    const f = this.features(t), S = this.sampleS(t);
    this.typo.draw(t, this.lines, f);
    this.tex.needsUpdate = true;

    U.uTime.value = t; U.uBeat.value = f.beatPulse * 0.6; U.uS.value = S;
    this.shot = this.cameraAt(t, S);
    const cp = this.camera.position;
    this.sky.position.copy(cp);
    this.ground.position.set(0, 0, cp.z - 250);

    // light: slow base glow + a gentle wave travelling down the corridor in time with the beat + the soft kick breath
    const camZ = -cp.z;
    for (const fr of this.frames) {
      const d = fr.z - camZ;
      if (d < -6 || d > 190) { fr.m.visible = false; continue; }
      fr.m.visible = true;
      const wave = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * (f.beatPos - d / 36)), 4);
      fr.m.material.uniforms.uA.value = 0.5 + 0.2 * f.beatPulse + 0.28 * wave;
    }
    for (const tb of this.tubes) {
      const d = tb.z - camZ;
      if (d < -6 || d > 190) { tb.m.visible = false; continue; }
      tb.m.visible = true;
      tb.m.material.uniforms.uA.value = 0.5 + 0.16 * f.beatPulse + 0.1 * Math.sin(t * 0.7 + tb.ph);
    }
    this.bloom.strength = 0.48 + 0.1 * f.beatPulse;
    const F = this.final.uniforms;
    F.uTime.value = t;
    F.uAber.value = 0.0008;
    F.uFade.value = clamp((t - 0.2) / 1.2) * (1 - clamp((t - (an.duration - 3)) / 3));
    F.uDim.value = 0.35;
    this.composer.render();
  }
}
