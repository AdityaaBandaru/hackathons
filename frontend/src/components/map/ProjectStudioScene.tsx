"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Project3D } from "@/lib/types";
import { buildProjectModel, disposeObject } from "@/lib/projectModels";
import { studioDimensions } from "@/lib/studio";

type ViewPreset = "perspective" | "top" | "front";
interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  models: THREE.Group;
  surroundings: THREE.Group;
  dimensions: THREE.Group;
  key: THREE.DirectionalLight;
  bounds: THREE.Box3;
  fit: (preset?: ViewPreset) => void;
  draw: () => void;
}

export function ProjectStudioScene({ projects }: { projects: Project3D[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [dimensions, setDimensions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      // Surfacing an external-system failure (no WebGL) is exactly what this
      // effect is for; there is nothing to render, so no cascade follows.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("3D rendering is unavailable in this browser. Project dimensions, comparisons and source details are still available below.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Interactive project model. Drag to orbit, scroll to zoom, or use the camera buttons.");
    host.appendChild(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0b0e");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
    const controls = new OrbitControls(camera, canvas);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.02;
    controls.autoRotateSpeed = 0.7;
    controls.screenSpacePanning = false;
    controls.listenToKeyEvents(canvas);
    const models = new THREE.Group();
    const surroundings = new THREE.Group();
    const dimensionsGroup = new THREE.Group();
    dimensionsGroup.visible = false;
    scene.add(models, surroundings, dimensionsGroup);
    scene.add(new THREE.HemisphereLight("#dfe6ff", "#1a1c24", 2.4));
    const key = new THREE.DirectionalLight("#fff4df", 4.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00015;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight("#8b95ff", 1.8);
    rim.position.set(-100, 90, -120);
    scene.add(rim);
    const bounds = new THREE.Box3();
    const draw = () => renderer.render(scene, camera);
    const fit = (preset: ViewPreset = "perspective") => {
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() / 2, 1);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.15;
      const direction = preset === "top" ? new THREE.Vector3(0, 1, 0.005)
        : preset === "front" ? new THREE.Vector3(0, 0.15, 1)
        : new THREE.Vector3(0.95, 0.85, 1.25);
      camera.position.copy(center).addScaledVector(direction.normalize(), distance);
      camera.near = Math.max(radius / 1000, 0.005);
      camera.far = distance * 30;
      camera.updateProjectionMatrix();
      controls.minDistance = radius * 0.2;
      controls.maxDistance = distance * 4;
      controls.target.copy(center);
      controls.update();
      draw();
    };
    runtime.current = { renderer, scene, camera, controls, models, surroundings, dimensions: dimensionsGroup, key, bounds, fit, draw };
    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      fit();
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener("change", draw);
    const lost = (event: Event) => {
      event.preventDefault();
      setError("The 3D view was interrupted. Reload the model to continue.");
    };
    canvas.addEventListener("webglcontextlost", lost);
    resize();
    return () => {
      observer.disconnect();
      controls.removeEventListener("change", draw);
      controls.dispose();
      canvas.removeEventListener("webglcontextlost", lost);
      disposeObject(scene);
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      runtime.current = null;
    };
  }, [generation]);

  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    for (const root of [state.models, state.surroundings, state.dimensions]) {
      disposeObject(root);
      root.clear();
    }
    if (projects.length === 0) {
      state.bounds.makeEmpty();
      state.draw();
      return;
    }
    try {
      const sizes = projects.map(studioDimensions);
      const gap = Math.max(...sizes.map((s) => s.length)) * 0.22;
      const totalWidth = sizes.reduce((sum, s) => sum + s.length, 0) + gap * (sizes.length - 1);
      let cursor = -totalWidth / 2;
      projects.forEach((project, index) => {
        const size = sizes[index];
        const model = buildProjectModel(project);
        model.position.x = cursor + size.length / 2;
        cursor += size.length + gap;
        state.models.add(model);
        model.updateMatrixWorld(true);
        const outline = new THREE.Box3Helper(new THREE.Box3().setFromObject(model), project.phase === "permanent" ? 0x71b5ff : 0xffc977);
        state.dimensions.add(outline);
      });
      state.bounds.setFromObject(state.models);
      const center = state.bounds.getCenter(new THREE.Vector3());
      const size = state.bounds.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z, size.y, 5);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(size.x + span * 0.18, span * 0.012, size.z + span * 0.18),
        new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 0.9 }),
      );
      base.position.set(center.x, -span * 0.008, center.z);
      base.receiveShadow = true;
      state.surroundings.add(base);
      const grid = new THREE.GridHelper(span * 3, 40, "#2a2c34", "#1c1d24");
      grid.position.y = -span * 0.018;
      state.surroundings.add(grid);
      state.key.position.copy(center).add(new THREE.Vector3(span * -0.45, span * 1.4, span));
      state.key.target.position.copy(center);
      const shadow = state.key.shadow.camera;
      shadow.left = -span;
      shadow.right = span;
      shadow.top = span;
      shadow.bottom = -span;
      shadow.near = span * 0.01;
      shadow.far = span * 5;
      shadow.updateProjectionMatrix();
      state.key.shadow.normalBias = span * 0.00015;
      state.fit();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the scene build's outcome into state
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This model could not be created.");
    }
  }, [projects, generation]);

  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    state.dimensions.visible = dimensions;
    state.draw();
  }, [dimensions, generation]);

  useEffect(() => {
    const state = runtime.current;
    if (!state || !rotating) return;
    let frame = 0;
    let previous = 0;
    const animate = (time: number) => {
      if (!document.hidden) {
        state.controls.autoRotate = true;
        state.controls.update(previous ? Math.min((time - previous) / 1000, 0.05) : 0);
        state.draw();
      }
      previous = time;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      state.controls.autoRotate = false;
    };
  }, [rotating, generation]);

  async function exportModel() {
    const state = runtime.current;
    if (!state || !projects.length) return;
    setExporting(true);
    setExportError(null);
    try {
      const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
      const result = await new GLTFExporter().parseAsync(state.models, { binary: true });
      if (!(result instanceof ArrayBuffer)) throw new Error("The model export did not complete.");
      const url = URL.createObjectURL(new Blob([result], { type: "model/gltf-binary" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projects[0].cityId}-${projects[0].category}-${projects.length > 1 ? "comparison" : projects[0].phase}.glb`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "The model could not be exported.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="studio-scene-shell">
      <div className="studio-scene-caption">
        <span>MODEL SPACE <span className="studio-faint">/ METRES</span></span>
        <span>{projects.length === 2 ? "SAME SCALE COMPARISON" : "CONCEPT DESIGN"}</span>
      </div>
      <div className="studio-canvas" ref={hostRef} data-testid="studio-canvas" />
      {error && (
        <div className="studio-render-error" role="alert">
          <p>{error}</p>
          <button onClick={() => { setError(null); setGeneration((value) => value + 1); }}>Reload model</button>
        </div>
      )}
      {!error && <p className="studio-canvas-help">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag to pan</p>}
      <div className="studio-camera-bar" aria-label="Model camera controls">
        <div className="studio-camera-presets">
          <button type="button" onClick={() => runtime.current?.fit()}>Reset view</button>
          <button type="button" onClick={() => runtime.current?.fit("top")}>Top</button>
          <button type="button" onClick={() => runtime.current?.fit("front")}>Front</button>
          <button type="button" onClick={() => {
            const state = runtime.current;
            if (state) { state.camera.position.sub(state.controls.target).multiplyScalar(0.8).add(state.controls.target); state.controls.update(); }
          }} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => {
            const state = runtime.current;
            if (state) { state.camera.position.sub(state.controls.target).multiplyScalar(1.25).add(state.controls.target); state.controls.update(); }
          }} aria-label="Zoom out">−</button>
        </div>
        <div className="studio-camera-presets">
          <button type="button" aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)}>Envelope</button>
          <button type="button" aria-pressed={rotating} onClick={() => setRotating(!rotating)}>{rotating ? "Pause orbit" : "Auto orbit"}</button>
          <button type="button" disabled={exporting || !!error} onClick={exportModel}>{exporting ? "Exporting…" : "Export GLB ↓"}</button>
        </div>
      </div>
      {exportError && <p className="studio-export-error" role="alert">{exportError}</p>}
    </div>
  );
}
