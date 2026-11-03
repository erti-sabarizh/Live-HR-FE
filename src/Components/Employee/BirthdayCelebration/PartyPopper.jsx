import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./BirthdayCelebration.css";

/**
 * PartyPopper Component (Real 3D WebGL / Three.js)
 * Displays the vibrant 3D striped party horn cone (full festive colors: yellow, blue, red)
 * with shiny golden rim and fully filled festive mouth (ZERO black voids or dark shadows).
 * Oriented obliquely along bottom viewport corners with real 3D recoil on blast.
 */
const PartyPopper = ({ side = "left", blasting = false, exiting = false }) => {
  const mountRef = useRef(null);
  const isLeft = side === "left";
  const sceneRef = useRef(null);
  const popperGroupRef = useRef(null);
  const recoilAnimRef = useRef({ active: false, time: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 250;
    const height = container.clientHeight || 250;

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. High-Vibrancy Celebratory 3D Lighting (Brightly illuminating both cone & mouth)
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.6);
    scene.add(ambientLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 2.5);
    frontLight.position.set(0, 2, 4);
    scene.add(frontLight);

    // Golden rim and mouth spotlight - ensures the front mouth is radiantly lit with ZERO black
    const mouthSpotLight = new THREE.PointLight(0xfff3a0, 3.2, 8);
    mouthSpotLight.position.set(isLeft ? 0.6 : -0.6, 1.4, 2.0);
    scene.add(mouthSpotLight);

    const goldRimLight = new THREE.PointLight(0xffd700, 2.8, 6);
    goldRimLight.position.set(isLeft ? 0.8 : -0.8, 1.2, 1.5);
    scene.add(goldRimLight);

    const fillLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    fillLight.position.set(isLeft ? -2 : 2, -1, 3);
    scene.add(fillLight);

    // 3. 3D Popper Group
    const popperGroup = new THREE.Group();
    popperGroupRef.current = popperGroup;
    scene.add(popperGroup);

    // 3D Side-On Profile Orientation (Shows full striped length and festive filled mouth)
    if (isLeft) {
      popperGroup.rotation.set(-0.2, 0.35, -Math.PI / 4);
      popperGroup.position.set(-0.1, -0.2, 0);
    } else {
      popperGroup.rotation.set(-0.2, -0.35, Math.PI / 4);
      popperGroup.position.set(0.1, -0.2, 0);
    }

    // Helper: Build Vibrant 3D Popper with Fully Filled Festive Mouth (NO BLACK VOID!)
    const buildFullColorPopper = () => {
      const group = new THREE.Group();
      const segments = 48;
      const height = 2.8;
      const rTop = 0.88;
      const rBottom = 0.14;
      const heightSegments = 6;

      // Vivid, vibrant festive palette
      const stripeColors = [
        0xffb800, // Bright Golden Yellow
        0x2563eb, // Royal Blue
        0xef4444, // Fiesta Red
        0xffb800, // Bright Golden Yellow
        0x2563eb, // Royal Blue
        0xef4444, // Fiesta Red
      ];

      // Striped cone body
      for (let h = 0; h < heightSegments; h++) {
        const y0 = -height / 2 + (h / heightSegments) * height;
        const y1 = -height / 2 + ((h + 1) / heightSegments) * height;
        const r0 = rBottom + (h / heightSegments) * (rTop - rBottom);
        const r1 = rBottom + ((h + 1) / heightSegments) * (rTop - rBottom);

        const bandGeo = new THREE.CylinderGeometry(
          r1,
          r0,
          (height / heightSegments) * 1.02,
          segments,
          1,
          true
        );
        const bandMat = new THREE.MeshStandardMaterial({
          color: stripeColors[h % stripeColors.length],
          roughness: 0.18,
          metalness: 0.25,
          side: THREE.DoubleSide,
        });
        const bandMesh = new THREE.Mesh(bandGeo, bandMat);
        bandMesh.position.y = (y0 + y1) / 2;
        group.add(bandMesh);
      }

      // 3D Polished Metallic Gold Rim
      const rimGeo = new THREE.TorusGeometry(0.88, 0.095, 20, 48);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.1,
        metalness: 0.95,
        side: THREE.DoubleSide,
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.y = height / 2;
      group.add(rimMesh);

      // Fully Filled Mouth: Festive Shiny Gold Cap (NO BLACK!)
      const capGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.05, segments);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.12,
        metalness: 0.88,
        side: THREE.DoubleSide,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.y = height / 2 - 0.02;
      group.add(capMesh);

      // Festive Colorful Confetti Pieces inside mouth
      const confettiColors = [0xef4444, 0x2563eb, 0x10b981, 0xf59e0b, 0xec4899, 0x8b5cf6];
      for (let i = 0; i < 20; i++) {
        const dotGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const dotMat = new THREE.MeshStandardMaterial({
          color: confettiColors[i % confettiColors.length],
          roughness: 0.15,
          metalness: 0.4,
          side: THREE.DoubleSide,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 20) * Math.PI * 2 + i * 0.8;
        const rad = 0.15 + (i % 5) * 0.13;
        dot.position.set(
          Math.cos(angle) * rad,
          height / 2 + 0.03,
          Math.sin(angle) * rad
        );
        group.add(dot);
      }

      // 3D Golden Knot at Bottom Tip
      const knotGeo = new THREE.TorusGeometry(0.18, 0.07, 16, 32);
      const knotMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.15,
        metalness: 0.92,
        side: THREE.DoubleSide,
      });
      const knotMesh = new THREE.Mesh(knotGeo, knotMat);
      knotMesh.position.y = -height / 2;
      group.add(knotMesh);

      // Golden Ribbon Loops
      const loopGeo = new THREE.TorusGeometry(0.15, 0.04, 12, 24);
      const loop1 = new THREE.Mesh(loopGeo, knotMat);
      loop1.position.set(0.12, -height / 2 - 0.1, 0);
      loop1.rotation.z = Math.PI / 3;
      group.add(loop1);

      const loop2 = new THREE.Mesh(loopGeo, knotMat);
      loop2.position.set(-0.12, -height / 2 - 0.1, 0);
      loop2.rotation.z = -Math.PI / 3;
      group.add(loop2);

      return group;
    };

    // 4. Load from /popper.glb with fallback to full-color procedural
    const loader = new GLTFLoader();
    loader.load(
      "/popper.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.15, 1.15, 1.15);

        // Apply double-sided rendering to ALL meshes to prevent any black / culled voids
        model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.15,
              metalness: 0.35,
              side: THREE.DoubleSide, // Always render both sides - NEVER cull
            });
          }
        });

        // Add golden knot at base tip
        const knotGeo = new THREE.TorusGeometry(0.18, 0.07, 16, 32);
        const knotMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          roughness: 0.15,
          metalness: 0.92,
          side: THREE.DoubleSide,
        });
        const knotMesh = new THREE.Mesh(knotGeo, knotMat);
        knotMesh.position.y = -1.4;
        model.add(knotMesh);

        popperGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn("Using procedural full-color 3D popper:", err);
        const fullColorPopper = buildFullColorPopper();
        popperGroup.add(fullColorPopper);
      }
    );

    // 5. Render Loop with Animation
    let animId = null;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Recoil blast physics
      if (recoilAnimRef.current.active) {
        recoilAnimRef.current.time += delta;
        const t = recoilAnimRef.current.time;

        const recoilAmount = Math.exp(-t * 5.5) * Math.sin(t * 18);
        const recoilDist = recoilAmount * 0.45;

        const basePosX = isLeft ? -0.1 : 0.1;
        const basePosY = -0.2;
        const recoilDirX = isLeft ? -0.3 : 0.3;
        const recoilDirY = -0.3;

        popperGroup.position.x = basePosX + recoilDirX * recoilDist;
        popperGroup.position.y = basePosY + recoilDirY * recoilDist;

        if (t > 1.2) {
          recoilAnimRef.current.active = false;
          popperGroup.position.set(basePosX, basePosY, 0);
        }
      } else {
        // Subtle floating idle motion
        const time = clock.getElapsedTime();
        const baseRotZ = isLeft ? -Math.PI / 4 : Math.PI / 4;
        popperGroup.rotation.z = baseRotZ + Math.sin(time * 2) * 0.02;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 250;
      const h = container.clientHeight || 250;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animId) cancelAnimationFrame(animId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [isLeft]);

  // Trigger 3D recoil kick on blast
  useEffect(() => {
    if (blasting) {
      recoilAnimRef.current = { active: true, time: 0 };
    }
  }, [blasting]);

  return (
    <div
      className={`bday-popper-fixed ${isLeft ? "bday-popper-left" : "bday-popper-right"} ${
        exiting ? "bday-popper-exiting" : ""
      }`}
      aria-hidden="true"
    >
      <div ref={mountRef} className="bday-popper-3d-mount" />

      {blasting && (
        <div
          className={`bday-popper-muzzle-flash ${
            isLeft ? "bday-flash-left" : "bday-flash-right"
          }`}
        >
          <div className="bday-flash-glow" />
        </div>
      )}
    </div>
  );
};

export default PartyPopper;