"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const markers = [
  { lat: 40.7128, lng: -74.006, label: "New York" },
  { lat: 51.5074, lng: -0.1278, label: "London" },
  { lat: 35.6762, lng: 139.6503, label: "Tokyo" },
  { lat: -33.8688, lng: 151.2093, label: "Sydney" },
  { lat: 48.8566, lng: 2.3522, label: "Paris" },
  { lat: 28.6139, lng: 77.209, label: "New Delhi" },
  { lat: 55.7558, lng: 37.6173, label: "Moscow" },
  { lat: -22.9068, lng: -43.1729, label: "Rio de Janeiro" },
  { lat: 31.2304, lng: 121.4737, label: "Shanghai" },
  { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  { lat: -34.6037, lng: -58.3816, label: "Buenos Aires" },
  { lat: 1.3521, lng: 103.8198, label: "Singapore" },
  { lat: 37.5665, lng: 126.978, label: "Seoul" },
];

const flightRoutes = [
  ["New York", "London"],
  ["London", "Dubai"],
  ["London", "Tokyo"],
  ["Paris", "New Delhi"],
  ["Dubai", "Singapore"],
  ["Singapore", "Sydney"],
  ["Tokyo", "Seoul"],
  ["New York", "Rio de Janeiro"],
] as const;

function pointOnSphere(lat: number, lng: number, radius = 1.012): [number, number, number] {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  return [
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.sin(latitude),
    -radius * Math.cos(latitude) * Math.sin(longitude),
  ];
}

function GlobeFlights({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <>
      {flightRoutes.map(([from, to], index) => {
        const origin = markers.find(marker => marker.label === from);
        const destination = markers.find(marker => marker.label === to);
        if (!origin || !destination) return null;
        return (
          <FlightArc
            key={`${from}-${to}`}
            start={pointOnSphere(origin.lat, origin.lng)}
            end={pointOnSphere(destination.lat, destination.lng)}
            delay={index * 0.13}
            reduceMotion={reduceMotion}
          />
        );
      })}
    </>
  );
}

function FlightArc({ start, end, delay, reduceMotion }: {
  start: [number, number, number];
  end: [number, number, number];
  delay: number;
  reduceMotion: boolean;
}) {
  const traveler = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const points = useMemo(() => {
    const a = new THREE.Vector3(...start).normalize();
    const b = new THREE.Vector3(...end).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(a, b);
    return Array.from({ length: 65 }, (_, index) => {
      const progress = index / 64;
      const point = a.clone().applyQuaternion(new THREE.Quaternion().slerp(rotation, progress));
      point.multiplyScalar(1.012 + Math.sin(Math.PI * progress) * 0.033);
      return point;
    });
  }, [start, end]);

  useFrame((_, delta) => {
    if (!traveler.current) return;
    progressRef.current = (progressRef.current + delta * 0.15) % 1;
    const progress = reduceMotion ? 0.5 : (progressRef.current + delay) % 1;
    const scaled = progress * (points.length - 1);
    const index = Math.floor(scaled);
    traveler.current.position.lerpVectors(points[index], points[Math.min(index + 1, points.length - 1)], scaled - index);
  });

  return (
    <>
      <Line points={points} color="#78e7b0" lineWidth={1.25} transparent opacity={0.42} depthTest />
      <mesh ref={traveler} position={points[0].toArray()}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color="#d8ffeb" toneMapped={false} />
      </mesh>
    </>
  );
}

function GlobeSurface({ texture }: { texture?: THREE.Texture }) {
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={texture} color={texture ? "#ffffff" : "#091813"} toneMapped={false} />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#54c98b" transparent opacity={0.09} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

function GlobeMarkers({ selected, onSelect }: { selected: string | undefined; onSelect: (label: string) => void }) {
  const [hovered, setHovered] = useState<string>();

  return (
    <>
      {markers.map(marker => {
        const active = selected === marker.label || hovered === marker.label;
        return (
          <group key={marker.label} position={pointOnSphere(marker.lat, marker.lng)}>
            <mesh
              onClick={event => { event.stopPropagation(); onSelect(marker.label); }}
              onPointerOver={event => { event.stopPropagation(); setHovered(marker.label); }}
              onPointerOut={() => setHovered(current => current === marker.label ? undefined : current)}
            >
              <sphereGeometry args={[active ? 0.032 : 0.022, 16, 16]} />
              <meshBasicMaterial color={active ? "#79e2a8" : "#78a9f0"} toneMapped={false} />
            </mesh>
            <mesh scale={active ? 2.2 : 1.7}>
              <sphereGeometry args={[0.022, 12, 12]} />
              <meshBasicMaterial color="#54c98b" transparent opacity={0.2} depthWrite={false} />
            </mesh>
            {hovered === marker.label && (
              <Html position={[0, 0.06, 0]} center distanceFactor={5} style={{ pointerEvents: "none" }}>
                <span className="whitespace-nowrap rounded-full border border-green/40 bg-bg/90 px-2.5 py-1 font-mono text-[11px] text-ink shadow-l2 backdrop-blur">
                  {marker.label}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function GlobeScene({ selected, onSelect, reduceMotion, texture }: { selected: string | undefined; onSelect: (label: string) => void; reduceMotion: boolean; texture?: THREE.Texture }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 2, 4]} intensity={2.1} color="#d6ffe8" />
      <pointLight position={[-3, -2, -3]} intensity={0.8} color="#5c8edb" />
      <GlobeSurface texture={texture} />
      <GlobeFlights reduceMotion={reduceMotion} />
      <GlobeMarkers selected={selected} onSelect={onSelect} />
      <OrbitControls
        autoRotate={!reduceMotion}
        autoRotateSpeed={0.35}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI * 0.16}
        maxPolarAngle={Math.PI * 0.84}
      />
    </>
  );
}

export function TravelGlobe({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const [selected, setSelected] = useState<string>();
  const [texture, setTexture] = useState<THREE.Texture>();
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    const image = new Image();
    let active = true;
    let loadedTexture: THREE.CanvasTexture | undefined;
    image.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 1024;
      const context = canvas.getContext("2d");
      if (!context) {
        setMapUnavailable(true);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      loadedTexture = new THREE.CanvasTexture(canvas);
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.anisotropy = 4;
      setTexture(loadedTexture);
    };
    image.onerror = () => {
      if (active) setMapUnavailable(true);
    };
    image.src = "/globe-map.svg";
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      loadedTexture?.dispose();
    };
  }, []);

  return (
    <figure className="relative mx-auto w-full max-w-[30rem]" aria-label="Interactive globe with major travel destinations">
      <div className="pointer-events-none absolute inset-[12%] rounded-full bg-green/10 blur-3xl" aria-hidden />
      <div className="relative h-[19rem] w-full sm:h-[24rem] lg:h-[27rem]">
        <Canvas
          aria-label="3D globe. Drag to rotate and click a marker to select a city."
          camera={{ position: [0, 0, 3.15], fov: 42 }}
          dpr={[1, 1.5]}
          frameloop={reduceMotion ? "demand" : "always"}
          gl={{ alpha: true, antialias: true }}
        >
          <GlobeScene selected={selected} onSelect={setSelected} reduceMotion={reduceMotion} texture={texture} />
        </Canvas>
      </div>
      <figcaption className="mt-1 flex min-h-8 items-center justify-between gap-3 font-mono text-[11px] text-muted">
        <span aria-live="polite">{mapUnavailable ? "Globe map unavailable" : selected ? `Selected · ${selected}` : "Drag to rotate · select a destination"}</span>
        <label className="sr-only" htmlFor="globe-destination">Select a destination on the globe</label>
        <select
          id="globe-destination"
          value={selected ?? ""}
          onChange={event => setSelected(event.target.value || undefined)}
          className="max-w-36 rounded-lg border border-line-strong bg-surface/90 px-2 py-1 text-[11px] text-ink2 focus-visible:outline-green-bright"
        >
          <option value="">Choose city</option>
          {markers.map(marker => <option key={marker.label} value={marker.label}>{marker.label}</option>)}
        </select>
      </figcaption>
    </figure>
  );
}
