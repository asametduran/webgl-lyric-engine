// True Damage - "Know My Name": a lava-veined obsidian monolith in a rain-soaked cyberpunk arena.
// Concept (see README): fire in my veins -> vein-lit monolith that ignites on "Now you know my name"; rise from the ashes -> embers
// that fall, then climb, a cracked floor that heals into wet glass; "Hit the Z" -> neon Z-Drive prism; speaker towers pump the kick;
// ES/KR graffiti billboards; "legends collide" -> holographic Summoner's-Cup-style trophy fuses with the monolith.
// render(t) is a pure function of the song time: same t -> same frame (deterministic, seek/capture safe).
// Camera = a director: hard cuts per song section, kick punch (FOV/dolly), light Dutch-tilt on the beat. No strobing.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Typography } from './typography.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sm = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const mix = (a, b, x) => a + (b - a) * x;
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// piecewise-linear keyframes [[t, v], ...]
function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1); }
  }
  return keys[keys.length - 1][1];
}
const win = (t, a, b, c, d) => sm(a, b, t) * (1 - sm(c, d, t));

// ---------------------------------------------------------------- cue sheet (seconds), derived from the lyric timing
const HEAT = [[0, 0.1], [24, 0.3], [29.9, 0.45], [30.3, 1], [36, 0.8], [58, 0.8], [72, 1], [92, 0.75], [100, 0.85], [142, 0.85], [160, 1], [161.6, 1.1], [190, 1], [220, 1], [240, 0.7], [257, 0.4]];
const RISE = [[0, 0], [30, 0], [72, 0.1], [73.5, 1], [91, 1], [93, 0.2], [160, 0.3], [162, 1], [220, 1], [257, 0.8]];
const HEAL = [[0, 0], [72, 0], [88, 0.6], [160, 0.6], [175, 1], [257, 1]];
const PRISM = [[0, 0.05], [24, 0.1], [72, 0.5], [92, 0.4], [99, 0.6], [100, 1], [128, 1], [142, 0.5], [161, 0.9], [190, 0.9], [200, 0.3], [257, 0.2]];
const FOGD = [[0, 0.03], [24, 0.02], [30, 0.014], [72, 0.011], [190, 0.011], [220, 0.014], [257, 0.02]];
const CHORUS = (t) => win(t, 72, 73, 91, 93) + win(t, 161, 162, 189, 191) + win(t, 191, 192, 220, 221) * 0.8;

// ---------------------------------------------------------------- shot list: hard cut at every `t`
// lerp: p/l/f from a to b; orbit: circle around c. ease: l (linear), io (smooth), out, in. punch = kick-reaction amount.
const SHOTS = [
  { t: 0, k: 'lerp', a: { p: [0, 3.4, 44], l: [0, 6.5, 0], f: 30 }, b: { p: [0, 2.4, 26], l: [0, 7.4, 0], f: 36 }, e: 'l', punch: 0.25 },
  { t: 24, k: 'lerp', a: { p: [1.8, 1.0, 7.5], l: [0.4, 2.6, 0], f: 40 }, b: { p: [0.9, 1.8, 4.2], l: [0.2, 4.5, 0], f: 34 }, e: 'io', punch: 0.5 },
  { t: 30, k: 'lerp', a: { p: [0, 0.7, 10], l: [0, 1.5, 0], f: 52 }, b: { p: [0, 3.5, 22], l: [0, 9, 0], f: 62 }, e: 'out', punch: 0.9 },
  { t: 44, k: 'orbit', c: [0, 0, 0], r: [12, 9], h: [1.2, 1.6], a: [-0.8, 0.35], l: [[0, 5, 0], [0, 6.5, 0]], f: [42, 42], e: 'io', punch: 0.8 },
  { t: 58, k: 'lerp', a: { p: [-24, 3, 22], l: [-8, 6, 0], f: 52 }, b: { p: [24, 3.6, 22], l: [8, 6, 0], f: 52 }, e: 'l', punch: 1 },
  { t: 72, k: 'orbit', c: [0, 0, 0], r: [36, 28], h: [4, 7], a: [-0.15, 0.15], l: [[0, 7, 0], [0, 7.5, 0]], f: [74, 68], e: 'l', punch: 1.3 },
  { t: 92, k: 'lerp', a: { p: [-7, 3.2, 16], l: [-20, 4.6, 8], f: 44 }, b: { p: [-10.5, 3.4, 11], l: [-20, 4.6, 8], f: 36 }, e: 'l', punch: 0.7 },
  { t: 100, k: 'orbit', c: [11, 6, -5], r: [11, 10], h: [0.5, 2], a: [0.4, 1.5], l: [[11, 6, -5], [11, 6, -5]], f: [46, 46], e: 'l', punch: 1 },
  { t: 113, k: 'orbit', c: [11, 6, -5], r: [14, 8], h: [3, 0], a: [1.5, -0.5], l: [[11, 6, -5], [11, 6, -5]], f: [52, 42], e: 'io', punch: 1.1 },
  { t: 128, k: 'lerp', a: { p: [-3, 2.2, 17], l: [-20, 4.6, 8], f: 55 }, b: { p: [-12, 3.2, 10.5], l: [-20, 4.6, 8], f: 38 }, e: 'io', punch: 0.8 },
  { t: 142, k: 'lerp', a: { p: [0, 4, 44], l: [0, 7, 0], f: 62 }, b: { p: [0, 3.5, 13], l: [0, 7, 0], f: 34 }, e: 'in', punch: 1.1 },
  { t: 161, k: 'orbit', c: [0, 0, 0], r: [31, 27], h: [4.5, 3], a: [-0.55, 0.55], l: [[0, 7, 0], [0, 7, 0]], f: [76, 70], e: 'l', punch: 1.5 },
  { t: 183, k: 'lerp', a: { p: [3, 1.0, 9], l: [0, 3, 0], f: 40 }, b: { p: [-1, 2, 11], l: [0, 6.5, 0], f: 46 }, e: 'io', punch: 1 },
  { t: 191, k: 'lerp', a: { p: [0, 2, 28], l: [0, 6, 0], f: 56 }, b: { p: [0, 34, 24], l: [0, 16, 0], f: 68 }, e: 'io', punch: 0.7 },
  { t: 220, k: 'lerp', a: { p: [0, 18, 26], l: [0, 15, 0], f: 60 }, b: { p: [0, 22, 62], l: [0, 15, 0], f: 52 }, e: 'l', punch: 0.2 },
];
const EASE = { l: (u) => u, io: (u) => u * u * (3 - 2 * u), out: (u) => 1 - Math.pow(1 - u, 3), in: (u) => Math.pow(u, 2.2) };

// ---------------------------------------------------------------- GLSL
const NOISE = /* glsl */`
float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float h31(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s; }
`;
const FOG_FN = /* glsl */`
uniform vec3 uFogCol; uniform float uFogD;
vec3 fogOpaque(vec3 c, float d){ return mix(c, uFogCol, 1.-exp(-d*uFogD)); }
vec3 fogAdd(vec3 c, float d){ return c*exp(-d*uFogD*.7); }
`;
const STD_VS = /* glsl */`
varying vec3 vPos; varying vec3 vN; varying vec3 vWp; varying float vD; varying vec2 vUv;
void main(){
  vPos = position; vUv = uv;
  vec4 wp = modelMatrix*vec4(position,1.); vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix)*normal);
  vec4 mv = viewMatrix*wp; vD = -mv.z; gl_Position = projectionMatrix*mv;
}`;
const UV_VS = /* glsl */`
varying vec2 vUv; varying float vD;
void main(){ vUv = uv; vec4 mv = viewMatrix*modelMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`;

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`;
const SKY_FS = /* glsl */`
precision highp float;
uniform float uHeat, uBeat; uniform vec3 uFogCol;
varying vec3 vDir;
void main(){
  float y = vDir.y;
  vec3 col = mix(vec3(.05,.02,.045), vec3(.003,.004,.014), smoothstep(0., .55, y));
  float d = max(dot(normalize(vec3(vDir.x, vDir.y*2.2, vDir.z)), vec3(0.,0.,-1.)), 0.);
  col += vec3(1.,.28,.05)*pow(d, 16.)*(.12 + .36*uHeat + .05*uBeat);
  col += vec3(.8,.1,.5)*pow(d, 5.)*.07;
  col = mix(col, uFogCol*1.3, exp(-max(y, 0.)*6.5)*.75);
  gl_FragColor = vec4(col, 1.);
}`;

const FLOOR_FS = /* glsl */`
precision highp float;
uniform float uTime, uHeat, uHeal, uBeat, uKick;
varying vec3 vWp; varying float vD;
${NOISE}${FOG_FN}
void main(){
  vec2 p = vWp.xz;
  float r = length(p);
  float n = fbm(vec3(p*.28, 0.));
  float ridge = 1. - abs(2.*n - 1.);
  float crack = smoothstep(.93, .99, ridge)*(1. - uHeal*.85);
  float halo  = smoothstep(.78, .97, ridge)*.3*(1. - uHeal);
  vec3 col = vec3(.012,.012,.02);
  col += vec3(1.,.3,.05)*exp(-r*.11)*uHeat*.2;
  col += vec3(1.,.4,.05)*(crack + halo)*(.1 + uHeat*.9)*(1. + uKick*.5)*exp(-r*.022);
  float pud = smoothstep(.46, .62, fbm(vec3(p*.09 + 3., 1.)))*(.4 + uHeal*.6);
  vec2 g = abs(fract(p/4.) - .5);
  float grid = max(smoothstep(.48,.5,g.x), smoothstep(.48,.5,g.y));
  col += vec3(.1,.7,1.)*grid*uHeal*.09*exp(-vD*.012);
  col += vec3(.15,.55,1.)*pud*.025;
  float a = mix(.9, .5, pud);
  col = fogOpaque(col, vD);
  a = mix(a, 1., 1. - exp(-vD*uFogD*1.2));
  gl_FragColor = vec4(col, a);
}`;

const MONO_FS = /* glsl */`
precision highp float;
uniform float uTime, uHeat, uIgnite, uReveal, uGold, uKick, uBeat; uniform sampler2D uTex;
varying vec3 vPos; varying vec3 vN; varying vec3 vWp; varying float vD;
${NOISE}${FOG_FN}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWp);
  float fres = pow(1. - abs(dot(N, V)), 3.);
  vec3 q = vPos*vec3(.9,.45,.9);
  float n = fbm(q + vec3(0., uTime*.03, 0.));
  float ridge = 1. - abs(2.*n - 1.);
  float core = smoothstep(.962, .994, ridge);
  float v = core + smoothstep(.90, .99, ridge)*.3;
  float front = mix(-10., 9., uIgnite);
  float lit = 1. - smoothstep(front - 1., front + 1., vPos.y);
  float pulse = .55 + .45*sin(vPos.y*.9 - uTime*3. + n*6.);
  float dead = (.07 + .05*sin(uTime*.8 + vPos.y))*min(uHeat, .5);
  float inten = v*(lit*1.2*pulse*(1. + uKick*.9)*uHeat + (1. - lit)*dead);
  vec3 fire = mix(vec3(1.,.33,.04), vec3(1.,.8,.35), core*.7);
  fire = mix(fire, vec3(1.,.92,.65), uGold);
  vec3 col = vec3(.02,.022,.034) + fire*inten*1.25;
  col += vec3(1.,.3,.05)*exp(-(vPos.y + 7.)*.4)*.1*uHeat;
  col += vec3(.04,.06,.1)*smoothstep(-1., 1., sin(vPos.y*.9 + vPos.x*2.))*.5;
  col += vec3(.1,.7,1.)*fres*.9*(.55 + uHeat*.45);
  col += vec3(.9,.2,.5)*pow(1. - abs(dot(N, V)), 5.)*.25;
  float face = step(.9, N.z);
  vec2 uv = vec2(vPos.x/3.4 + .5, vPos.y/14. + .5);
  float tx = texture2D(uTex, uv).r;
  float m = 1. - smoothstep(uReveal - .05, uReveal + .05, uv.y);
  col += mix(vec3(1.,.55,.15), vec3(1.,.95,.8), uGold)*tx*m*face*(.95 + uKick*.5 + uBeat*.2);
  gl_FragColor = vec4(fogOpaque(col, vD), 1.);
}`;

const BUILD_VS = /* glsl */`
varying vec3 vWp; varying vec3 vN; varying float vD;
void main(){
  vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.); vWp = wp.xyz;
  vN = normalize(mat3(instanceMatrix)*normal);
  vec4 mv = viewMatrix*wp; vD = -mv.z; gl_Position = projectionMatrix*mv;
}`;
const BUILD_FS = /* glsl */`
precision highp float;
uniform float uTime, uHeat;
varying vec3 vWp; varying vec3 vN; varying float vD;
${NOISE}${FOG_FN}
void main(){
  vec3 N = normalize(vN);
  vec3 col = vec3(.012,.014,.026);
  if (abs(N.y) < .5) {
    float u = abs(N.x) > .5 ? vWp.z : vWp.x;
    vec2 cell = floor(vec2(u*.6, abs(vWp.y)*.45));
    vec2 f = fract(vec2(u*.6, abs(vWp.y)*.45));
    vec2 salt = vec2(floor(vWp.x*.07), floor(vWp.z*.07))*13.7;
    float on = step(.95, h21(cell + salt));
    float win = step(.18, f.x)*step(f.x, .82)*step(.25, f.y)*step(f.y, .75);
    float k = h21(cell + salt + 4.2);
    vec3 wc = k < .4 ? vec3(.1,.7,1.) : (k < .7 ? vec3(1.,.15,.6) : (k < .9 ? vec3(1.,.5,.12) : vec3(.9,.95,1.)));
    col += wc*on*win*.42*exp(-vD*.006)*(.7 + .3*sin(uTime*.5 + cell.x*3.));
    float band = step(.985, h21(vec2(floor(abs(vWp.y)*.12), floor(u*.02) + salt.x)));
    col += vec3(.2,.8,1.)*band*.3;
  }
  gl_FragColor = vec4(fogOpaque(col, vD), 1.);
}`;

const WOOFER_FS = /* glsl */`
precision highp float;
uniform float uKick, uBeat, uHeat; uniform vec3 uCol;
varying vec2 vUv; varying float vD;
${FOG_FN}
void main(){
  float r = length(vUv - .5)*2.;
  if (r > 1.) discard;
  float ring = smoothstep(.08, 0., abs(r - .9));
  float cone = smoothstep(.65, 0., r)*(.15 + .5*pow(.5 + .5*sin(r*28. - uKick*5.), 2.));
  float dust = smoothstep(.22, 0., r)*uKick;
  vec3 col = (uCol*(ring*(1.2 + uKick*1.2) + cone*(.3 + uKick*.5)) + vec3(1.,.5,.2)*dust*.9)*(.18 + .82*smoothstep(.35, .9, uHeat));
  gl_FragColor = vec4(fogAdd(col, vD), 1.);
}`;

const BOARD_FS = /* glsl */`
precision highp float;
uniform sampler2D uTex; uniform float uGlow, uKick;
varying vec2 vUv; varying float vD;
${FOG_FN}
void main(){
  vec3 t = texture2D(uTex, vUv).rgb;
  vec3 col = t*(.1 + .85*uGlow)*(1. + uKick*.2*uGlow);
  gl_FragColor = vec4(fogOpaque(col, vD), 1.);
}`;
const NEON_FS = /* glsl */`
precision highp float;
uniform vec3 uColor; uniform float uA;
varying vec2 vUv; varying float vD;
${FOG_FN}
void main(){ gl_FragColor = vec4(fogAdd(uColor*uA, vD), 1.); }`;

const PRISM_FS = /* glsl */`
precision highp float;
uniform float uTime, uPrism, uKick;
varying vec3 vN; varying vec3 vWp; varying float vD;
${FOG_FN}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWp);
  float fres = pow(1. - abs(dot(N, V)), 2.2);
  vec3 irid = .5 + .5*cos(6.2832*(vec3(0., .33, .67) + fres*1.3 + uTime*.08));
  irid = mix(irid, vec3(.2,.8,1.), .35);
  float a = (.12 + fres*.95)*(.25 + uPrism*.9)*(1. + uKick*.4);
  gl_FragColor = vec4(fogAdd(irid*a*.45, vD), 1.);
}`;
const BEAM_FS = /* glsl */`
precision highp float;
uniform vec3 uColor; uniform float uA;
varying vec2 vUv; varying float vD;
${FOG_FN}
void main(){ float f = pow(1. - vUv.y, 1.6); gl_FragColor = vec4(fogAdd(uColor*uA*f, vD), 1.); }`;

const TROPHY_FS = /* glsl */`
precision highp float;
uniform float uTime, uFill, uKick, uWire;
varying vec3 vN; varying vec3 vWp; varying float vD; varying vec3 vPos;
${FOG_FN}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWp);
  float fres = pow(1. - abs(dot(N, V)), 1.6);
  float scan = .5 + .5*sin(vPos.y*14. - uTime*2.);
  vec3 gold = mix(vec3(1.,.55,.12), vec3(1.,.93,.65), fres);
  vec3 col = uWire > .5 ? vec3(1.,.8,.4)*(.5 + .4*scan)*(1. - .55*uFill)
                        : gold*(.15 + fres*1.3)*(.7 + .3*scan)*uFill*(1. + uKick*.4);
  gl_FragColor = vec4(fogAdd(col, vD), 1.);
}`;
const PILLAR_FS = /* glsl */`
precision highp float;
uniform float uA, uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vWp; varying float vD;
${FOG_FN}
void main(){
  vec3 V = normalize(cameraPosition - vWp);
  float e = pow(abs(dot(normalize(vN), V)), 1.5);
  float f = (1. - vUv.y)*(.6 + .4*sin(vUv.y*40. - uTime*3.));
  gl_FragColor = vec4(fogAdd(vec3(1.,.7,.3)*e*f*uA, vD), 1.);
}`;

const EMBER_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uA, uPx;
varying vec3 vCol; varying float vAl;
void main(){
  vec3 p;
  p.x = (aSeed.x - .5)*70.*(.45 + aSeed.w*.55) + sin(uTime*.4 + aSeed.w*40.)*(.8 + aSeed.z*1.5);
  p.z = (aSeed.z - .5)*70.*(.45 + aSeed.y*.55) + cos(uTime*.3 + aSeed.x*40.)*.8;
  p.y = mod(aSeed.y*30. + uA*(1. + aSeed.w*1.4), 30.) - 1.;
  vec4 mv = viewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = clamp((.07 + .14*aSeed.w)*uPx/max(-mv.z, .1), 1., 22.);
  float fl = .55 + .45*sin(uTime*3. + aSeed.w*50.);
  vCol = mix(vec3(1.,.28,.04), vec3(1.,.8,.35), aSeed.w);
  vAl = fl*smoothstep(0., 3., p.y + 1.)*smoothstep(30., 20., p.y + 1.);
}`;
const SOFT_FS = /* glsl */`
precision highp float;
varying vec3 vCol; varying float vAl;
void main(){ float r = length(gl_PointCoord - .5)*2.; float a = smoothstep(1., 0., r); a *= a; gl_FragColor = vec4(vCol*a*vAl*1.4, a*vAl); }`;

const CLOUD_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uCloud, uPx;
varying vec3 vCol; varying float vAl;
void main(){
  float ang = aSeed.x*6.2832 + uTime*.015;
  float rad = 12. + aSeed.y*36.;
  vec3 p = vec3(sin(ang)*rad, 12. + aSeed.z*14. + uCloud*6., cos(ang)*rad);
  vec4 mv = viewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = clamp((16. + 12.*aSeed.w)*uPx/max(-mv.z, .1)*uCloud, 1., 900.);
  vCol = aSeed.w < .35 ? vec3(1.,.35,.06) : (aSeed.w < .7 ? vec3(.9,.12,.5) : vec3(.45,.2,.95));
  vAl = .075*uCloud;
}`;

const RAIN_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uRain;
varying float vAl;
void main(){
  vec3 p;
  p.x = (aSeed.x - .5)*90.; p.z = (aSeed.z - .5)*90. + 5.;
  p.y = mod(aSeed.y*45. - uTime*(26. + fract(aSeed.w)*10.), 45.);
  float low = step(1.5, aSeed.w);
  p.y += low*.9; p.x += low*.12;
  vec4 mv = viewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
  vAl = uRain*smoothstep(0., 2., p.y)*exp(mv.z*.03);
}`;
const RAIN_FS = /* glsl */`
precision highp float; varying float vAl;
void main(){ gl_FragColor = vec4(vec3(.45,.7,1.)*vAl*.4, 1.); }`;

const TRAIL_FS = /* glsl */`
precision highp float;
uniform float uA;
varying vec2 vUv; varying float vD;
void main(){ float f = pow(vUv.y, 2.4); vec3 c = mix(vec3(1.,.3,.05), vec3(1.,.9,.6), f); gl_FragColor = vec4(c*f*uA*2., 1.); }`;

const FINAL = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAber: { value: 0 }, uFade: { value: 1 }, uGlitch: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
precision highp float;
uniform sampler2D tDiffuse; uniform float uTime, uAber, uFade, uGlitch; uniform vec2 uRes;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 uv = vUv;
  float fr = floor(uTime*60.);
  if (uGlitch > .001) {
    float band = floor(uv.y*16. + fr);
    float on = step(.62, h21(vec2(band, fr*.37)));
    uv.x += (h21(vec2(band, fr)) - .5)*.07*uGlitch*on;
  }
  vec2 off = (uv - .5)*uAber;
  vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
  if (uGlitch > .001) {
    float blk = step(.975, h21(floor(uv*vec2(48., 27.)) + fr));
    col += blk*uGlitch*vec3(.1,.05,.14);
    col.r += step(.9, h21(vec2(floor(uv.y*240.), fr)))*uGlitch*.05;
  }
  col += (h21(uv*uRes + fr*1.7) - .5)*.012;                               // fine film grain
  col *= 1. - .62*smoothstep(.34, 0., uv.y);                                // calm the lower third so text reads
  col *= mix(.45, 1., smoothstep(1.0, .3, length(uv - .5)*1.12));         // vignette
  col *= uFade;
  gl_FragColor = vec4(col, 1.);
}`,
};

function shader(fs, uniforms, o = {}) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: o.vs || STD_VS, fragmentShader: fs, ...o.opts });
}
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

// ---------------------------------------------------------------- canvas textures
function monolithTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 2048;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 2048);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [w, y] of [['KNOW', 0.22], ['MY', 0.34], ['NAME', 0.46]]) {
    let size = 190;
    g.font = `700 ${size}px Montserrat, 'Segoe UI', sans-serif`;
    size = Math.round(size * Math.min(1, 430 / g.measureText(w).width));
    g.font = `700 ${size}px Montserrat, 'Segoe UI', sans-serif`;
    g.fillText(w, 256, y * 2048);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

function boardTexture(spec) {
  const W = 1024, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(spec.seed);
  g.fillStyle = spec.bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(W / 2, H * 0.47); g.rotate(-0.05); g.transform(1, 0, -0.18, 1, 0, 0);
  const lines = spec.text.split('\n');
  let size = spec.size; g.font = `800 ${size}px ${spec.font}`;
  size = Math.round(size * Math.min(1, 800 / Math.max(...lines.map((l) => g.measureText(l).width))));
  g.font = `800 ${size}px ${spec.font}`;
  const lh = size * 1.05;
  lines.forEach((l, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = spec.stroke; g.strokeText(l, 0, y);
    g.shadowColor = spec.glow; g.shadowBlur = 26; g.fillStyle = spec.fill; g.fillText(l, 0, y);
    g.shadowBlur = 0; g.lineWidth = size * 0.035; g.strokeStyle = '#fff'; g.strokeText(l, 0, y);
  });
  g.restore();
  for (let i = 0; i < 26; i++) {   // paint drips
    const x = W / 2 - 360 + r() * 720, y0 = H * 0.55 + r() * 40, len = 20 + r() * 110;
    g.fillStyle = spec.fill; g.globalAlpha = 0.8; g.fillRect(x, y0, 3 + r() * 3, len); g.beginPath(); g.arc(x + 2, y0 + len, 4, 0, 6.3); g.fill(); g.globalAlpha = 1;
  }
  g.font = `700 30px ${spec.font}`; g.fillStyle = spec.glow; g.textAlign = 'right';
  g.fillText(spec.tag, W - 40, H - 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

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
    const u = (v) => ({ value: v });
    this.U = {
      uTime: u(0), uKick: u(0), uBeat: u(0), uHeat: u(0.1), uIgnite: u(0), uReveal: u(0), uGold: u(0), uHeal: u(0),
      uPrism: u(0), uFogD: u(0.03), uFogCol: u(new THREE.Color(0.03, 0.014, 0.032)), uPx: u(900), uA: u(0), uCloud: u(0), uRain: u(0.7), uFill: u(0),
    };
    this.buildWorld();
    this.buildPost();
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
  }

  precompute() {
    const an = this.an, n = an.low.length, fps = an.fps;
    this.kickE = new Float32Array(n); this.bassS = new Float32Array(n); this.A = new Float32Array(n);
    const kd = Math.exp(-5 / fps), bk = Math.min(1, 2 / fps);
    for (let i = 1; i < n; i++) {
      this.kickE[i] = Math.max(this.kickE[i - 1] * kd, an.kick[i] > 0.5 ? an.kick[i] : 0);
      this.bassS[i] = this.bassS[i - 1] + (an.low[i] - this.bassS[i - 1]) * bk;
      this.A[i] = this.A[i - 1] + mix(-0.9, 2.4, kf(RISE, i / fps)) / fps;   // ember vertical phase (integral of velocity)
    }
  }
  sampleA(t) {
    const x = clamp(t * this.an.fps, 0, this.A.length - 1.001), i = Math.floor(x);
    return this.A[i] + (this.A[i + 1] - this.A[i]) * (x - i);
  }

  buildWorld() {
    const U = this.U, scene = this.scene;
    const fogU = { uFogCol: U.uFogCol, uFogD: U.uFogD };

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 16), new THREE.ShaderMaterial({
      uniforms: { uHeat: U.uHeat, uBeat: U.uBeat, uFogCol: U.uFogCol }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uHeat: U.uHeat, uHeal: U.uHeal, uBeat: U.uBeat, uKick: U.uKick, ...fogU },
      vertexShader: STD_VS, fragmentShader: FLOOR_FS, transparent: true, depthWrite: false,
    }));
    this.floor.frustumCulled = false; this.floor.renderOrder = -5; scene.add(this.floor);

    // monolith (+ edges) and its mirror image under the glossy floor
    const monoMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uHeat: U.uHeat, uIgnite: U.uIgnite, uReveal: U.uReveal, uGold: U.uGold, uKick: U.uKick, uBeat: U.uBeat, uTex: { value: monolithTexture() }, ...fogU },
      vertexShader: STD_VS, fragmentShader: MONO_FS, side: THREE.DoubleSide,
    });
    const boxGeo = new THREE.BoxGeometry(3.4, 14, 1.6);
    const edgeMat = shader(NEON_FS, { uColor: { value: new THREE.Color('#2fd8ff') }, uA: { value: 0.9 }, ...fogU }, { vs: UV_VS, opts: ADD });
    for (const flip of [1, -1]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(boxGeo, monoMat));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat); e.renderOrder = 2; g.add(e);
      g.position.y = 7 * flip; g.scale.y = flip; scene.add(g);
    }

    this.buildCity(fogU);
    this.buildTowers(fogU);
    this.buildBoards(fogU);
    this.buildPrism(fogU);
    this.buildTrophy(fogU);
    this.buildAtmosphere(fogU);
  }

  buildCity(fogU) {
    const N = 190, geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: this.U.uTime, uHeat: this.U.uHeat, ...fogU }, vertexShader: BUILD_VS, fragmentShader: BUILD_FS, side: THREE.DoubleSide });
    const dummy = new THREE.Object3D();
    for (const flip of [1, -1]) {
      const im = new THREE.InstancedMesh(geo, mat, N), rr = rng(23);
      for (let i = 0; i < N; i++) {
        const a = rr() * Math.PI * 2, rad = 62 + rr() * 90, w = 6 + rr() * 10, d = 6 + rr() * 10, h = 18 + Math.pow(rr(), 1.6) * 95;
        dummy.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad); dummy.rotation.y = rr() * 3;
        dummy.scale.set(w, h * flip, d); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      im.frustumCulled = false; this.scene.add(im);
    }
  }

  buildTowers(fogU) {
    const U = this.U, boxGeo = new THREE.BoxGeometry(2.7, 2.2, 2.3), woofGeo = new THREE.CircleGeometry(1, 28), tweetGeo = new THREE.CircleGeometry(0.34, 16);
    const cab = new THREE.MeshBasicMaterial({ color: 0x07080f, side: THREE.DoubleSide });
    const edge = shader(NEON_FS, { uColor: { value: new THREE.Color('#ff5a0a') }, uA: { value: 0.35 }, ...fogU }, { vs: UV_VS, opts: ADD });
    const edgeGeo = new THREE.EdgesGeometry(boxGeo), cols = ['#ff6a10', '#ff2fb4', '#2fd8ff'];
    const spec = [[-13, 14, 0.45, 4], [13, 14, -0.45, 3], [-14, 3, 0.55, 5], [14, 3, -0.55, 4], [-12, -9, 0.8, 4], [12, -9, -0.8, 5]];
    const mats = cols.map((c) => shader(WOOFER_FS, { uKick: U.uKick, uBeat: U.uBeat, uHeat: U.uHeat, uCol: { value: new THREE.Color(c) }, ...fogU }, { vs: UV_VS, opts: ADD }));
    for (const flip of [1, -1]) {
      spec.forEach(([x, z, ry, n], si) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.y = flip;
        for (let i = 0; i < n; i++) {
          const y = 1.1 + i * 2.25, c = new THREE.Mesh(boxGeo, cab); c.position.y = y; g.add(c);
          const e = new THREE.LineSegments(edgeGeo, edge); e.position.y = y; e.renderOrder = 2; g.add(e);
          const wm = new THREE.Mesh(woofGeo, mats[(si + i) % 3]);
          wm.scale.setScalar(0.92); wm.position.set(0, y - 0.1, 1.17); wm.renderOrder = 2; g.add(wm);
          const tw = new THREE.Mesh(tweetGeo, mats[(si + i + 1) % 3]); tw.position.set(0, y + 0.82, 1.17); tw.renderOrder = 2; g.add(tw);
        }
        this.scene.add(g);
      });
    }
  }

  buildBoards(fogU) {
    const KR = "'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo',sans-serif", EN = "Montserrat,'Segoe UI',sans-serif";
    const specs = [
      { key: 'es', pos: [-20, 4.6, 8], col: '#ff7a1a', tex: { seed: 3, bg: '#150a06', font: EN, size: 150, text: 'NUESTRO\nNOMBRE', fill: '#ff8a1c', stroke: '#000', glow: '#ff5a00', tag: 'ES' } },
      { key: 'kr', pos: [3, 4.8, -13], look: [14, 4, 10], col: '#35e3ff', tex: { seed: 4, bg: '#06091a', font: KR, size: 190, text: '내 이름을 알아', fill: '#35e3ff', stroke: '#000', glow: '#ff2fb4', tag: 'KR' } },
      { key: 'en', pos: [-9, 5.2, -14], look: [0, 4, 30], col: '#ff2fb4', tex: { seed: 5, bg: '#12060f', font: EN, size: 140, text: 'RISE FROM\nTHE ASHES', fill: '#ff2fb4', stroke: '#000', glow: '#ff7a1a', tag: 'EN' } },
    ];
    this.boards = {};
    const geo = new THREE.PlaneGeometry(9, 5.6), edgeGeo = new THREE.EdgesGeometry(geo);
    for (const s of specs) {
      const glowU = { value: 0.2 };
      const mat = shader(BOARD_FS, { uTex: { value: boardTexture(s.tex) }, uGlow: glowU, uKick: this.U.uKick, ...fogU }, { vs: UV_VS, opts: { side: THREE.DoubleSide } });
      const fr = shader(NEON_FS, { uColor: { value: new THREE.Color(s.col) }, uA: glowU, ...fogU }, { vs: UV_VS, opts: ADD });
      for (const flip of [1, -1]) {
        const g = new THREE.Group(); g.position.set(s.pos[0], s.pos[1] * flip, s.pos[2]);
        const e = new THREE.LineSegments(edgeGeo, fr); e.renderOrder = 2; g.add(new THREE.Mesh(geo, mat), e);
        const lk = s.look || [0, 4, 14]; g.lookAt(lk[0], lk[1] * flip, lk[2]); g.scale.y = flip; this.scene.add(g);
      }
      this.boards[s.key] = glowU;
    }
  }

  buildPrism(fogU) {
    const U = this.U, pts = [[-1, 1], [1, 1], [1, 0.65], [-0.3, -0.65], [1, -0.65], [1, -1], [-1, -1], [-1, -0.65], [0.3, 0.65], [-1, 0.65]];
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 });
    geo.translate(0, 0, -0.35);
    const mat = shader(PRISM_FS, { uTime: U.uTime, uPrism: U.uPrism, uKick: U.uKick, ...fogU }, { opts: { ...ADD, side: THREE.DoubleSide } });
    const edgeMat = shader(NEON_FS, { uColor: { value: new THREE.Color('#9fe9ff') }, uA: { value: 1.0 }, ...fogU }, { vs: UV_VS, opts: ADD });
    const edgeGeo = new THREE.EdgesGeometry(geo, 25);
    const build = () => {
      const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), e = new THREE.LineSegments(edgeGeo, edgeMat);
      m.renderOrder = 3; e.renderOrder = 3; g.add(m, e); g.scale.setScalar(1.6); this.scene.add(g); return g;
    };
    this.prism = build(); this.prismM = build();
    this.prismPos = new THREE.Vector3(11, 6, -5);
    this.beams = new THREE.Group(); this.scene.add(this.beams);   // refracted light beams
    const beamCols = ['#2fd8ff', '#9b6bff', '#ff2fb4', '#bff6ff', '#2fd8ff', '#ff7a1a', '#9b6bff', '#ff2fb4'];
    this.beamMats = [];
    beamCols.forEach((c, i) => {
      const len = 30, bg = new THREE.CylinderGeometry(0.03, 0.03, len, 5, 1, true).translate(0, len / 2, 0);
      const bm = shader(BEAM_FS, { uColor: { value: new THREE.Color(c) }, uA: { value: 0 }, ...fogU }, { vs: UV_VS, opts: ADD });
      const m = new THREE.Mesh(bg, bm), a = (i / beamCols.length) * Math.PI * 2, el = (i % 3 - 1) * 0.5;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)));
      m.renderOrder = 3; this.beams.add(m); this.beamMats.push(bm);
    });
  }

  buildTrophy(fogU) {
    const U = this.U;
    const prof = [[0.001, 0], [1.5, 0], [1.55, 0.18], [1.1, 0.35], [0.45, 0.55], [0.28, 0.9], [0.3, 1.5], [0.7, 1.75], [1.2, 2.2], [1.55, 3.0], [1.65, 3.9], [1.5, 4.0], [1.35, 3.9]];
    const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28), hGeo = new THREE.TorusGeometry(0.9, 0.09, 6, 16, Math.PI);
    const mk = (wire) => shader(TROPHY_FS, { uTime: U.uTime, uFill: U.uFill, uKick: U.uKick, uWire: { value: wire ? 1 : 0 }, ...fogU }, { opts: { ...ADD, side: THREE.DoubleSide, wireframe: wire } });
    const solid = mk(false), wire = mk(true);
    const build = () => {
      const g = new THREE.Group();
      for (const mat of [solid, wire]) {
        const body = new THREE.Mesh(lathe, mat), hl = new THREE.Mesh(hGeo, mat), hr = new THREE.Mesh(hGeo, mat);
        hl.position.set(-1.55, 3.0, 0); hl.rotation.z = Math.PI / 2; hr.position.set(1.55, 3.0, 0); hr.rotation.z = -Math.PI / 2;
        for (const m of [body, hl, hr]) { m.renderOrder = 3; g.add(m); }
      }
      g.scale.setScalar(2); this.scene.add(g); return g;
    };
    this.trophy = build(); this.trophyM = build();
    this.pillarU = { value: 0 };
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.3, 90, 20, 1, true).translate(0, 45, 0),
      shader(PILLAR_FS, { uA: this.pillarU, uTime: U.uTime, ...fogU }, { opts: { ...ADD, side: THREE.DoubleSide } }));
    this.pillar.renderOrder = 3; this.scene.add(this.pillar);
  }

  buildAtmosphere(fogU) {
    const U = this.U, r = rng(5);
    const points = (n, vs, uniforms) => {
      const s = new Float32Array(n * 4); for (let i = 0; i < s.length; i++) s[i] = r();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
      const p = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: SOFT_FS, ...ADD }));
      p.frustumCulled = false; p.renderOrder = 4; this.scene.add(p); return p;
    };
    this.embers = points(5200, EMBER_VS, { uTime: U.uTime, uA: U.uA, uPx: U.uPx });
    this.clouds = points(170, CLOUD_VS, { uTime: U.uTime, uCloud: U.uCloud, uPx: U.uPx });

    // rain: 2 vertices per streak; aSeed.w >= 2 marks the lower end of the streak
    const RN = 2400, rs = new Float32Array(RN * 2 * 4);
    for (let i = 0; i < RN; i++) { const a = r(), b = r(), c = r(), d = r() * 0.4; for (let k = 0; k < 2; k++) rs.set([a, b, c, k ? 2 + d : d], (i * 2 + k) * 4); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RN * 2 * 3), 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(rs, 4));
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uRain: U.uRain }, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, ...ADD }));
    this.rain.frustumCulled = false; this.rain.renderOrder = 4; this.scene.add(this.rain);

    // rocket streak ("rocket on me like I'm NASA"): head at +Y, trail fades behind it
    this.trailU = { value: 0 };
    this.trail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.01, 16, 8, 1, true).translate(0, -8, 0), shader(TRAIL_FS, { uA: this.trailU }, { vs: UV_VS, opts: ADD }));
    this.trail.renderOrder = 4; this.trail.frustumCulled = false; this.scene.add(this.trail);
  }

  buildPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.tex = new THREE.CanvasTexture(this.typo.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.textScene = new THREE.Scene();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.textScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })));
    const tp = new RenderPass(this.textScene, this.ortho);
    tp.clear = false; tp.clearDepth = true;
    this.composer.addPass(tp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.5, 0.6, 0.5);
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
    this.U.uPx.value = (h * pr) / (2 * Math.tan((60 * Math.PI) / 360));
    this.camera.aspect = 16 / 9; this.camera.updateProjectionMatrix();
  }

  features(t) {
    const an = this.an, i = clamp(Math.floor(t * an.fps), 0, this.kickE.length - 1);
    const bp = (t - an.offset) / an.beatDur, bf = bp - Math.floor(bp);
    const beatPulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * bf), 3);
    return { kick: this.kickE[i], bass: this.bassS[i], hat: an.high[i], beatPos: bp, beatPulse, section: kf(HEAT, t), duration: an.duration };
  }

  // ---- the director: hard cut per shot, motion inside the shot, kick punch + Dutch tilt on top
  cameraAt(t, f) {
    let si = 0;
    for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].t) si = i;
    const s = SHOTS[si], t1 = SHOTS[si + 1] ? SHOTS[si + 1].t : this.an.duration;
    const u = EASE[s.e](clamp((t - s.t) / (t1 - s.t))), cam = this.camera;
    let p, l, fov;
    if (s.k === 'lerp') {
      p = s.a.p.map((v, i) => mix(v, s.b.p[i], u)); l = s.a.l.map((v, i) => mix(v, s.b.l[i], u)); fov = mix(s.a.f, s.b.f, u);
    } else {
      const a = mix(s.a[0], s.a[1], u), rad = mix(s.r[0], s.r[1], u), h = mix(s.h[0], s.h[1], u);
      p = [s.c[0] + Math.sin(a) * rad, s.c[1] + h, s.c[2] + Math.cos(a) * rad];
      l = s.l[0].map((v, i) => mix(v, s.l[1][i], u)); fov = mix(s.f[0], s.f[1], u);
    }
    const k = f.kick * s.punch * (0.6 + 0.6 * CHORUS(t));
    const fwd = new THREE.Vector3(l[0] - p[0], l[1] - p[1], l[2] - p[2]); const dist = fwd.length(); fwd.divideScalar(dist || 1);
    const sway = 0.05 + 0.04 * s.punch;
    cam.position.set(p[0] + Math.sin(t * 0.7) * sway, Math.max(0.45, p[1] + Math.sin(t * 0.53) * sway * 0.6), p[2] + Math.cos(t * 0.6) * sway);
    cam.position.addScaledVector(fwd, 0.16 * k * (1 + dist * 0.035));                           // dolly punch on the kick
    cam.position.y += Math.sin(Math.floor(t * 30) * 12.9898) * 0.02 * k;                        // deterministic micro-shake
    cam.lookAt(l[0], l[1], l[2]);
    const side = Math.floor(f.beatPos) % 2 ? 1 : -1;
    cam.rotateZ(side * 0.017 * k + Math.sin(t * 0.31) * 0.004);                                  // Dutch tilt on the beat
    cam.fov = fov - 2.6 * k; cam.updateProjectionMatrix();
    this.cutAge = t - s.t;
    return si;
  }

  render(t) {
    const an = this.an, U = this.U;
    const f = this.features(t);
    this.typo.draw(t, this.lines, f);
    this.tex.needsUpdate = true;

    // ---- cues -> uniforms
    const flick = t < 30 ? 0.06 * Math.sin(t * 17) * sm(10, 28, t) : 0;
    U.uTime.value = t; U.uKick.value = f.kick; U.uBeat.value = f.beatPulse * 0.6;
    U.uHeat.value = kf(HEAT, t) + flick;
    U.uIgnite.value = sm(29.9, 34.5, t); U.uReveal.value = sm(31, 36.5, t) * 1.1;
    U.uGold.value = sm(200, 212, t) * (1 - 0.5 * sm(232, 250, t));
    U.uHeal.value = kf(HEAL, t);
    U.uPrism.value = kf(PRISM, t);
    U.uFogD.value = kf(FOGD, t);
    U.uA.value = this.sampleA(t);
    U.uCloud.value = sm(189, 200, t) * (1 - 0.55 * sm(228, 245, t));
    U.uRain.value = 0.7 - 0.3 * CHORUS(t);
    U.uFill.value = sm(192, 208, t);
    this.boards.es.value = 0.18 + win(t, 92, 93, 98.5, 100) + win(t, 128, 129, 141, 142.5);
    this.boards.kr.value = 0.18 + win(t, 104, 105, 113.5, 115);
    this.boards.en.value = 0.18 + win(t, 72, 74, 90, 92) + win(t, 161, 163, 189, 191);

    this.shot = this.cameraAt(t, f);
    const cp = this.camera.position;
    this.sky.position.copy(cp);
    this.floor.position.set(cp.x, 0, cp.z);
    this.rain.position.set(Math.round(cp.x / 45) * 45, 0, Math.round(cp.z / 45) * 45);

    // prism: floats, slowly turns, throws beams (mirror copy follows under the floor)
    const pr = this.prismPos, py = pr.y + Math.sin(t * 0.9) * 0.35;
    this.prism.position.set(pr.x, py, pr.z); this.prism.rotation.y = t * 0.55;
    this.prismM.position.set(pr.x, -py, pr.z); this.prismM.rotation.y = t * 0.55; this.prismM.scale.set(1.6, -1.6, 1.6);
    this.beams.position.copy(this.prism.position); this.beams.rotation.y = t * 0.3;
    this.beamMats.forEach((m, i) => { m.uniforms.uA.value = U.uPrism.value * (0.25 + 0.75 * f.kick) * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7)) * 2.2; });

    // trophy: wireframe in the clouds, fills with light, lands on the monolith, pillar of light
    const ty = mix(28, 14.2, sm(194, 212, t)), vis = t > 188;
    this.trophy.visible = vis; this.trophyM.visible = vis; this.pillar.visible = t > 206;
    this.trophy.position.set(0, ty, 0); this.trophy.rotation.y = t * 0.4;
    this.trophyM.position.set(0, -ty, 0); this.trophyM.rotation.y = t * 0.4; this.trophyM.scale.set(2, -2, 2);
    this.pillar.position.set(0, ty + 8, 0);
    this.pillarU.value = sm(208, 214, t) * (1 - 0.4 * sm(232, 250, t)) * (0.7 + 0.5 * f.kick);

    // rocket flybys on the two NASA lines
    const fly = (a, b) => (t >= a && t <= b ? (t - a) / (b - a) : -1);
    const ru = Math.max(fly(67.4, 70.2), fly(116.2, 118.8));
    this.trail.visible = ru >= 0;
    if (ru >= 0) {
      const A = new THREE.Vector3(-70, 14, -30), B = new THREE.Vector3(70, 34, -55);
      this.trail.position.copy(A.clone().lerp(B, ru)); this.trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      this.trailU.value = Math.sin(ru * Math.PI) * 1.2;
    }

    // ---- post: bloom, chromatic aberration, glitch on every cut (and on strong kicks in the choruses), fades
    const cutG = this.cutAge < 0.16 ? Math.exp(-this.cutAge / 0.05) : 0;
    this.bloom.strength = 0.42 + 0.26 * f.kick + 0.1 * U.uHeat.value;
    const F = this.final.uniforms;
    F.uTime.value = t;
    F.uGlitch.value = Math.max(cutG, 0.2 * f.kick * CHORUS(t));
    F.uAber.value = 0.0007 + 0.0024 * f.kick + 0.014 * cutG;
    F.uFade.value = clamp((t - 0.2) / 1.6) * (1 - clamp((t - (an.duration - 3.5)) / 3.5));
    this.composer.render();
  }
}
