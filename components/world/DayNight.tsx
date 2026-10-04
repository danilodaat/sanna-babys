'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { world, player, DAY_LENGTH } from '@/lib/runtime';
import { nightMaterials } from '@/components/fx/Toonify';
import { useGameStore } from '@/store/gameStore';
import { floorBase, floorOf, insideHospital } from '@/lib/hospital';
import { useRenderQuality } from '@/components/fx/AdaptiveQuality';

/*
 * Ciclo día/noche: mueve el sol y la luna, interpola colores del cielo,
 * niebla y luces entre keyframes, enciende faroles y ventanas al anochecer.
 * La luz direccional sigue al jugador para que las sombras sean nítidas
 * en todo el mapa (no solo alrededor del origen).
 */

interface Key {
  t: number;
  top: string;
  bottom: string;
  sun: string;
  sunI: number;
  amb: string;
  ambI: number;
  hemiI: number;
}

// 0 = medianoche · 0.25 amanecer · 0.5 mediodía · 0.75 atardecer
const KEYS: Key[] = [
  { t: 0.0, top: '#0B1030', bottom: '#27305E', sun: '#8FA8FF', sunI: 0.35, amb: '#B5AEDB', ambI: 0.55, hemiI: 0.26 },
  { t: 0.2, top: '#1B1D4A', bottom: '#5A4E86', sun: '#9FB0FF', sunI: 0.3, amb: '#B5AEDB', ambI: 0.55, hemiI: 0.26 },
  { t: 0.26, top: '#5C7FD6', bottom: '#FFB38A', sun: '#FFB27A', sunI: 0.8, amb: '#FFD9C2', ambI: 0.55, hemiI: 0.25 },
  { t: 0.34, top: '#5FB4F5', bottom: '#CDEBFF', sun: '#FFF1D6', sunI: 1.25, amb: '#FFF6E5', ambI: 0.58, hemiI: 0.28 },
  { t: 0.5, top: '#4AA8F2', bottom: '#D4EEFF', sun: '#FFFBEF', sunI: 1.4, amb: '#FFF8E7', ambI: 0.6, hemiI: 0.28 },
  { t: 0.66, top: '#58A6EE', bottom: '#DDEBFF', sun: '#FFEBC8', sunI: 1.25, amb: '#FFF2DC', ambI: 0.58, hemiI: 0.28 },
  { t: 0.74, top: '#6E6AC8', bottom: '#FF9A6B', sun: '#FF8F5A', sunI: 0.85, amb: '#FFC4A8', ambI: 0.55, hemiI: 0.25 },
  { t: 0.8, top: '#2A2A66', bottom: '#B3668A', sun: '#C49BFF', sunI: 0.4, amb: '#C1AEDC', ambI: 0.55, hemiI: 0.26 },
  { t: 1.0, top: '#0B1030', bottom: '#27305E', sun: '#8FA8FF', sunI: 0.35, amb: '#B5AEDB', ambI: 0.55, hemiI: 0.26 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function sample(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const f = THREE.MathUtils.smoothstep(t, a.t, b.t);
  const mix = (ca: string, cb: string, out: THREE.Color) => out.copy(tmpA.set(ca)).lerp(tmpB.set(cb), f);
  return {
    mix,
    a,
    b,
    f,
    num: (x: number, y: number) => x + (y - x) * f,
  };
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 1.4 + 0.15, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(h, 0.8));
    // halo del sol
    float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * pow(d, 18.0) * 0.35 * (1.0 - uNight);
    col += uSunColor * pow(d, 400.0) * 1.2 * (1.0 - uNight);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Stars() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // hemisferio superior
      const u = Math.random();
      const v = Math.random() * 0.9 + 0.08;
      const theta = u * Math.PI * 2;
      const y = v;
      const r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(theta) * r * 170;
      pos[i * 3 + 1] = y * 170;
      pos[i * 3 + 2] = Math.sin(theta) * r * 170;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#FFFFFF',
        size: 1.6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useFrame((state) => {
    material.opacity = world.night * (0.75 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
    if (ref.current) ref.current.visible = world.night > 0.02;
  });
  return <points ref={ref} geometry={geometry} material={material} userData={{ noToon: true }} />;
}

export default function DayNight() {
  const shadows = useRenderQuality((s) => s.shadows);
  const started = useGameStore((s) => s.started);

  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const skyGroup = useRef<THREE.Group>(null);
  const sunMesh = useRef<THREE.Mesh>(null);
  const moonMesh = useRef<THREE.Mesh>(null);
  const hospitalLight = useRef<THREE.PointLight>(null);

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color() },
          uNight: { value: 0 },
        },
      }),
    [],
  );

  const fog = useMemo(() => new THREE.Fog('#CDEBFF', 55, 150), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    // En la pantalla de inicio el tiempo corre más rápido: se luce el ciclo
    const speed = started ? world.timeScale : 6;
    world.time = (world.time + (delta * speed) / DAY_LENGTH) % 1;
    const t = world.time;

    // Elevación del sol: -1 medianoche, 1 mediodía
    const ang = (t - 0.25) * Math.PI * 2;
    sunDir.set(Math.cos(ang) * 0.8, Math.sin(ang), -0.45).normalize();
    const elev = sunDir.y;
    const nightTarget = THREE.MathUtils.clamp(0.5 - elev * 3, 0, 1);
    world.night = nightTarget;

    const s = sample(t);

    s.mix(s.a.top, s.b.top, skyMat.uniforms.uTop.value);
    s.mix(s.a.bottom, s.b.bottom, skyMat.uniforms.uBottom.value);
    s.mix(s.a.sun, s.b.sun, skyMat.uniforms.uSunColor.value);
    skyMat.uniforms.uSunDir.value.copy(sunDir);
    skyMat.uniforms.uNight.value = world.night;
    fog.color.copy(skyMat.uniforms.uBottom.value);

    // La luz viene del sol de día y de la luna de noche
    const lightDir = elev > -0.05 ? sunDir : tmpDir.copy(sunDir).negate();
    if (sun.current) {
      s.mix(s.a.sun, s.b.sun, sun.current.color);
      sun.current.intensity = s.num(s.a.sunI, s.b.sunI);
      sun.current.position.copy(player.position).addScaledVector(lightDir, 60);
      lightTarget.position.copy(player.position);
      lightTarget.updateMatrixWorld();
    }
    if (amb.current) {
      s.mix(s.a.amb, s.b.amb, amb.current.color);
      amb.current.intensity = s.num(s.a.ambI, s.b.ambI);
    }
    if (hemi.current) {
      hemi.current.intensity = s.num(s.a.hemiI, s.b.hemiI);
      hemi.current.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, world.night);
      hemi.current.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, world.night);
    }

    // Sol y luna visibles en el cielo; el grupo sigue a la cámara para que no se acerquen nunca
    if (skyGroup.current) skyGroup.current.position.copy(player.position);
    if (sunMesh.current) sunMesh.current.position.copy(sunDir).multiplyScalar(150);
    if (moonMesh.current) moonMesh.current.position.copy(sunDir).multiplyScalar(-150);

    // Faroles y ventanas
    const glow = THREE.MathUtils.smoothstep(world.night, 0.25, 0.8);
    // El hospital nunca se apaga: luz cálida interior al anochecer
    if (hospitalLight.current) {
      const f = insideHospital(player.position.x, player.position.z) ? floorOf(player.position.y) : 0;
      hospitalLight.current.position.y = floorBase(f) + 3.6;
      hospitalLight.current.intensity = glow * 2.2;
      hospitalLight.current.visible = glow > 0.01;
    }
    for (const nm of nightMaterials) {
      if (nm.kind === 'lamp') {
        nm.material.emissiveIntensity = nm.baseIntensity * (0.25 + glow * 2.2);
      } else {
        nm.material.emissive.copy(nm.baseEmissive).lerp(WARM, glow);
        nm.material.emissiveIntensity = nm.baseIntensity + glow * 0.9;
      }
    }
  });

  const shadowSize = 2048;

  return (
    <>
      <primitive object={fog} attach="fog" />
      <primitive object={lightTarget} />
      <ambientLight ref={amb} intensity={0.6} />
      <hemisphereLight ref={hemi} args={['#BFE3FF', '#8FCB78', 0.28]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        target={lightTarget}
        intensity={1.2}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />

      <pointLight ref={hospitalLight} position={[0, 5.5, 0]} color="#FFE2B0" distance={26} decay={1} intensity={0} />

      <group ref={skyGroup}>
        <mesh material={skyMat} userData={{ noToon: true }} renderOrder={-1}>
          <sphereGeometry args={[180, 32, 16]} />
        </mesh>
        <Stars />
        <mesh ref={sunMesh} userData={{ noToon: true }}>
          <sphereGeometry args={[7, 20, 20]} />
          <meshBasicMaterial color={new THREE.Color('#FFE58A').multiplyScalar(2)} toneMapped={false} fog={false} />
        </mesh>
        <mesh ref={moonMesh} userData={{ noToon: true }}>
          <sphereGeometry args={[4.5, 20, 20]} />
          <meshBasicMaterial color={new THREE.Color('#E8EEFF').multiplyScalar(1.4)} toneMapped={false} fog={false} />
        </mesh>
      </group>
    </>
  );
}

const WARM = new THREE.Color('#FFC970');
const HEMI_DAY = new THREE.Color('#BFE3FF');
const HEMI_NIGHT = new THREE.Color('#C6BDEA');
const GROUND_DAY = new THREE.Color('#8FCB78');
const GROUND_NIGHT = new THREE.Color('#9C90BC');
const tmpDir = new THREE.Vector3();
