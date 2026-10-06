import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface DitheringPalette {
  name: string;
  colorBack: string;
  colorFront: string;
}

export const PRESET_PALETTES: DitheringPalette[] = [
  { name: "Retro Ink", colorBack: "#0e0e0e", colorFront: "#fcfbf9" },
  { name: "Terminal Glow", colorBack: "#0a0a0a", colorFront: "#52FF1A" },
  { name: "Warm Editorial", colorBack: "#1a1a1a", colorFront: "#f6f4ee" },
  { name: "Subtle Charcoal", colorBack: "#121212", colorFront: "#4a4a4a" },
  { name: "Cyber Wave", colorBack: "#001122", colorFront: "#ff0088" },
];

export interface DitheringShaderProps {
  shape?: "wave" | "sphere" | "plane";
  type?: "4x4" | "8x8";
  colorBack?: string;
  colorFront?: string;
  pxSize?: number;
  speed?: number;
  className?: string;
}

export const DitheringShader: React.FC<DitheringShaderProps> = ({
  shape = "wave",
  type = "8x8",
  colorBack: initialColorBack,
  colorFront: initialColorFront,
  pxSize: initialPxSize = 2,
  speed = 0.6,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const [activePaletteIndex, setActivePaletteIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dither_palette_idx");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < PRESET_PALETTES.length) {
          return parsed;
        }
      }
    }
    return 0; // Default: Retro Ink
  });

  const [currentPxSize, setCurrentPxSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dither_px_size");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && [1, 2, 3, 4].includes(parsed)) {
          return parsed;
        }
      }
    }
    return initialPxSize;
  });

  // Listen to custom events from the existing Dev Menu (HeroMap)
  useEffect(() => {
    const handlePaletteChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ index: number }>;
      if (typeof customEvent.detail?.index === "number") {
        setActivePaletteIndex(customEvent.detail.index);
        localStorage.setItem("dither_palette_idx", customEvent.detail.index.toString());
      }
    };

    const handleScaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ pxSize: number }>;
      if (typeof customEvent.detail?.pxSize === "number") {
        setCurrentPxSize(customEvent.detail.pxSize);
        localStorage.setItem("dither_px_size", customEvent.detail.pxSize.toString());
      }
    };

    window.addEventListener("dither:change-palette", handlePaletteChange);
    window.addEventListener("dither:change-scale", handleScaleChange);

    return () => {
      window.removeEventListener("dither:change-palette", handlePaletteChange);
      window.removeEventListener("dither:change-scale", handleScaleChange);
    };
  }, []);

  // Update uniforms when palette or pixel scale changes
  useEffect(() => {
    if (!materialRef.current) return;
    const palette = PRESET_PALETTES[activePaletteIndex];
    materialRef.current.uniforms.uColorBack.value.set(palette.colorBack);
    materialRef.current.uniforms.uColorFront.value.set(palette.colorFront);
    materialRef.current.uniforms.uPxSize.value = Math.max(1, currentPxSize);
  }, [activePaletteIndex, currentPxSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const bayer8x8 = [
       0/64, 32/64,  8/64, 40/64,  2/64, 34/64, 10/64, 42/64,
      48/64, 16/64, 56/64, 24/64, 50/64, 18/64, 58/64, 26/64,
      12/64, 44/64,  4/64, 36/64, 14/64, 46/64,  6/64, 38/64,
      60/64, 28/64, 52/64, 20/64, 62/64, 30/64, 54/64, 22/64,
       3/64, 35/64, 11/64, 43/64,  1/64, 33/64,  9/64, 41/64,
      51/64, 19/64, 59/64, 27/64, 49/64, 17/64, 57/64, 25/64,
      15/64, 47/64,  7/64, 39/64, 13/64, 45/64,  5/64, 37/64,
      63/64, 31/64, 55/64, 23/64, 61/64, 29/64, 53/64, 21/64,
    ];

    const ditherTexture = new THREE.DataTexture(
      new Float32Array(bayer8x8),
      8,
      8,
      THREE.RedFormat,
      THREE.FloatType
    );
    ditherTexture.magFilter = THREE.NearestFilter;
    ditherTexture.minFilter = THREE.NearestFilter;
    ditherTexture.wrapS = THREE.RepeatWrapping;
    ditherTexture.wrapT = THREE.RepeatWrapping;
    ditherTexture.needsUpdate = true;

    const initialPalette = PRESET_PALETTES[activePaletteIndex];
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uColorBack: { value: new THREE.Color(initialPalette.colorBack) },
        uColorFront: { value: new THREE.Color(initialPalette.colorFront) },
        uPxSize: { value: Math.max(1, currentPxSize) },
        uSpeed: { value: speed },
        uDitherMap: { value: ditherTexture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColorBack;
        uniform vec3 uColorFront;
        uniform float uPxSize;
        uniform float uSpeed;
        uniform sampler2D uDitherMap;
        varying vec2 vUv;

        void main() {
          vec2 coord = floor(gl_FragCoord.xy / uPxSize) * uPxSize;
          vec2 uv = coord / uResolution.xy;

          float t = uTime * uSpeed;
          // Organic sine wave interference
          float wave1 = sin(uv.x * 6.28 * 2.0 + t) * 0.5 + 0.5;
          float wave2 = cos(uv.y * 6.28 * 1.5 - t * 0.8) * 0.5 + 0.5;
          float wave3 = sin((uv.x + uv.y) * 6.28 * 1.0 + t * 0.5) * 0.5 + 0.5;
          float lum = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2);

          // Sample 8x8 Bayer matrix
          vec2 ditherUv = fract(coord / (8.0 * uPxSize));
          float threshold = texture2D(uDitherMap, ditherUv).r;

          float dither = step(threshold, lum);
          // If dither is 0 (background), alpha is 0.0 (completely invisible/transparent)
          // If dither is 1 (foreground dot), render uColorFront with full alpha 1.0
          gl_FragColor = vec4(uColorFront, dither);
        }
      `,
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      material.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      renderer.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      ditherTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      materialRef.current = null;
    };
  }, [shape, type, speed]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}
    />
  );
};

export default DitheringShader;
