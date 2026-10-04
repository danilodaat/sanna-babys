'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { player } from '@/lib/runtime';
import { floorOf, insideHospital } from '@/lib/hospital';

/** Solo para grupos visuales sin colliders; null corresponde al exterior. */
export function useFloorVisibility(level: number | null) {
  const visualRef = useRef<THREE.Group>(null);
  const visibleNow = () =>
    level === null || !insideHospital(player.position.x, player.position.z) || level <= floorOf(player.position.y);
  const [floorVisible, setFloorVisible] = useState(visibleNow);

  useFrame(() => {
    const visible = visibleNow();
    if (visualRef.current) visualRef.current.visible = visible;
    if (visible !== floorVisible) setFloorVisible(visible);
  });

  return { visualRef, floorVisible };
}
