'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useNpc, useMarker, MissionMarker } from './useNpc';
import { BlobShadow } from '@/components/fx/Shadows';
import { groundHeight } from '@/lib/ground';

interface BabyProps {
  id: string;
  position: [number, number, number];
  bodyColor?: string;
  name?: string;
}

const FLOAT_SPEED = 2;
// Rebote suave de respiración (antes flotaban: parecía gente en el aire)
const FLOAT_AMPLITUDE = 0.012;
const FEET = 0.06 * 1.35; // altura de los pies en el modelo (escala 1.35)

export default function Baby({
  id,
  position,
  bodyColor = '#fce4ec',
  name = 'Bebé',
}: BabyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const floatPhase = useRef(Math.random() * Math.PI * 2);
  const { isNear, cheerRef } = useNpc(id, position);
  // La posición de datos está ~0.5 m sobre el piso: apoyar el modelo en el suelo real
  const ground = groundHeight(position[0], position[2], position[1]) - position[1];
  const marker = useMarker(id);

  const materials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: '#ffe0bd' }),
      body: new THREE.MeshStandardMaterial({ color: bodyColor }),
      eye: new THREE.MeshStandardMaterial({ color: '#2c2c2c' }),
      eyeWhite: new THREE.MeshStandardMaterial({ color: '#ffffff' }),
      cheek: new THREE.MeshStandardMaterial({
        color: '#ffb3b3',
        transparent: true,
        opacity: 0.5,
      }),
      diaper: new THREE.MeshStandardMaterial({ color: '#e3f2fd' }),
    }),
    [bodyColor]
  );

  const geometries = useMemo(
    () => ({
      head: new THREE.SphereGeometry(0.2, 16, 16),
      body: new THREE.SphereGeometry(0.15, 16, 16),
      eye: new THREE.SphereGeometry(0.04, 8, 8),
      eyeWhite: new THREE.SphereGeometry(0.06, 8, 8),
      cheek: new THREE.SphereGeometry(0.04, 8, 8),
      arm: new THREE.CylinderGeometry(0.035, 0.03, 0.15, 8),
      leg: new THREE.CylinderGeometry(0.04, 0.035, 0.12, 8),
      diaper: new THREE.SphereGeometry(0.14, 16, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.5),
    }),
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Floating idle animation
    floatPhase.current += delta * FLOAT_SPEED;
    groupRef.current.position.y = Math.sin(floatPhase.current) * FLOAT_AMPLITUDE;
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
    >
      <CapsuleCollider args={[0.15, 0.12]} position={[0, 0.3, 0]} sensor />

      <group position={[0, ground, 0]}>
        <BlobShadow scale={0.6} />
      </group>
      <group position={[0, ground - FEET, 0]}>
      <group ref={cheerRef} scale={1.35}>
      {marker && <MissionMarker kind={marker} height={1.25} />}
      <group ref={groupRef} userData={{ outline: 0.012, batchLocal: true }}>
        {/* === HEAD (big, baby proportion) === */}
        <group position={[0, 0.55, 0]}>
          <mesh geometry={geometries.head} material={materials.skin} />

          {/* Left eye white */}
          <mesh
            geometry={geometries.eyeWhite}
            material={materials.eyeWhite}
            position={[-0.08, 0.03, 0.16]}
          />
          {/* Left pupil */}
          <mesh
            geometry={geometries.eye}
            material={materials.eye}
            position={[-0.08, 0.03, 0.2]}
          />

          {/* Right eye white */}
          <mesh
            geometry={geometries.eyeWhite}
            material={materials.eyeWhite}
            position={[0.08, 0.03, 0.16]}
          />
          {/* Right pupil */}
          <mesh
            geometry={geometries.eye}
            material={materials.eye}
            position={[0.08, 0.03, 0.2]}
          />

          {/* Left cheek */}
          <mesh
            geometry={geometries.cheek}
            material={materials.cheek}
            position={[-0.14, -0.04, 0.13]}
          />
          {/* Right cheek */}
          <mesh
            geometry={geometries.cheek}
            material={materials.cheek}
            position={[0.14, -0.04, 0.13]}
          />
        </group>

        {/* === BODY (small, round) === */}
        <group position={[0, 0.3, 0]}>
          <mesh geometry={geometries.body} material={materials.body} />
          {/* Diaper */}
          <mesh
            geometry={geometries.diaper}
            material={materials.diaper}
            position={[0, -0.04, 0]}
          />
        </group>

        {/* === ARMS === */}
        <mesh
          geometry={geometries.arm}
          material={materials.skin}
          position={[-0.18, 0.32, 0]}
          rotation={[0, 0, 0.3]}
        />
        <mesh
          geometry={geometries.arm}
          material={materials.skin}
          position={[0.18, 0.32, 0]}
          rotation={[0, 0, -0.3]}
        />

        {/* === LEGS === */}
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[-0.08, 0.12, 0]}
        />
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[0.08, 0.12, 0]}
        />

        {/* === FLOATING ICON when player is nearby === */}
        {isNear && !marker && (
          <Html
            zIndexRange={[10, 0]}
            position={[0, 0.85, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                fontSize: 28,
                animation: 'bounce 0.6s ease-in-out infinite alternate',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            >
              ❤️
            </div>
            <style>{`
              @keyframes bounce {
                from { transform: translateY(0); }
                to { transform: translateY(-8px); }
              }
            `}</style>
          </Html>
        )}

        {/* Name tag */}
        {/* Solo cerca: cada <Html> se reposiciona en cada frame aunque esté invisible */}
        {isNear && (
        <Html
          zIndexRange={[10, 0]}
          position={[0, 0.95, 0]}
          center
          style={{ pointerEvents: 'none' }}
          occlude={false}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              opacity: isNear ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            {name}
          </div>
        </Html>
        )}
      </group>
      </group>
      </group>
    </RigidBody>
  );
}
