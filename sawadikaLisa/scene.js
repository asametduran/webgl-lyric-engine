// Three.js world: a neon Bangkok street canyon the camera flies through, driven entirely by audio analysis.
// render(t) is a pure function of the song time: same t -> same frame (deterministic, seek/record safe).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Typography } from './typography.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function ihash(n) { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; }
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GLSL_HASH = /* glsl */`
float h11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
`;

// ---------------------------------------------------------------- shaders
const BUILDING_VS = /* glsl */`
attribute vec4 aSeed;
varying vec3 vLocal; varying vec3 vNrm; varying vec4 vSeed; varying vec3 vWorld; varying float vDist; varying vec3 vScale;
void main(){
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vScale = sc; vLocal = position*sc; vNrm = normal; vSeed = aSeed;
  vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix*wp; vDist = -mv.z;
  gl_Position = projectionMatrix*mv;
}`;
const BUILDING_FS = /* glsl */`
precision highp float;
uniform float uTime, uKick, uBeatPos, uDrop, uIndigo, uHit;
uniform vec3 uFog;
varying vec3 vLocal; varying vec3 vNrm; varying vec4 vSeed; varying vec3 vWorld; varying float vDist; varying vec3 vScale;
${GLSL_HASH}
void main(){
  vec3 n = abs(vNrm);
  vec2 fc; float side = 1.; float hx; float hy = vScale.y;
  if (n.y > .5) { side = 0.; fc = vLocal.xz; hx = vScale.x*.5; hy = vScale.z*.5; }
  else if (n.x > .5) { fc = vec2(vLocal.z, vLocal.y); hx = vScale.z*.5; }
  else { fc = vec2(vLocal.x, vLocal.y); hx = vScale.x*.5; }
  // distance to the nearest face edge
  float e;
  if (side < .5) e = min(hx-abs(fc.x), hy-abs(fc.y));
  else e = min(min(hx-abs(fc.x), fc.y), vScale.y-fc.y);
  float edge = smoothstep(.34, .0, e);
  float wave = pow(max(0., sin(6.2831*(uBeatPos - vDist/42.))), 10.);
  float ledge = smoothstep(.1, .0, min(fract(fc.y/7.), 1.-fract(fc.y/7.))*7./1.)*side;
  float vline = smoothstep(.1, .0, min(fract((fc.x+vSeed.x*9.)/6.), 1.-fract((fc.x+vSeed.x*9.)/6.))*6.)*side;

  vec2 cell = vec2(2.3, 3.1); vec2 id = floor(fc/cell); vec2 f = fract(fc/cell);
  float win = step(.2,f.x)*step(f.x,.8)*step(.28,f.y)*step(f.y,.78);
  float r = h21(id + vSeed.xy*57.);
  float lit = step(.5, r);
  float pulseWin = step(.74, h21(id + floor(uBeatPos)));
  vec3 wc = mix(vec3(.12,1.,.55), vec3(.1,.9,.85), step(.5, h21(id+3.3)));
  wc = mix(wc, vec3(1.,.78,.25), step(.84, r));
  wc = mix(wc, vec3(.5,.22,1.), uIndigo*step(.35, h21(id+9.1)));
  vec3 col = vec3(.004,.018,.02);
  col += side*win*lit*wc*(.34 + .35*wave + .25*uKick*pulseWin + .25*uDrop*pulseWin);

  vec3 wire = mix(vec3(.1,.95,.8), vec3(.2,1.,.5), vSeed.z);
  wire = mix(wire, vec3(.5,.25,1.), uIndigo*.8);
  wire = mix(wire, vec3(1.,.78,.26), clamp(uDrop*1.1 + step(.9,vSeed.w)*.35, 0., 1.));
  float wi = .26 + .3*uKick + .45*wave + .55*uDrop;
  col += wire*(edge + .22*ledge + .1*vline)*wi;
  float fog = 1. - exp(-vDist*vDist*.0000075);
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col, 1.);
}`;

const GROUND_VS = /* glsl */`
varying vec3 vWorld; varying float vDist;
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vWorld = wp.xyz; vec4 mv = viewMatrix*wp; vDist = -mv.z; gl_Position = projectionMatrix*mv; }`;
const GROUND_FS = /* glsl */`
precision highp float;
uniform float uTime, uKick, uBeatPos, uDrop, uIndigo;
uniform vec3 uFog;
varying vec3 vWorld; varying float vDist;
${GLSL_HASH}
void main(){
  vec2 p = vWorld.xz;
  vec2 g = abs(fract(p/vec2(3.,6.)) - .5);
  float lx = smoothstep(.465, .5, g.x), lz = smoothstep(.47, .5, g.y);
  float grid = max(lx, lz);
  float wave = pow(max(0., sin(6.2831*(uBeatPos - vDist/42.))), 12.);
  float dash = step(abs(p.x), .16) * step(fract(p.y/9.), .55);
  float edgeL = smoothstep(.25, .0, abs(abs(p.x) - 9.8));
  vec3 base = vec3(.003,.014,.016);
  vec3 neon = mix(vec3(.1,.95,.8), vec3(.5,.25,1.), uIndigo);
  neon = mix(neon, vec3(1.,.78,.26), clamp(uDrop,0.,1.));
  vec3 col = base;
  col += neon*grid*(.1 + .15*uKick + .35*wave + .3*uDrop)*exp(-abs(p.x)*.02);
  col += vec3(1.,.78,.26)*dash*(.45+uKick*.3);
  col += neon*edgeL*(.35 + .4*wave);
  col += neon*wave*.08;
  // wet-asphalt sheen toward the horizon
  col += vec3(.0,.09,.08)*exp(-vDist*.012)*(.5+.5*h21(floor(p*.5)));
  float fog = 1. - exp(-vDist*vDist*.0000075);
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col, 1.);
}`;

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`;
const SKY_FS = /* glsl */`
precision highp float;
uniform float uKick, uDrop, uIndigo, uBeat;
varying vec3 vDir;
void main(){
  float y = vDir.y;
  vec3 hz = mix(vec3(.02,.34,.28), vec3(.16,.05,.42), uIndigo);
  hz = mix(hz, vec3(.55,.42,.08), uDrop*.7);
  vec3 col = mix(hz, vec3(0.,.012,.02), smoothstep(-.02, .55, y));
  col += hz*(.5 + uKick*.9)*exp(-abs(y)*7.);
  vec3 md = normalize(vec3(.12,.2,-1.));
  float d = dot(vDir, md);
  vec3 gold = vec3(1.,.78,.26);
  col += gold*smoothstep(.9986,.9993,d)*(1.4+uDrop*2.);
  col += gold*pow(max(d,0.), 70.)*(.45 + uDrop*2.2 + uBeat*.3);
  col = max(col, vec3(0.));
  if (y < 0.) col = mix(col, vec3(.004,.015,.018), smoothstep(0.,-.05,y));
  gl_FragColor = vec4(col, 1.);
}`;

const CHEDI_VS = /* glsl */`
varying vec3 vN; varying vec3 vV; varying float vY; varying float vDist;
void main(){ vY = position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vDist=-mv.z; gl_Position = projectionMatrix*mv; }`;
const CHEDI_FS = /* glsl */`
precision highp float;
uniform float uKick, uBeatPos, uDrop; uniform vec3 uFog;
varying vec3 vN; varying vec3 vV; varying float vY; varying float vDist;
void main(){
  vec3 gold = vec3(1.,.78,.26);
  float fres = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.);
  float bands = .55 + .45*step(.5, fract(vY*.33));
  float ring = pow(max(0., sin(6.2831*(vY/52. - uBeatPos*.5))), 14.);
  vec3 col = gold*(.06 + .22*bands) + gold*fres*(.9 + 2.*uKick + 3.5*uDrop) + gold*ring*(2.2 + 3.*uDrop);
  float fog = 1. - exp(-vDist*vDist*.0000075);
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col, 1.);
}`;

const POINTS_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uS, uKick, uDrop, uPx;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p;
  p.x = (aSeed.x - .5)*90. + sin(uTime*.5 + aSeed.w*30.)*1.6;
  p.y = mod(aSeed.y*55. + uTime*(.25 + aSeed.w*.6), 55.);
  float d = mod(aSeed.z*320. - uS, 320.);
  p.z = -uS - d + 30.;
  vec3 dir = normalize(p - cameraPosition + vec3(0.,.001,0.));
  p += dir*uDrop*uDrop*38.*aSeed.w;
  vec4 mv = viewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  float ws = .08 + .22*aSeed.w + uKick*.05;
  gl_PointSize = clamp(ws*uPx/max(-mv.z, .1), 1., 36.);
  vCol = aSeed.w > .72 ? vec3(1.,.78,.26) : (aSeed.w > .36 ? vec3(.2,1.,.55) : vec3(.1,.92,.85));
  vA = smoothstep(320., 200., d) * smoothstep(0., 8., d);
}`;
const POINTS_FS = /* glsl */`
precision highp float;
uniform float uKick, uDrop;
varying vec3 vCol; varying float vA;
void main(){
  float r = length(gl_PointCoord - .5)*2.;
  float a = smoothstep(1., 0., r);
  gl_FragColor = vec4(vCol*(.55 + uKick*.4 + uDrop*.5)*a*vA, a*vA*.6);
}`;

const RAIN_VS = /* glsl */`
attribute vec4 aSeed; attribute float aEnd;
uniform float uTime, uS;
varying float vA;
void main(){
  float x = (aSeed.x - .5)*70.;
  float d = mod(aSeed.z*130. - uS, 130.);
  float z = -uS - d + 12.;
  float y = mod(aSeed.y*60. - uTime*(38. + 22.*aSeed.w), 60.) + aEnd*1.7;
  vec3 p = vec3(x + aEnd*.35, y, z);
  gl_Position = projectionMatrix*viewMatrix*vec4(p,1.);
  vA = (1. - d/130.)*.28;
}`;
const RAIN_FS = /* glsl */`precision highp float; varying float vA; void main(){ gl_FragColor = vec4(vec3(.35,1.,.9)*vA, vA); }`;

const FINAL = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAber: { value: 0 }, uGlitch: { value: 0 }, uFade: { value: 1 }, uDim: { value: 0.4 },
    uRiser: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
precision highp float;
uniform sampler2D tDiffuse; uniform float uTime, uAber, uGlitch, uFade, uDim, uRiser; uniform vec2 uRes;
varying vec2 vUv;
${GLSL_HASH}
void main(){
  vec2 uv = vUv;
  // drop-only micro glitch: a couple of thin bands nudged sideways for a moment
  float slot = floor(uTime*12.);
  float band = floor(uv.y*18.);
  float gOn = step(.9, h21(vec2(band, slot))) * step(.02, uGlitch);
  uv.x += gOn*(h21(vec2(band, slot+7.)) - .5)*.018*uGlitch;
  vec2 dir = uv - .5;
  vec2 off = dir*uAber;
  vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
  col = pow(max(col, 0.), vec3(1.35));
  col *= .965 + .035*sin(uv.y*uRes.y*3.14159);
  col += (h21(uv*uRes + floor(uTime*24.)) - .5)*.012;
  float mid = smoothstep(.95, .05, length((uv - .5)*vec2(1.05, 1.6)));
  col *= 1. - uDim*mid;
  col *= mix(.45, 1., smoothstep(1.0, .3, length(uv - .5)*1.15));
  col *= uFade;
  gl_FragColor = vec4(col, 1.);
}`,
};

// ---------------------------------------------------------------- helpers
function neonBox(w, h, d, color) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x010807, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }));
  g.add(fill, lines);
  return g;
}

function buildTukTuk() {
  const g = new THREE.Group();
  const green = new THREE.Color('#39ff8a').multiplyScalar(2.2), gold = new THREE.Color('#D4AF37').multiplyScalar(2.4);
  const body = neonBox(1.5, 1.2, 2.6, green); body.position.set(0, 1.0, 0.1);
  const front = neonBox(0.9, 0.9, 0.9, green); front.position.set(0, 0.8, -1.7);
  const roof = neonBox(1.9, 0.12, 2.5, gold); roof.position.set(0, 2.45, 0.2);
  g.add(body, front, roof);
  for (const [x, z] of [[-0.85, -0.9], [0.85, -0.9], [-0.85, 1.2], [0.85, 1.2]]) {
    const p = neonBox(0.06, 1.2, 0.06, gold); p.position.set(x, 1.85, z); g.add(p);
  }
  g.wheels = [];
  for (const [x, z, s] of [[0, -1.9, 0.38], [-0.95, 1.2, 0.42], [0.95, 1.2, 0.42]]) {
    const wg = new THREE.Group(); wg.position.set(x, s, z);
    const geo = new THREE.CylinderGeometry(s, s, 0.28, 14); geo.rotateZ(Math.PI / 2);
    wg.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x010807 })));
    wg.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: gold })));
    g.add(wg); g.wheels.push(wg);
  }
  // headlights
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.4) }));
  hl.position.set(0, 0.95, -2.18); g.add(hl);
  return g;
}

const CHEDI_PROFILE = [[11, 0], [11, 3], [9.4, 3], [9.4, 6.5], [7.8, 6.5], [7.8, 9.5], [6.4, 9.5], [6.9, 14], [6.8, 19], [6, 24], [4.8, 28], [3.4, 31.5],
  [2.7, 34], [3.1, 34.4], [2.2, 35.2], [2.6, 35.8], [1.8, 36.6], [2.1, 37.2], [1.4, 38.4], [1.1, 42], [.8, 47], [.5, 53], [.15, 60]];

// ---------------------------------------------------------------- world
export class World {
  constructor(canvas, an, lines, quality = 1) {
    this.an = an; this.lines = lines; this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 3500);
    this.typo = new Typography();
    this.precompute();
    this.U = {
      uTime: { value: 0 }, uKick: { value: 0 }, uBeatPos: { value: 0 }, uDrop: { value: 0 }, uIndigo: { value: 0 }, uHit: { value: 0 },
      uS: { value: 0 }, uBeat: { value: 0 }, uFog: { value: new THREE.Color(0.004, 0.045, 0.04) }, uPx: { value: 900 },
    };
    this.buildWorld();
    this.buildPost();
    this.cutAt = 0; this.lastShot = -1;
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
  }

  // ---- audio envelopes + rail distance, all indexed by analysis frame
  precompute() {
    const an = this.an, n = an.low.length, fps = an.fps;
    this.kickE = new Float32Array(n); this.snareE = new Float32Array(n); this.bassS = new Float32Array(n); this.S = new Float32Array(n);
    const kd = Math.exp(-5 / fps), sd = Math.exp(-6 / fps), bk = Math.min(1, 2.5 / fps);
    for (let i = 1; i < n; i++) {
      this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
      this.snareE[i] = Math.max(this.snareE[i - 1] * sd, an.snare[i] > 0.6 ? an.snare[i] : 0);
      this.bassS[i] = this.bassS[i - 1] + (an.low[i] - this.bassS[i - 1]) * bk;
      this.S[i] = this.S[i - 1] + (7 + 4 * this.bassS[i]) / fps;
    }
    this.totalS = this.S[n - 1];
  }
  sampleS(t) {
    const x = clamp(t * this.an.fps, 0, this.S.length - 1.001), i = Math.floor(x);
    return this.S[i] + (this.S[i + 1] - this.S[i]) * (x - i);
  }

  buildWorld() {
    const U = this.U, scene = this.scene;
    const common = (extra = {}) => ({ uTime: U.uTime, uKick: U.uKick, uBeatPos: U.uBeatPos, uDrop: U.uDrop, uIndigo: U.uIndigo, uHit: U.uHit, uFog: U.uFog, ...extra });

    // sky
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), new THREE.ShaderMaterial({
      uniforms: { uKick: U.uKick, uDrop: U.uDrop, uIndigo: U.uIndigo, uBeat: U.uBeat }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);

    // ground
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 900, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: common(), vertexShader: GROUND_VS, fragmentShader: GROUND_FS,
    }));
    this.ground.frustumCulled = false; scene.add(this.ground);

    // chedi zones along the rail
    this.chedis = [];
    const len = this.totalS + 400;
    for (let z = 190, k = 0; z < len; z += 250, k++) this.chedis.push({ z: -z, side: k % 2 ? 1 : -1 });

    // buildings
    const r = rng(7), inst = [];
    const inZone = (side, z) => this.chedis.some((c) => c.side === side && Math.abs(c.z - z) < 30);
    for (const side of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        for (let z = 60; z > -len; ) {
          const d = row === 0 ? 5 + r() * 4 : 11 + r() * 6;
          const w = row === 0 ? 5 + r() * 6 : 8 + r() * 9;
          const tall = r() < 0.12;
          const h = row === 0 ? 14 + r() * 42 + (tall ? 35 : 0) : 45 + r() * 80;
          const x = side * ((row === 0 ? 10.6 : 24.5) + w / 2 + (row === 1 ? r() * 4 : 0));
          const zc = z - d / 2;
          if (!(inZone(side, zc) && (row === 0 || Math.abs(x) < 60))) inst.push({ x, z: zc, w, h, d, s: [r(), r(), r(), r()] });
          z -= d + (r() < 0.3 ? 1 + r() * 4 : 0.4);
        }
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const seeds = new Float32Array(inst.length * 4);
    this.bMesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: common(), vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS }), inst.length);
    const m = new THREE.Matrix4();
    inst.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      this.bMesh.setMatrixAt(i, m); seeds.set(b.s, i * 4);
    });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    this.bMesh.frustumCulled = false; scene.add(this.bMesh);

    // chedis (gold temple spires) with neon wire overlay
    const pts = CHEDI_PROFILE.map(([rr, y]) => new THREE.Vector2(rr, y));
    const lathe = new THREE.LatheGeometry(pts, 40);
    const chediMat = new THREE.ShaderMaterial({ uniforms: { uKick: U.uKick, uBeatPos: U.uBeatPos, uDrop: U.uDrop, uFog: U.uFog }, vertexShader: CHEDI_VS, fragmentShader: CHEDI_FS });
    this.wireTeal = new THREE.LineBasicMaterial({ color: new THREE.Color('#19e6d3'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.wireGold = new THREE.LineBasicMaterial({ color: new THREE.Color('#D4AF37'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const wireGeo = new THREE.WireframeGeometry(new THREE.LatheGeometry(pts, 20));
    this.chediObjs = this.chedis.map((c) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(lathe, chediMat), new THREE.LineSegments(wireGeo, this.wireTeal));
      g.scale.setScalar(1.25);
      g.position.set(c.side * 36, 0, c.z);
      scene.add(g);
      return g;
    });
    // one huge distant chedi glued to the horizon of the camera
    this.farChedi = new THREE.Group();
    this.farChedi.add(new THREE.Mesh(lathe, chediMat));
    this.farChedi.scale.setScalar(9);
    scene.add(this.farChedi);

    // neon cage gates (wireframe tunnels) every ~70 units
    this.gates = [];
    const gateFrame = (w, h) => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.05));
    const frames = [[19, 15], [17, 13], [15, 11], [13, 9]];
    for (let z = 90, k = 0; z < len; z += 70, k++) {
      const g = new THREE.Group();
      frames.forEach(([w, h], j) => {
        const l = new THREE.LineSegments(gateFrame(w, h), k % 3 === 0 ? this.wireGold : this.wireTeal);
        l.position.set(0, h / 2 + 0.2, -j * 2.2); g.add(l);
      });
      g.position.z = -z; scene.add(g); this.gates.push(g);
    }

    // floating wireframe polyhedra
    this.polys = [];
    const pr = rng(99);
    const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.8, 0.22, 48, 6), new THREE.IcosahedronGeometry(1, 1)].map((g) => new THREE.EdgesGeometry(g));
    this.wireGreen = new THREE.LineBasicMaterial({ color: new THREE.Color('#39ff8a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 46; i++) {
      const l = new THREE.LineSegments(geos[i % geos.length], i % 3 === 0 ? this.wireGold : this.wireGreen);
      const s = 2.2 + pr() * 3.5;
      l.position.set((pr() - 0.5) * 22, 6 + pr() * 22, -(80 + pr() * (len - 100)));
      l.userData = { s, a: pr() * 6, sp: 0.2 + pr() * 0.7 };
      scene.add(l); this.polys.push(l);
    }

    // particles (embers) + rain
    const PN = 9000, ps = new Float32Array(PN * 4), pr2 = rng(5);
    for (let i = 0; i < ps.length; i++) ps[i] = pr2();
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 4));
    this.points = new THREE.Points(pg, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uS: U.uS, uKick: U.uKick, uDrop: U.uDrop, uPx: U.uPx }, vertexShader: POINTS_VS, fragmentShader: POINTS_FS,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false; scene.add(this.points);

    const RN = 3200, rs = new Float32Array(RN * 2 * 4), re = new Float32Array(RN * 2), rp = new Float32Array(RN * 2 * 3), rr = rng(17);
    for (let i = 0; i < RN; i++) {
      const s = [rr(), rr(), rr(), rr()];
      for (let k = 0; k < 2; k++) { rs.set(s, (i * 2 + k) * 4); re[i * 2 + k] = k; }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(rs, 4));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uS: U.uS }, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.rain.frustumCulled = false; scene.add(this.rain);

    // tuk-tuk
    this.tuk = buildTukTuk(); scene.add(this.tuk);
  }

  buildPost() {
    const r = this.renderer;
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // typography overlay: screen-aligned quad rendered after the 3D scene so bloom + aberration hit the letters too
    this.tex = new THREE.CanvasTexture(this.typo.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.textScene = new THREE.Scene();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.textScene.add(quad);
    const tp = new RenderPass(this.textScene, this.ortho);
    tp.clear = false; tp.clearDepth = true;
    this.composer.addPass(tp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.22, 0.3, 0.8);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
  }

  resize(cw, ch) {
    // keep a 16:9 picture, letterboxed by CSS
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
    this.cssW = w; this.cssH = h;
  }

  // ---- stateless audio features at time t
  features(t) {
    const an = this.an, i = clamp(Math.floor(t * an.fps), 0, this.kickE.length - 1);
    const bp = (t - an.offset) / an.beatDur, bf = bp - Math.floor(bp);
    let drop = 0, flash = 0, riser = 0, dropAt = -1;
    for (const d of an.drops) {
      if (t >= d) { drop = Math.exp(-(t - d) * 1.3); flash = 0; dropAt = d; }
      else { riser = Math.max(riser, clamp(1 - (d - t) / (an.barDur * 2))); }
    }
    return {
      kick: this.kickE[i], snare: this.snareE[i], bass: this.bassS[i], hat: an.high[i], drop, flash, riser, dropAt,
      beatPos: bp, beatPulse: Math.exp(-bf * 5), duration: an.duration,
    };
  }

  activeLine(t) {
    for (const l of this.lines) if (!l.title && t >= l.t - 0.02 && t < l.end) return l;
    return null;
  }

  // ---- camera director: slow, smooth moves; a new shot every 8 bars (~20 s) with a dip through black
  shotCamera(t, f, S) {
    const an = this.an, cam = this.camera;
    const span = 8 * an.barDur;
    const blk = Math.max(0, Math.floor((t - an.firstBar) / span));
    const start = an.firstBar + blk * span;
    const u = clamp((t - start) / span), ez = u * u * (3 - 2 * u);
    const sgn = ihash(blk * 13 + 1) > 0.5 ? 1 : -1;
    const shot = [0, 2, 5, 1, 0, 6][Math.floor(ihash(blk * 7 + 3) * 6)];
    const P = cam.position, look = new THREE.Vector3();
    const z0 = -S;
    let fov = 60;
    switch (shot) {
      case 1: // low glide
        P.set(sgn * (2 + ez * 2), 1.6 + 0.6 * ez, z0 + 4); look.set(-sgn, 4, z0 - 30); fov = 66; break;
      case 2: // gentle side drift
        P.set(sgn * 6, 4 + 2 * ez, z0); look.set(-sgn * 4, 10 + 3 * ez, z0 - 24); fov = 60; break;
      case 5: // slow crane push-in
        P.set(0, 3 + 7 * (1 - ez), z0 + 22 * (1 - ez)); look.set(0, 6, z0 - 32); fov = 58; break;
      case 6: { // slow arc toward the nearest temple
        let best = this.chedis[0];
        for (const c of this.chedis) if (Math.abs(c.z - z0) < Math.abs(best.z - z0)) best = c;
        const a = (u - 0.5) * 0.9, R = 44;
        P.set(best.side * 36 - best.side * Math.cos(a) * R, 14 + 4 * ez, best.z + Math.sin(a) * R);
        look.set(best.side * 36, 24, best.z); fov = 56; break;
      }
      default: // dolly
        P.set(Math.sin(t * 0.18) * 1.2, 3.2 + 0.25 * Math.sin(t * 0.3), z0); look.set(Math.sin(t * 0.12) * 2, 6 + 1.5 * ez, z0 - 34); fov = 60;
    }
    if (shot !== 6) P.x = Math.max(-9, Math.min(9, P.x));
    fov -= 0.5 * f.kick;
    cam.fov = fov; cam.updateProjectionMatrix();
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    this.fade = clamp((t - start + (blk === 0 ? an.firstBar : 0)) / 0.9);
    return shot;
  }

  render(t) {
    const an = this.an, U = this.U;
    const f = this.features(t);
    const S = this.sampleS(t);

    this.typo.draw(t, this.lines, f);
    this.tex.needsUpdate = true;

    U.uTime.value = t; U.uKick.value = f.kick * 0.5; U.uBeatPos.value = f.beatPos; U.uDrop.value = f.drop * 0.6; U.uIndigo.value = 0;
    U.uHit.value = 0; U.uS.value = S; U.uBeat.value = f.beatPulse * 0.5;
    U.uFog.value.setRGB(0.004 + 0.015 * f.drop, 0.04 + 0.012 * f.drop, 0.036);

    // tuk-tuk quietly cruises ahead of the camera
    const tp = this.tuk;
    tp.position.set(Math.sin(t * 0.3) * 2.6, 0, -S - 24);
    tp.rotation.set(0, -Math.cos(t * 0.3) * 0.12, 0);
    tp.wheels.forEach((w) => { w.rotation.x = -S * 0.9; });

    this.shot = this.shotCamera(t, f, S);
    const cp = this.camera.position;
    this.sky.position.copy(cp);
    this.ground.position.set(0, 0, cp.z - 250);
    this.farChedi.position.set(40, 0, cp.z - 1000);

    const k = 0.26 + 0.2 * f.kick + 0.35 * f.drop;
    this.wireTeal.opacity = Math.min(0.7, k); this.wireGold.opacity = Math.min(0.7, k * 1.1); this.wireGreen.opacity = Math.min(0.7, k);
    for (const p of this.polys) {
      const d = p.userData;
      p.rotation.set(t * d.sp * 0.5 + d.a, t * d.sp * 0.35, 0);
      p.scale.setScalar(d.s * (1 + 0.06 * f.kick + 0.1 * f.drop));
    }

    this.bloom.strength = 0.22 + 0.12 * f.drop;
    const F = this.final.uniforms;
    F.uTime.value = t;
    F.uAber.value = 0.0007 + 0.0016 * f.drop;        // barely-there lens fringing, a touch more on drops
    F.uGlitch.value = f.drop > 0.6 ? f.drop * 0.5 : 0; // minimal glitch only in the first moment of a drop
    const endFade = 1 - clamp((t - (an.duration - 3)) / 3);
    F.uFade.value = this.fade * endFade;
    F.uDim.value = 0.42;
    F.uRiser.value = 0;

    this.composer.render();
  }
}
