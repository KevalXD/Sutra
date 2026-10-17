"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const CITIES = [
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
  // Demo journey (Karnataka). Station-level coordinates, accurate to ~1 km, which is
  // far finer than the globe can show: they sit within ~2 degrees of each other.
  { lat: 12.8718, lng: 74.844, label: "Mangaluru Central" },
  { lat: 13.005, lng: 76.099, label: "Hassan Junction" },
  { lat: 12.3159, lng: 76.6525, label: "Mysuru Junction" },
] as const;

type CityName = (typeof CITIES)[number]["label"];

// Typed against CityName, so a typo in a route is a compile error rather than
// a silently missing arc.
const ROUTES: ReadonlyArray<readonly [CityName, CityName]> = [
  ["New York", "London"],
  ["London", "Dubai"],
  ["London", "Tokyo"],
  ["Paris", "New Delhi"],
  ["Dubai", "Singapore"],
  ["Singapore", "Sydney"],
  ["Tokyo", "Seoul"],
  ["New York", "Rio de Janeiro"],
  ["Mangaluru Central", "Hassan Junction"],
  ["Hassan Junction", "Mysuru Junction"],
];

// Stops close enough together that they need smaller markers, and a closer camera
// when selected, to be told apart.
const LOCAL_STOPS: ReadonlySet<CityName> = new Set<CityName>([
  "Mangaluru Central",
  "Hassan Junction",
  "Mysuru Junction",
]);

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

// Equirectangular (2:1, lon -180..180, lat 90..-90) Natural Earth render, generated offline.
// The 2K variant is used on touch devices to keep GPU memory down.
const MAP_URL = "/earth-map.webp";
const MAP_URL_LITE = "/earth-map-2k.webp";
const SURFACE_RADIUS = 1.012; // markers and arcs float just above the globe
const CAMERA_DISTANCE = 3.15;
const LOCAL_CAMERA_DISTANCE = 1.3; // camera dolly-in when a Karnataka stop is selected
const LABEL_DISTANCE_FACTOR = 5;
// drei scales labels by 1/(camera-to-marker distance), which is measured to the surface,
// not to the globe's centre. This keeps a label the same on-screen size once dollied in.
const LABEL_DISTANCE_FACTOR_NEAR =
  (LABEL_DISTANCE_FACTOR * (LOCAL_CAMERA_DISTANCE - SURFACE_RADIUS)) / (CAMERA_DISTANCE - SURFACE_RADIUS);
const HALO_SCALE = 1.1;
const FACING_MARGIN = 0.08; // hides labels that sit on the horizon

const MAP_BASE_COLOR = "#0a1f30";
const GRATICULE_COLOR = "rgba(84, 201, 139, 0.22)";
const GREEN = "#54c98b";
const GREEN_BRIGHT = "#79e2a8";
const ARC_COLOR = "#78e7b0";
const TRAVELER_COLOR = "#d8ffeb";
const MARKER_IDLE = "#78a9f0";

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/* -------------------------------------------------------------------------- */
/*  Geometry helpers (pure math, computed once at module load)                */
/* -------------------------------------------------------------------------- */

/**
 * Equirectangular lat/lng -> point on a sphere, matching the UV layout of
 * THREE.SphereGeometry: lng 0 faces +X, lng 90E faces -Z, and the left edge of
 * the texture is lng -180. The map SVG must therefore be a 2:1 equirectangular
 * projection spanning exactly -180..180 / 90..-90.
 */
function latLngToVector(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  return new THREE.Vector3(
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.sin(latitude),
    -radius * Math.cos(latitude) * Math.sin(longitude),
  );
}

/** Great-circle arc between two unit vectors, lifted above the surface. */
function buildArc(a: THREE.Vector3, b: THREE.Vector3, segments = 96): THREE.Vector3[] {
  const omega = a.angleTo(b);
  const sinOmega = Math.sin(omega);
  // Longer routes arc higher. Antipodal city pairs are not supported (the arc
  // would have no unique great circle).
  const lift = 0.02 + 0.09 * (omega / Math.PI);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point =
      sinOmega < 1e-6
        ? a.clone().lerp(b, t)
        : a
            .clone()
            .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
            .addScaledVector(b, Math.sin(t * omega) / sinOmega);
    point.normalize().multiplyScalar(SURFACE_RADIUS + Math.sin(Math.PI * t) * lift);
    points.push(point);
  }
  return points;
}

const CITY_DIRECTIONS = new Map<CityName, THREE.Vector3>(
  CITIES.map(city => [city.label, latLngToVector(city.lat, city.lng)]),
);

function directionOf(name: CityName): THREE.Vector3 {
  const direction = CITY_DIRECTIONS.get(name);
  if (!direction) throw new Error(`Unknown city: ${name}`);
  return direction;
}

const MARKERS = CITIES.map(city => {
  const position = latLngToVector(city.lat, city.lng, SURFACE_RADIUS);
  return {
    label: city.label,
    position,
    // Rotates +Z onto the surface normal so flat shapes lie on the globe.
    quaternion: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, position.clone().normalize()),
  };
});

const FLIGHT_ARCS = ROUTES.map(([from, to], index) => {
  const a = directionOf(from);
  const b = directionOf(to);
  const omega = a.angleTo(b);
  return {
    key: `${from}-${to}`,
    points: buildArc(a, b),
    // Roughly constant ground speed, clamped so very short hops don't blur.
    speed: THREE.MathUtils.clamp(0.14 / Math.max(omega, 0.01), 0.1, 0.2),
    // Golden-ratio spacing spreads travellers evenly around their loops.
    phase: (index * 0.618) % 1,
  };
});

const INITIAL_CAMERA = latLngToVector(18, 40, CAMERA_DISTANCE).toArray() as [number, number, number];

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduce;
}

/** Lets the render loop sleep while the globe is scrolled out of view. */
function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "120px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

type MapStatus = "loading" | "ready" | "unavailable";

function toTexture(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Procedural dark globe with a lat/lng graticule: used while the SVG loads and if it fails. */
function drawFallbackMap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.fillStyle = MAP_BASE_COLOR;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = GRATICULE_COLOR;
  for (let lng = -180; lng <= 180; lng += 30) {
    const x = ((lng + 180) / 360) * width;
    context.lineWidth = lng === 0 ? 3 : 1.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    context.lineWidth = lat === 0 ? 3 : 1.5;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  return canvas;
}

/**
 * Loads the equirectangular map into a texture sized for the device.
 * A procedural fallback texture is always available, so the material's `map`
 * is never undefined: swapping one texture for another needs no shader
 * recompile, whereas toggling `map` from undefined to a texture does.
 * A map that is not 2:1 is rejected: wrapping any other projection onto a sphere
 * produces a confidently wrong globe.
 */
function useGlobeTexture(url: string): { texture: THREE.Texture; status: MapStatus } {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [loaded, setLoaded] = useState<THREE.Texture>();

  // Only the procedural fallback is sized here; the real map keeps its own resolution.
  const { width, anisotropy, coarsePointer } = useMemo(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    return {
      width: Math.min(gl.capabilities.maxTextureSize, coarse ? 2048 : 4096),
      anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()),
      coarsePointer: coarse,
    };
  }, [gl]);
  const height = width / 2;
  const source = coarsePointer && url === MAP_URL ? MAP_URL_LITE : url;

  const fallback = useMemo(
    () => toTexture(drawFallbackMap(width, height), anisotropy),
    [width, height, anisotropy],
  );
  useEffect(() => () => fallback.dispose(), [fallback]);

  useEffect(() => {
    let cancelled = false;
    let created: THREE.Texture | undefined;
    setStatus("loading");

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      if (!(Math.abs(ratio - 2) < 0.02)) {
        console.warn(`TravelGlobe: ${source} is ${image.naturalWidth}x${image.naturalHeight}, not a 2:1 equirectangular map`);
        setStatus("unavailable");
        return;
      }
      try {
        created = new THREE.Texture(image);
        created.colorSpace = THREE.SRGBColorSpace;
        created.anisotropy = anisotropy;
        created.needsUpdate = true;
        setLoaded(created);
        setStatus("ready");
        invalidate();
      } catch (error) {
        console.warn("TravelGlobe: could not create the map texture", error);
        setStatus("unavailable");
      }
    };
    image.onerror = () => {
      if (cancelled) return;
      console.warn(`TravelGlobe: failed to load map image ${source}`);
      setStatus("unavailable");
    };
    image.src = source;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      created?.dispose();
    };
  }, [source, anisotropy, invalidate]);

  return { texture: loaded ?? fallback, status };
}

/* -------------------------------------------------------------------------- */
/*  Globe body: surface + atmosphere                                          */
/* -------------------------------------------------------------------------- */

const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();

function GlobeSurface({
  texture,
  ready,
  reduceMotion,
}: {
  texture: THREE.Texture;
  ready: boolean;
  reduceMotion: boolean;
}) {
  const material = useRef<THREE.MeshLambertMaterial>(null);

  // Fade the real map in from a dim tint so the swap from the fallback is not a pop.
  useFrame((_, delta) => {
    const current = material.current;
    if (!current) return;
    const goal = ready ? 1 : 0.45;
    if (reduceMotion) current.color.setScalar(goal);
    else if (Math.abs(current.color.r - goal) > 0.002) {
      current.color.setScalar(THREE.MathUtils.damp(current.color.r, goal, 3.5, delta));
    }
  });

  return (
    // R3F only raycasts objects that have handlers. Giving the globe no-op
    // handlers that stop propagation makes it occlude markers on the far side,
    // so they can't be hovered or clicked through the planet.
    <mesh onClick={stopPropagation} onPointerOver={stopPropagation} onPointerMove={stopPropagation}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshLambertMaterial ref={material} map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * One soft key light that follows the camera (up and to the left of it), so the
 * terminator shading stays put on screen while the globe rotates. Ambient light is
 * high on purpose: shading adds depth but must never hide a continent.
 * Intensities are in three's physical units (a Lambert surface reflects albedo/pi).
 */
function GlobeLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const camera = useThree(state => state.camera);
  const scratch = useMemo(() => ({ up: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3() }), []);

  useFrame(() => {
    const current = light.current;
    if (!current) return;
    scratch.right.crossVectors(scratch.up, camera.position).normalize();
    current.position.copy(camera.position).addScaledVector(scratch.right, -1.3).addScaledVector(scratch.up, 1.1);
  });

  return (
    <>
      <ambientLight intensity={2.3} />
      <directionalLight ref={light} intensity={1.5} />
    </>
  );
}

const FRESNEL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRESNEL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uStrength;
  uniform float uPeak;
  uniform float uInner;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = dot(normalize(vNormal), normalize(vView));
    float glow;
    if (uInner > 0.5) {
      // Rim light on the globe itself: brightest at the silhouette.
      glow = pow(1.0 - clamp(facing, 0.0, 1.0), uPower);
    } else {
      // Halo seen through the back faces of a larger sphere: brightest where
      // it meets the globe, fading to nothing at its own silhouette.
      glow = pow(clamp(-facing / uPeak, 0.0, 1.0), uPower);
    }
    gl_FragColor = vec4(uColor, glow * uStrength);
    #include <colorspace_fragment>
  }
`;

function FresnelMaterial({
  color,
  power,
  strength,
  haloPeak,
}: {
  color: string;
  power: number;
  strength: number;
  /** Set for the outer halo (back faces); omit for the inner rim light. */
  haloPeak?: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uStrength: { value: strength },
      uPeak: { value: haloPeak ?? 1 },
      uInner: { value: haloPeak === undefined ? 1 : 0 },
    }),
    [color, power, strength, haloPeak],
  );
  return (
    <shaderMaterial
      uniforms={uniforms}
      vertexShader={FRESNEL_VERTEX}
      fragmentShader={FRESNEL_FRAGMENT}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      side={haloPeak === undefined ? THREE.FrontSide : THREE.BackSide}
    />
  );
}

// Where a view ray grazing the globe lands on the halo sphere: normalises the glow to 1 at the limb.
const HALO_PEAK = Math.sqrt(1 - 1 / (HALO_SCALE * HALO_SCALE));

function Atmosphere() {
  return (
    <>
      <mesh scale={HALO_SCALE} renderOrder={-1}>
        <sphereGeometry args={[1, 64, 64]} />
        <FresnelMaterial color={GREEN} power={2.4} strength={0.45} haloPeak={HALO_PEAK} />
      </mesh>
      <mesh scale={1.003} renderOrder={1}>
        <sphereGeometry args={[1, 64, 64]} />
        <FresnelMaterial color={ARC_COLOR} power={3.2} strength={0.38} />
      </mesh>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Flights                                                                   */
/* -------------------------------------------------------------------------- */

function FlightArc({ arc, reduceMotion }: { arc: (typeof FLIGHT_ARCS)[number]; reduceMotion: boolean }) {
  const traveler = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = traveler.current;
    if (!group) return;
    const { points } = arc;
    const progress = reduceMotion ? 0.5 : (clock.elapsedTime * arc.speed + arc.phase) % 1;
    const scaled = progress * (points.length - 1);
    const index = Math.min(Math.floor(scaled), points.length - 2);
    group.position.lerpVectors(points[index], points[index + 1], scaled - index);
    // Ease in and out so travellers don't pop at the endpoints.
    group.scale.setScalar(0.45 + 0.55 * Math.sin(Math.PI * progress));
  });

  return (
    <>
      <Line points={arc.points} color={ARC_COLOR} lineWidth={1.25} transparent opacity={0.42} />
      <group ref={traveler} position={arc.points[0]}>
        <mesh>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color={TRAVELER_COLOR} toneMapped={false} />
        </mesh>
        <mesh scale={2.6}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color={ARC_COLOR} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function GlobeFlights({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <>
      {FLIGHT_ARCS.map(arc => (
        <FlightArc key={arc.key} arc={arc} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Markers                                                                   */
/* -------------------------------------------------------------------------- */

function Marker({
  marker,
  selected,
  hovered,
  reduceMotion,
  onSelect,
  onHover,
  onUnhover,
}: {
  marker: (typeof MARKERS)[number];
  selected: boolean;
  hovered: boolean;
  reduceMotion: boolean;
  onSelect: (label: CityName) => void;
  onHover: (label: CityName) => void;
  onUnhover: (label: CityName) => void;
}) {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const [facing, setFacing] = useState(true);
  const facingRef = useRef(true);
  // Labels are scaled by 1/distance, so compensate once the camera has dollied in
  // (two buckets, so React state only changes when the camera crosses the threshold).
  const [dollied, setDollied] = useState(false);
  const dolliedRef = useRef(false);
  const ring = useRef<THREE.Mesh>(null);
  const active = selected || hovered;
  // Size factor: tightly clustered stops are smaller, and everything shrinks when dollied in so
  // neighbouring stops stay distinguishable.
  const k = (LOCAL_STOPS.has(marker.label) ? 0.45 : 1) * (dollied ? 0.4 : 1);

  useFrame(({ clock }) => {
    // Only update React state when the marker crosses the horizon.
    const nextFacing = marker.position.dot(camera.position) > marker.position.lengthSq() + FACING_MARGIN;
    if (nextFacing !== facingRef.current) {
      facingRef.current = nextFacing;
      setFacing(nextFacing);
      invalidate(); // the render loop sleeps with reduced motion; make sure the change is drawn
    }
    const nextDollied = camera.position.length() < (CAMERA_DISTANCE + LOCAL_CAMERA_DISTANCE) / 2;
    if (nextDollied !== dolliedRef.current) {
      dolliedRef.current = nextDollied;
      setDollied(nextDollied);
      invalidate();
    }
    if (selected && !reduceMotion && ring.current) {
      const t = (clock.elapsedTime * 0.9) % 1;
      ring.current.scale.setScalar(1 + t * 1.8);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
    }
  });

  return (
    <group position={marker.position}>
      <mesh scale={active ? 1.5 : 1}>
        <sphereGeometry args={[0.022 * k, 16, 16]} />
        <meshBasicMaterial color={active ? GREEN_BRIGHT : MARKER_IDLE} toneMapped={false} />
      </mesh>
      <mesh scale={active ? 2.2 : 1.7}>
        <sphereGeometry args={[0.022 * k, 12, 12]} />
        <meshBasicMaterial color={GREEN} transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Larger invisible hit target: easier to hit with a finger or a trackpad. */}
      <mesh
        onClick={event => {
          event.stopPropagation();
          onSelect(marker.label);
        }}
        onPointerOver={event => {
          event.stopPropagation();
          onHover(marker.label);
        }}
        onPointerOut={() => onUnhover(marker.label)}
      >
        <sphereGeometry args={[0.055 * k, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <group quaternion={marker.quaternion}>
          <mesh ref={ring} scale={reduceMotion ? 1.8 : 1}>
            <ringGeometry args={[0.032 * k, 0.04 * k, 48]} />
            <meshBasicMaterial
              color={GREEN_BRIGHT}
              transparent
              opacity={reduceMotion ? 0.4 : 0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {active && facing && (
        <Html
          position={[0, 0.06 * k, 0]}
          center
          distanceFactor={dollied ? LABEL_DISTANCE_FACTOR_NEAR : LABEL_DISTANCE_FACTOR}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span className="whitespace-nowrap rounded-full border border-green/40 bg-bg/90 px-2.5 py-1 font-mono text-[11px] text-ink shadow-l2 backdrop-blur">
            {marker.label}
          </span>
        </Html>
      )}
    </group>
  );
}

function GlobeMarkers({
  selected,
  onSelect,
  reduceMotion,
}: {
  selected: CityName | undefined;
  onSelect: (label: CityName) => void;
  reduceMotion: boolean;
}) {
  const [hovered, setHovered] = useState<CityName>();
  const canvas = useThree(state => state.gl.domElement);

  useEffect(() => {
    canvas.style.cursor = hovered ? "pointer" : "grab";
    return () => {
      canvas.style.cursor = "";
    };
  }, [canvas, hovered]);

  // Pointer-out for one marker can fire after pointer-over for the next.
  const handleUnhover = useCallback(
    (label: CityName) => setHovered(current => (current === label ? undefined : current)),
    [],
  );

  return (
    <>
      {MARKERS.map(marker => (
        <Marker
          key={marker.label}
          marker={marker}
          selected={selected === marker.label}
          hovered={hovered === marker.label}
          reduceMotion={reduceMotion}
          onSelect={onSelect}
          onHover={setHovered}
          onUnhover={handleUnhover}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                  */
/* -------------------------------------------------------------------------- */

function GlobeControls({ selected, reduceMotion }: { selected: CityName | undefined; reduceMotion: boolean }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const camera = useThree(state => state.camera);
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);
  const target = useRef<THREE.Vector3 | null>(null);
  const goalDistance = useRef(CAMERA_DISTANCE);
  const scratch = useMemo(
    () => ({ current: new THREE.Vector3(), full: new THREE.Quaternion(), step: new THREE.Quaternion() }),
    [],
  );

  // Rotate the camera to face the selected city (snap when motion is reduced).
  useEffect(() => {
    goalDistance.current = selected && LOCAL_STOPS.has(selected) ? LOCAL_CAMERA_DISTANCE : CAMERA_DISTANCE;
    if (!selected) {
      target.current = null;
      if (reduceMotion) {
        camera.position.setLength(goalDistance.current);
        controls.current?.update();
        invalidate();
      }
      return;
    }
    const direction = directionOf(selected);
    if (reduceMotion) {
      camera.position.copy(direction).multiplyScalar(goalDistance.current);
      controls.current?.update();
      invalidate();
    } else {
      target.current = direction;
    }
  }, [selected, reduceMotion, camera, invalidate]);

  // Dragging the globe cancels any focus animation in progress.
  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    const cancel = () => {
      target.current = null;
    };
    instance.addEventListener("start", cancel);
    return () => instance.removeEventListener("start", cancel);
  }, []);

  // OrbitControls disables browser touch handling, which traps page scroll on
  // phones. Let vertical swipes scroll the page; horizontal drags still rotate.
  useEffect(() => {
    canvas.style.touchAction = "pan-y";
  }, [canvas]);

  // Priority -2 runs before OrbitControls' own update (-1), so its lookAt sees our move.
  useFrame((_, delta) => {
    const distance = camera.position.length();
    if (Math.abs(distance - goalDistance.current) > 0.002) {
      const ease = 1 - Math.exp(-delta * 4);
      camera.position.setLength(distance + (goalDistance.current - distance) * ease);
    }
    const goal = target.current;
    if (!goal) return;
    const { current, full, step } = scratch;
    current.copy(camera.position).normalize();
    if (current.angleTo(goal) < 0.002) {
      target.current = null;
      return;
    }
    full.setFromUnitVectors(current, goal);
    step.identity().slerp(full, 1 - Math.exp(-delta * 5));
    camera.position.applyQuaternion(step);
  }, -2);

  return (
    <OrbitControls
      ref={controls}
      autoRotate={!reduceMotion && !selected}
      autoRotateSpeed={0.35}
      enablePan={false}
      enableZoom={false}
      enableDamping
      minPolarAngle={Math.PI * 0.16}
      maxPolarAngle={Math.PI * 0.84}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene + public component                                                  */
/* -------------------------------------------------------------------------- */

function GlobeScene({
  selected,
  onSelect,
  reduceMotion,
  mapUrl,
  onMapStatus,
}: {
  selected: CityName | undefined;
  onSelect: (label: CityName) => void;
  reduceMotion: boolean;
  mapUrl: string;
  onMapStatus: (status: MapStatus) => void;
}) {
  const { texture, status } = useGlobeTexture(mapUrl);
  useEffect(() => onMapStatus(status), [status, onMapStatus]);

  // Only the globe surface is lit (one ambient + one directional light); markers, arcs
  // and the atmosphere are unlit materials / shaders and cost nothing extra.
  return (
    <>
      <GlobeLight />
      <GlobeSurface texture={texture} ready={status !== "loading"} reduceMotion={reduceMotion} />
      <Atmosphere />
      <GlobeFlights reduceMotion={reduceMotion} />
      <GlobeMarkers selected={selected} onSelect={onSelect} reduceMotion={reduceMotion} />
      <GlobeControls selected={selected} reduceMotion={reduceMotion} />
    </>
  );
}

/** Catches WebGL-unavailable and render errors so the rest of the page survives. */
class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("TravelGlobe failed to render", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type TravelGlobeProps = {
  /** Force reduced motion on or off. Defaults to the user's OS setting. */
  reduceMotion?: boolean;
  /** Equirectangular (2:1, -180..180 / 90..-90) map image. Anything not 2:1 is rejected. */
  mapUrl?: string;
  onSelect?: (city: string | undefined) => void;
};

export function TravelGlobe({ reduceMotion, mapUrl = MAP_URL, onSelect }: TravelGlobeProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduce = reduceMotion ?? prefersReducedMotion;

  const figureRef = useRef<HTMLElement>(null);
  const inView = useInView(figureRef);

  const [selected, setSelected] = useState<CityName>();
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [contextLost, setContextLost] = useState(false);

  const select = useCallback(
    (city: CityName | undefined) => {
      setSelected(city);
      onSelect?.(city);
    },
    [onSelect],
  );

  const caption = contextLost
    ? "Globe paused · graphics context lost"
    : mapStatus === "unavailable"
      ? "Globe map unavailable"
      : selected
        ? `Selected · ${selected}`
        : "Drag to rotate · select a destination";

  return (
    <figure
      ref={figureRef}
      className="relative mx-auto w-full max-w-[30rem]"
      aria-label="Interactive globe with major travel destinations"
    >
      <div className="pointer-events-none absolute inset-[12%] rounded-full bg-green/10 blur-3xl" aria-hidden />
      <div className="relative h-[19rem] w-full sm:h-[24rem] lg:h-[27rem]">
        <GlobeBoundary
          fallback={
            <div className="grid h-full place-items-center font-mono text-[11px] text-muted">
              3D globe unavailable. Use the menu below to choose a city.
            </div>
          }
        >
          <Canvas
            role="img"
            aria-label="3D globe. Drag to rotate and click a marker to select a city."
            camera={{ position: INITIAL_CAMERA, fov: 42, near: 0.1, far: 20 }}
            dpr={[1, 2]}
            frameloop={reduce ? "demand" : inView ? "always" : "never"}
            gl={{ alpha: true, antialias: true }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", event => {
                event.preventDefault(); // allow the browser to restore the context
                setContextLost(true);
              });
              gl.domElement.addEventListener("webglcontextrestored", () => setContextLost(false));
            }}
          >
            <GlobeScene
              selected={selected}
              onSelect={select}
              reduceMotion={reduce}
              mapUrl={mapUrl}
              onMapStatus={setMapStatus}
            />
          </Canvas>
        </GlobeBoundary>
      </div>
      <figcaption className="mt-1 flex min-h-8 items-center justify-between gap-3 font-mono text-[11px] text-muted">
        <span aria-live="polite">{caption}</span>
        <label className="sr-only" htmlFor="globe-destination">
          Select a destination on the globe
        </label>
        <select
          id="globe-destination"
          value={selected ?? ""}
          onChange={event => select(CITIES.find(city => city.label === event.target.value)?.label)}
          className="max-w-36 rounded-lg border border-line-strong bg-surface/90 px-2 py-1 text-[11px] text-ink2 focus-visible:outline-green-bright"
        >
          <option value="">Choose city</option>
          {CITIES.map(city => (
            <option key={city.label} value={city.label}>
              {city.label}
            </option>
          ))}
        </select>
      </figcaption>
    </figure>
  );
}