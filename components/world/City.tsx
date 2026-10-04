'use client';

import { RigidBody } from '@react-three/rapier';

/* ─── Simple tree: trunk cylinder + foliage sphere/cone ─── */
function Tree({ position, height = 4 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position} userData={{ outline: 0.035 }}>
      {/* Trunk */}
      <mesh castShadow position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[0.2, 0.3, height * 0.6, 8]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      {/* Foliage sphere */}
      <mesh castShadow position={[0, height * 0.75, 0]}>
        <sphereGeometry args={[height * 0.35, 10, 10]} />
        <meshStandardMaterial color="#72AC78" flatShading />
      </mesh>
      {/* Top cone */}
      <mesh castShadow position={[0, height * 1.0, 0]}>
        <coneGeometry args={[height * 0.25, height * 0.4, 8]} />
        <meshStandardMaterial color="#91BE89" flatShading />
      </mesh>
    </group>
  );
}

/* ─── Street lamp ─── */
function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh castShadow position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 5, 8]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      {/* Arm */}
      <mesh position={[0.4, 4.8, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.08]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      {/* Light bulb */}
      <mesh position={[0.8, 4.6, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial
          color="#FFF9C4"
          emissive="#FFE082"
          emissiveIntensity={1.2}
          toneMapped={false}
          userData={{ night: 'lamp' }}
        />
      </mesh>
      {/* Light cone shade */}
      <mesh position={[0.8, 4.75, 0]}>
        <coneGeometry args={[0.3, 0.2, 8]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
    </group>
  );
}

/* ─── Park bench ─── */
function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.1, 0.5]} />
        <meshStandardMaterial color="#8D6E63" />
      </mesh>
      {/* Back */}
      <mesh castShadow position={[0, 0.7, -0.2]}>
        <boxGeometry args={[1.6, 0.5, 0.08]} />
        <meshStandardMaterial color="#8D6E63" />
      </mesh>
      {/* Legs */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]}>
          <boxGeometry args={[0.08, 0.4, 0.5]} />
          <meshStandardMaterial color="#5D4037" />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Generic building ─── */
function Building({
  position,
  size,
  color,
  roofColor,
  windowColor = '#B3E5FC',
}: {
  position: [number, number, number];
  size: [number, number, number]; // [w, h, d]
  color: string;
  roofColor: string;
  windowColor?: string;
}) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Roof */}
      <mesh castShadow position={[0, h + 0.2, 0]}>
        <boxGeometry args={[w + 0.4, 0.4, d + 0.4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Windows — front */}
      {Array.from({ length: Math.max(1, Math.floor(w / 3)) }).map((_, i) => {
        const xStart = -w / 2 + 1.5;
        const xStep = (w - 3) / Math.max(1, Math.floor(w / 3) - 1) || 0;
        return Array.from({ length: Math.max(1, Math.floor(h / 3)) }).map((_, j) => (
          <mesh
            key={`fw-${i}-${j}`}
            position={[xStart + i * xStep, 2 + j * 2.5, d / 2 + 0.05]}
          >
            <boxGeometry args={[1, 1.2, 0.05]} />
            <meshStandardMaterial
              color={windowColor}
              emissive={windowColor}
              emissiveIntensity={0.1}
              userData={{ night: 'window' }}
              transparent
              opacity={0.75}
            />
          </mesh>
        ));
      })}
      {/* Door */}
      <mesh position={[0, 1, d / 2 + 0.05]}>
        <boxGeometry args={[1.2, 2, 0.05]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>
    </group>
  );
}

/* ─── Road segment ─── */
function Road({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number];
}) {
  return (
    <group position={position}>
      {/* Asphalt */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#747184" />
      </mesh>
      {/* Center dashes */}
      {Array.from({ length: Math.floor(Math.max(size[0], size[1]) / 4) }).map((_, i) => {
        const isHorizontal = size[0] > size[1];
        const totalLen = isHorizontal ? size[0] : size[1];
        const offset = -totalLen / 2 + 2 + i * 4;
        return (
          <mesh
            key={i}
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
            position={isHorizontal ? [offset, 0.03, 0] : [0, 0.03, offset]}
          >
            <planeGeometry args={isHorizontal ? [1.5, 0.15] : [0.15, 1.5]} />
            <meshStandardMaterial color="#E8D8A4" />
          </mesh>
        );
      })}
    </group>
  );
}

/* ─── Sidewalk ─── */
function Sidewalk({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number];
}) {
  return (
    <mesh receiveShadow position={position}>
      <boxGeometry args={[size[0], 0.15, size[1]]} />
      <meshStandardMaterial color="#FFF4E3" />
    </mesh>
  );
}

/* ─── Park zone with grass ─── */
function Park({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Grass patch */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial color="#83B976" />
      </mesh>

      {/* Path through park */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[2, 20]} />
        <meshStandardMaterial color="#FFF4E3" />
      </mesh>

      {/* Trees */}
      <Tree position={[-8, 0, -6]} height={5} />
      <Tree position={[-5, 0, 3]} height={4} />
      <Tree position={[6, 0, -4]} height={4.5} />
      <Tree position={[9, 0, 5]} height={3.5} />
      <Tree position={[-10, 0, 7]} height={4} />
      <Tree position={[3, 0, -8]} height={5.5} />
      <Tree position={[-3, 0, 8]} height={3.8} />

      {/* Benches */}
      <Bench position={[-2, 0, -3]} rotation={Math.PI / 2} />
      <Bench position={[2, 0, 4]} rotation={-Math.PI / 2} />
      <Bench position={[0, 0, -7]} />

      {/* Lamps */}
      <Lamp position={[-1, 0, -5]} />
      <Lamp position={[1, 0, 6]} />

      {/* Small pond */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[7, 0.04, 0]}>
        <circleGeometry args={[3, 24]} />
        <meshStandardMaterial color="#4FC3F7" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/* ─── Flower bed ─── */
function FlowerBed({ position }: { position: [number, number, number] }) {
  const colors = ['#DFA4BA', '#E4B797', '#E8D8A4', '#B89AC9', '#D99D9A'];
  return (
    <group position={position}>
      {colors.map((color, i) => (
        <mesh
          key={i}
          position={[
            Math.sin((i / colors.length) * Math.PI * 2) * 0.8,
            0.2,
            Math.cos((i / colors.length) * Math.PI * 2) * 0.8,
          ]}
        >
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* Dirt base */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.2, 12]} />
        <meshStandardMaterial color="#6D4C41" />
      </mesh>
    </group>
  );
}

/* ════════════════════════════════════════════
   Main City component
   Hospital is at origin; city wraps around it
   ════════════════════════════════════════════ */
export function City() {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group userData={{ batch: true }}>
        {/* ═══ ROADS ═══ */}
        {/* Main road — east-west (in front of hospital) */}
        <Road position={[0, 0, 18]} size={[120, 8]} />
        {/* Main road — north-south */}
        <Road position={[20, 0, 0]} size={[8, 120]} />
        {/* Side road west */}
        <Road position={[-25, 0, 0]} size={[8, 60]} />
        {/* Cross road south */}
        <Road position={[0, 0, -20]} size={[80, 8]} />

        {/* ═══ SIDEWALKS ═══ */}
        <Sidewalk position={[0, 0.08, 13]} size={[120, 1.5]} />
        <Sidewalk position={[0, 0.08, 23]} size={[120, 1.5]} />
        <Sidewalk position={[15.5, 0.08, 0]} size={[1.5, 60]} />
        <Sidewalk position={[24.5, 0.08, 0]} size={[1.5, 60]} />
        <Sidewalk position={[-20.5, 0.08, 0]} size={[1.5, 60]} />
        <Sidewalk position={[-29.5, 0.08, 0]} size={[1.5, 60]} />

        {/* ═══ BUILDINGS ═══ */}

        {/* -- SOUTH of hospital road -- */}
        {/* House — pastel pink */}
        <Building
          position={[-15, 0, 32]}
          size={[8, 6, 7]}
          color="#F8BBD0"
          roofColor="#B97F96"
        />
        {/* Store — warm yellow */}
        <Building
          position={[-3, 0, 34]}
          size={[10, 5, 8]}
          color="#FFF9C4"
          roofColor="#C5A174"
          windowColor="#FFECB3"
        />
        {/* Store awning */}
        <mesh castShadow position={[-3, 4.5, 38.3]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[10.5, 0.1, 2]} />
          <meshStandardMaterial color="#FF6F00" />
        </mesh>

        {/* Apartment — blue */}
        <Building
          position={[12, 0, 33]}
          size={[9, 10, 8]}
          color="#BBDEFB"
          roofColor="#7F96B4"
        />
        {/* School flag pole */}
        <mesh position={[28, 3.5, 32]}>
          <cylinderGeometry args={[0.05, 0.05, 7, 6]} />
          <meshStandardMaterial color="#9E9E9E" />
        </mesh>
        <mesh position={[28.4, 6.5, 32]}>
          <boxGeometry args={[0.8, 0.5, 0.02]} />
          <meshStandardMaterial color="#E53935" />
        </mesh>

        {/* -- EAST side -- */}
        {/* Tall office building */}
        <Building
          position={[35, 0, -5]}
          size={[8, 14, 8]}
          color="#E0E0E0"
          roofColor="#8D8999"
          windowColor="#80CBC4"
        />

        {/* Pharmacy — small, purple-ish */}
        <Building
          position={[35, 0, 8]}
          size={[7, 5, 6]}
          color="#CE93D8"
          roofColor="#9D87B0"
        />
        {/* Pharmacy cross */}
        <group position={[35, 4, 11.1]}>
          <mesh>
            <boxGeometry args={[0.4, 1.2, 0.1]} />
            <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.4} />
          </mesh>
          <mesh>
            <boxGeometry args={[1.2, 0.4, 0.1]} />
            <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* -- WEST side -- */}

        {/* -- NORTH -- */}
        {/* Cafe — coral */}
        <Building
          position={[-10, 0, -28]}
          size={[8, 5, 7]}
          color="#FFAB91"
          roofColor="#B28B80"
        />
        {/* Bakery — cream */}
        <Building
          position={[5, 0, -30]}
          size={[9, 5, 6]}
          color="#FFF3E0"
          roofColor="#C5A174"
        />

        {/* ═══ PARK — south-east ═══ */}
        <Park position={[-40, 0, 38]} />

        {/* ═══ SCATTERED TREES along roads ═══ */}
        <Tree position={[10, 0, 13.5]} height={3} />
        <Tree position={[-8, 0, 13.5]} height={3.5} />
        <Tree position={[30, 0, 23.5]} height={2.8} />
        <Tree position={[-20, 0, 23.5]} height={3.2} />

        {/* Trees along N-S road */}
        <Tree position={[15, 0, -10]} height={3} />
        <Tree position={[25, 0, -12]} height={3.5} />
        <Tree position={[15, 0, 10]} height={2.8} />

        {/* ═══ STREET LAMPS ═══ */}
        <Lamp position={[-12, 0, 13]} />
        <Lamp position={[8, 0, 13]} />
        <Lamp position={[28, 0, 13]} />
        <Lamp position={[-12, 0, 23]} />
        <Lamp position={[8, 0, 23]} />
        <Lamp position={[28, 0, 23]} />
        <Lamp position={[15.5, 0, -8]} />
        <Lamp position={[15.5, 0, 8]} />
        <Lamp position={[24.5, 0, -8]} />
        <Lamp position={[24.5, 0, 8]} />

        {/* ═══ FLOWER BEDS ═══ */}
        <FlowerBed position={[-5, 0, 12.5]} />
        <FlowerBed position={[5, 0, 12.5]} />
        <FlowerBed position={[35, 0, 14]} />
        <FlowerBed position={[-38, 0, 14]} />

        {/* ═══ DECORATIVE: mailbox ═══ */}
        <group position={[13, 0, 24]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1, 6]} />
            <meshStandardMaterial color="#757575" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.5, 0.4, 0.35]} />
            <meshStandardMaterial color="#1565C0" />
          </mesh>
        </group>

        {/* ═══ DECORATIVE: fire hydrant ═══ */}
        <group position={[-14, 0, 23.5]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.15, 0.18, 0.7, 8]} />
            <meshStandardMaterial color="#E53935" />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#E53935" />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
