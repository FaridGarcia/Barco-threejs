import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const bubbleInfo = [
  { title: "Dimensiones", data: [ { subtitle: "Longitud", value: "120 m" }, { subtitle: "Manga", value: "18 m" }, { subtitle: "Calado", value: "5 m" }, { subtitle: "Desplazamiento", value: "3,500 toneladas" } ] },
  { title: "Rendimiento", data: [ { subtitle: "Velocidad Máxima", value: "25 nudos" }, { subtitle: "Velocidad de Crucero", value: "20 nudos" }, { subtitle: "Autonomía", value: "5,000 millas náuticas" } ] },
  { title: "Capacidades", data: [ { subtitle: "Tripulación", value: "20" }, { subtitle: "Pasajeros", value: "50" }, { subtitle: "Capacidad de Carga", value: "500 toneladas" } ] },
  { title: "Propulsión", data: [ { subtitle: "Motores Principales", value: "2 x Motores Diésel" }, { subtitle: "Hélices", value: "2 x Hélices de Paso Controlable" } ] },
  { title: "Sistema Eléctrico", data: [ { subtitle: "Generadores", value: "2 x Generadores Diésel" }, { subtitle: "Suministro de energía", value: "440V /60Hz" } ] },
  { title: "Navegación y Comunicación", data: [ { subtitle: "Radar", value: "Sistema de Radar Avanzado" }, { subtitle: "GPS", value: "Sistema GPS Dual" }, { subtitle: "Sistemas de comunicación", value: "Comunicación Satelital" } ] }
];

// Escena, cámara, renderer
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 200, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

// --- Audio ---
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();

// Sonidos
const boatSound = new THREE.Audio(listener);
const openSound = new THREE.Audio(listener);
const closeSound = new THREE.Audio(listener);
const motorSound = new THREE.Audio(listener);

audioLoader.load('sounds/boat.mp3', buffer => {
  boatSound.setBuffer(buffer);
  boatSound.setLoop(true);
  boatSound.setVolume(0.5);
});

audioLoader.load('sounds/open.mp3', buffer => {
  openSound.setBuffer(buffer);
  openSound.setLoop(false);
  openSound.setVolume(1.0);
});

audioLoader.load('sounds/close.mp3', buffer => {
  closeSound.setBuffer(buffer);
  closeSound.setLoop(false);
  closeSound.setVolume(1.0);
});

audioLoader.load('sounds/motor.mp3', buffer => {
  motorSound.setBuffer(buffer);
  motorSound.setLoop(true);
  motorSound.setVolume(1.0);
});

let audioStarted = false;
renderer.domElement.addEventListener("click", () => {
  if (!audioStarted) {
    audioStarted = true;
    motorSound.play();
    boatSound.play();
  }
});

// boton mute
const muteBtn = document.getElementById("muteBtn");
const muteVideo = document.getElementById("muteVideo");
muteVideo.src = "videos/botones/sound.webm";
let isMuted = false;
const allSounds = [boatSound, openSound, closeSound, motorSound];

function applyMuteState() {
  allSounds.forEach(s => {
    if (!s) return;

    if (isMuted) {
      s.setVolume(0);
    } else {
      if (s === boatSound) s.setVolume(0.5);
      if (s === openSound) s.setVolume(1.0);
      if (s === closeSound) s.setVolume(1.0);
      if (s === motorSound) s.setVolume(1.0);
    }
  });
}

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  applyMuteState();
  muteVideo.src = isMuted ? "videos/botones/mute.webm" : "videos/botones/sound.webm";
});


// Luces
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Cielo
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms["turbidity"].value = 2;
skyUniforms["rayleigh"].value = 0.1;
skyUniforms["mieCoefficient"].value = 0.0005;
skyUniforms["mieDirectionalG"].value = 0.1;

const sun = new THREE.Vector3();

// Agua 
const oceanVideo = document.createElement("video");
oceanVideo.src = "videos/oceano.webm";
oceanVideo.loop = true;
oceanVideo.muted = true;
oceanVideo.preload = "auto";
oceanVideo.play();

const oceanTexture = new THREE.VideoTexture(oceanVideo);
oceanTexture.minFilter = THREE.LinearFilter;
oceanTexture.magFilter = THREE.LinearFilter;
oceanTexture.format = THREE.RGBAFormat;

const oceanMaterial = new THREE.MeshBasicMaterial({
  map: oceanTexture,
  side: THREE.DoubleSide,
});

const oceanGeometry = new THREE.PlaneGeometry(600, 400);
const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
oceanMesh.rotation.x = -Math.PI / 2;
oceanMesh.position.y = 0;
scene.add(oceanMesh);

const waterVertexShader = `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPos;

// --- Gerstner Wave función ---
vec3 gerstnerWave(vec2 dir, float steep, float wavelength, float speed, float amplitude, vec3 pos, float time) {
    float k = 2.0 * 3.14159 / wavelength;
    float phase = k * dot(dir, pos.xy) + time * speed;
    float disp = amplitude * sin(phase);

    pos.x += dir.x * (steep * amplitude * cos(phase));
    pos.y += dir.y * (steep * amplitude * cos(phase));
    pos.z += disp;

    return pos;
}

// --- FBM turbulento ---
float improvedNoise(vec2 p) {
    float f = 0.0;
    float amp = 0.6;
    for (int i = 0; i < 6; i++) {
        f += amp * sin(p.x) * cos(p.y);
        p *= 2.5;
        amp *= 0.47;
    }
    return f;
}

void main() {
    vNormal = normal;
    vec3 pos = position;
    float t = uTime * 1.4;   // 💥 velocidad global aumentada

    // --- OLAS MÁS GRANDES Y RÁPIDAS ---
    pos = gerstnerWave(normalize(vec2(1.0, 0.2)), 0.35, 7.0, 1.9, 0.55, pos, t);
    pos = gerstnerWave(normalize(vec2(-0.6, 1.0)), 0.40, 5.5, 2.2, 0.45, pos, t);
    pos = gerstnerWave(normalize(vec2(0.5, -1.0)), 0.32, 9.0, 1.8, 0.50, pos, t);
    pos = gerstnerWave(normalize(vec2(-1.0, -0.4)), 0.30, 12.0, 1.1, 0.35, pos, t);

    // --- NUEVAS OLAS PEQUEÑAS ---
    pos = gerstnerWave(normalize(vec2(0.8, -0.3)), 0.25, 3.0, 3.2, 0.18, pos, t);
    pos = gerstnerWave(normalize(vec2(-0.3, 0.7)), 0.20, 2.5, 2.8, 0.15, pos, t);

    // --- RUIDO TIPO TORMENTA ---
    float noise = improvedNoise(pos.xy * 0.35 + t * 0.2) * 0.55;  // 💥 ruido más fuerte
    pos.z += noise;

    vPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;


const waterFragmentShader = `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
    float fresnel = pow(1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 3.0);

    float depthMix = smoothstep(-2.0, 1.0, vPos.z);
    vec3 color = mix(uDeepColor, uShallowColor, depthMix);

    color += fresnel * 0.2;
    float shade = dot(normalize(vNormal), vec3(0.3, 0.5, 1.0));
    shade = clamp(shade, 0.2, 1.0);

    color *= shade * 0.9;

    color += sin(uTime * 0.2 + vPos.x * 0.03) * 0.02;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

const waterMaterial = new THREE.ShaderMaterial({
  vertexShader: waterVertexShader,
  fragmentShader: waterFragmentShader,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color("#00101f") },
      uShallowColor: { value: new THREE.Color("#046c8b") },
      uOpacity: { value: 0.9 }
  }
});

const waterGeometry = new THREE.PlaneGeometry(12000, 12000, 256, 256);
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
//scene.add(water);


function updateSun() {
    const inclination = 0.02;
    const azimuth = 0.205;

    const theta = Math.PI * (inclination - 0.5);
    const phi = 2 * Math.PI * (azimuth - 0.5);

    sun.x = Math.cos(phi);
    sun.y = Math.sin(phi) * Math.sin(theta);
    sun.z = Math.sin(phi) * Math.cos(theta);

    sky.material.uniforms["sunPosition"].value.copy(sun);
}
updateSun();


// Variables globales
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let offset = new THREE.Vector3();

let boat = null;    
let boatContainer = null;
let boatVisual = null; 
let boatHitbox = null;
let lastBoatPosition = new THREE.Vector3();
let isDragging = false;

// Prueba con Frames
let waveFrames = [];
let currentWaveIndex = 0;
let waveFrameContainer;
let waveFrameSpeed = 5; // FPS
let waveFrameTimer = 0;
let waveDirection = 1;

let backWaveFrames = [];
let currentBackWaveIndex = 0;
let backWaveFrameContainer;
let backWaveFrameSpeed = 5; // FPS
let backWaveFrameTimer = 0;
let backWaveDirection = 1;

// Burbujas
let bubbles = [];

// TouchPoints
let touchPoints = {};

function getMouseNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1
  };
}

// Bote
const loader = new GLTFLoader();
loader.load('models/barco/barco.gltf', (gltfScene) => {
  boatContainer = new THREE.Object3D();
  boatContainer.name = "boatContainer";
  boatVisual = gltfScene.scene;
  boatVisual.name = "boatVisual";
  boatVisual.traverse((child) => {
    if (child.isMesh) {
      console.log(child.material);
    }
  });
  boatVisual.scale.set(1.2, 0.1, 1.2);
  boatVisual.position.set(0, 2, 10);
  boatVisual.rotation.z = 600;

  // HITBOX
  const hitboxSize = new THREE.Vector3(50, 400, 250);
  const hitboxGeometry = new THREE.BoxGeometry(hitboxSize.x, hitboxSize.y, hitboxSize.z);
  const hitboxMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });
  boatHitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
  boatHitbox.name = "boatHitbox";
  boatHitbox.visible = false;

  boatHitbox.position.set(-3, hitboxSize.y / 2 - 5, 0);

  boatContainer.add(boatHitbox);
  boatContainer.add(boatVisual);

  boatContainer.position.set(0, 0.5, 10);

  boat = boatContainer;
  lastBoatPosition.copy(boat.position);

  scene.add(boatContainer);
  spawnBubbles();

}, undefined, function (error) {
  console.error('Error al cargar el modelo:', error);
});

// ---- Cargar frames de animación ----
const framePaths = [
  'models/wave/Frame1.gltf',
  'models/wave/Frame2.gltf',
  'models/wave/Frame3.gltf',
  'models/wave/Frame4.gltf'
];

waveFrameContainer = new THREE.Object3D();
waveFrameContainer.position.set(0, 0, 0);
scene.add(waveFrameContainer);

framePaths.forEach((path, i) => {
  loader.load(path, gltf => {
    const frame = gltf.scene;
    frame.visible = false;

    frame.scale.set(80, 80, 120);
    frame.position.set(0, -10, 57);

    waveFrames[i] = frame;
    waveFrameContainer.add(frame);
  });
});

const backFramePaths = [
  "models/estela/Frame1.gltf",
  "models/estela/Frame2.gltf",
  "models/estela/Frame3.gltf",
  "models/estela/Frame4.gltf",
  "models/estela/Frame5.gltf",
  "models/estela/Frame6.gltf"
];

backWaveFrameContainer = new THREE.Object3D();
backWaveFrameContainer.name = "backWaveFrameContainer";
scene.add(backWaveFrameContainer);

backFramePaths.forEach((path, i) => {
  loader.load(path, gltf => {
    const frame = gltf.scene;
    frame.visible = false;

    frame.scale.set(60, 60, 120);
    frame.position.set(0, -3, 260);

    backWaveFrames[i] = frame;
    backWaveFrameContainer.add(frame);
  });
});


// Interacciones: pointerdown / move / up
// El raycast para arrastrar se hace contra el modelo visual para facilidad
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== undefined && event.button !== 0) return;

  const ndc = getMouseNDC(event);
  mouse.x = ndc.x; mouse.y = ndc.y;
  raycaster.setFromCamera(mouse, camera);

  if (!boatVisual) return;
  const intersects = raycaster.intersectObject(boatVisual, true);
  if (intersects.length > 0) {
    isDragging = true;
    offset.copy(intersects[0].point).sub(boat.position);

    try { renderer.domElement.setPointerCapture(event.pointerId); } catch (e) {}
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isDragging) return;

  const ndc = getMouseNDC(event);
  mouse.x = ndc.x; mouse.y = ndc.y;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(oceanMesh);
  if (intersects.length > 0 && boat) {
    const point = intersects[0].point.clone();
    point.sub(offset);
    point.y = 2;
    boat.position.copy(point);

    // rotación suave del container
    const direction = new THREE.Vector3().subVectors(boat.position, lastBoatPosition);
    if (direction.length() > 0.001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      let delta = targetRotation - boat.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const rotationSpeed = 0.05 + Math.abs(delta) * 0.1;
      boat.rotation.y += delta * rotationSpeed;
    }

    lastBoatPosition.copy(boat.position);
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (isDragging) {
    isDragging = false;
    try { renderer.domElement.releasePointerCapture(event.pointerId); } catch (e) {}
  }
});

renderer.domElement.addEventListener('pointercancel', () => { isDragging = false; });


// Burbujas 
function spawnBubbles() {
  const bubbleCount = 6;
  const bubbleRadius = 20;
  const minDistance = bubbleRadius * 2.5;
  const minDistanceFromBoat = bubbleRadius * 3;

  const videoPaths = [
    'videos/burbujas/dimensiones.webm',
    'videos/burbujas/rendimiento.webm',
    'videos/burbujas/capacidades.webm',
    'videos/burbujas/propulsion.webm',
    'videos/burbujas/sistema.webm',
    'videos/burbujas/navegacion.webm'
  ].map(path => `${path}?v=${Date.now()}`);

  const buttonHeight = 100;

  for (let i = 0; i < bubbleCount; i++) {
    let valid = false;
    let attempts = 0;
    let bubble;

    while (!valid && attempts < 500) {
      attempts++;
      const geometry = new THREE.SphereGeometry(bubbleRadius, 32, 32);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x046c8b,
        transparent: false,
        opacity: 1,
        roughness: 0.05,
        metalness: 0.2,
        transmission: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
      });

      bubble = new THREE.Mesh(geometry, material);

      const x = (Math.random() - 0.5) * 250;
      const z = (Math.random() - 0.5) * 150;
      const y = 20 + Math.random() * 10;
      bubble.position.set(x, y, z);

      let tooClose = false;
      for (const existing of bubbles) {
        if (bubble.position.distanceTo(existing.position) < minDistance) { tooClose = true; break; }
      }
      if (boat && bubble.position.distanceTo(boat.position) < minDistanceFromBoat) tooClose = true;
      const projected = bubble.position.clone().project(camera);
      const screenY = (1 - projected.y) * 0.5 * window.innerHeight;
      if (screenY > window.innerHeight - buttonHeight) tooClose = true;

      if (!tooClose) valid = true;
    }

    if (valid && bubble) {
      const video = document.createElement('video');
      video.src = videoPaths[i];
      video.loop = true; video.muted = true; video.play();

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;

      const spriteMaterial = new THREE.SpriteMaterial({
        map: videoTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(bubbleRadius * 1.5, bubbleRadius * 1.5, 1);
      sprite.position.set(0, 0, 0.1);
      bubble.add(sprite);

      bubble.userData.sprite = sprite;
      bubble.userData.info = bubbleInfo[i];

      bubble.scale.set(0.01, 0.01, 0.01);
      bubbles.push(bubble);
      scene.add(bubble);

      const targetScale = bubbleRadius / 25;
      const growSpeed = 0.02 + Math.random() * 0.01;
      bubble.userData.growing = { progress: 0, speed: growSpeed, target: targetScale };
    }

    bubble.renderOrder = 999;
    bubble.userData.sprite.renderOrder = 1000;
  }
}

// Info panel 
const infoPanel = document.getElementById('infoPanel');
const infoTitle = document.getElementById('infoTitle');
const infoText = document.getElementById('infoText');
const closePanelBtn = document.getElementById('closePanelBtn');

let typingController = { cancel: false };
function stopTyping() { typingController.cancel = true; }

function typeLinesIntoGrid(data, speed = 16, delay = 150) {
  let lineIndex = 0;

  function typeNextLine() {
    if (lineIndex >= data.length) return;
    const item = data[lineIndex];
    const subtitleEl = document.getElementById(`subtitle-${lineIndex}`);
    const valueEl = document.getElementById(`value-${lineIndex}`);
    const subtitleText = item.subtitle;
    const valueText = item.value;
    let sIndex = 0;
    let vIndex = 0;

    function typeSubtitle() {
      if (sIndex < subtitleText.length) {
        subtitleEl.textContent += subtitleText[sIndex++];
        setTimeout(typeSubtitle, speed);
      } else {
        setTimeout(typeValue, speed * 3);
      }
    }

    function typeValue() {
      if (vIndex < valueText.length) {
        valueEl.textContent += valueText[vIndex++];
        setTimeout(typeValue, speed);
      } else {
        lineIndex++;
        setTimeout(typeNextLine, delay);
      }
    }
    typeSubtitle();
  }
  typeNextLine();
}

// Info Panel Top
const topToggle = document.getElementById('topToggle');
const topArrow = document.getElementById('topArrow');
const infoPanelTop = document.getElementById('infoPanelTop');

let panelOpen = false;
const panelTopData = {
  title: "Lancha Patrullera Voxel (LPV): El Centro de Mando Móvil.",
  subtitle: "Diseñada y construida en Colombia, la LPV combina un casco de alta resistencia con la superioridad tecnológica. Equipada con radar de vigilancia avanzada y sistemas de comunicaciones seguras, esta plataforma ofrece el mando y control (C2) decisivo para operaciones rápidas en cualquier entorno acuático. Precisión Voxel, Poder Colombiano."
};

function updateTopPanelContent() {
  const titleEl = document.getElementById("infoTitleTop");
  const textEl = document.getElementById("infoTextTop");

  titleEl.textContent = panelTopData.title;
  textEl.innerHTML = `<strong>${panelTopData.subtitle}</strong>`;
}

// Abrir/Cerrar toggle
topToggle.addEventListener('click', () => {
  panelOpen = !panelOpen;
  if (panelOpen) {
    infoPanelTop.classList.add('visible');
    topArrow.classList.add('open');
    updateTopPanelContent();
    if (openSound.buffer) openSound.play();
  } else {
    infoPanelTop.classList.remove('visible');
    topArrow.classList.remove('open');
    if (closeSound.buffer) closeSound.play();
  }
});

function onBubbleClick(bubble, index) {
  const info = bubbleInfo[index];
  if (!info) return;
  stopTyping();
  infoTitle.textContent = info.title;
  const emptyGridHTML = `
    <div class="infoGrid">
      ${info.data
        .map(
          (item, i) => `
        <div class="infoItem" id="infoItem-${i}">
          <span class="subtitle" id="subtitle-${i}"></span>
          <span class="value" id="value-${i}"></span>
        </div>
      `
        )
        .join("")}
    </div>
  `;
  infoText.innerHTML = emptyGridHTML;
  infoPanel.classList.add("visible");
  typeLinesIntoGrid(info.data);

  if (openSound.buffer) openSound.play();
}

closePanelBtn.addEventListener('click', (e) => {
   e.stopPropagation(); 
   stopTyping(); 
   infoPanel.classList.remove('visible'); 
   if (closeSound.buffer) closeSound.play();
  });
  
// click sobre burbujas
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (isDragging) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
 
  mouse.set(x, y);
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(bubbles, true);
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !bubbles.includes(obj)) obj = obj.parent;
    const index = bubbles.indexOf(obj);
    if (index >= 0) onBubbleClick(obj, index);
  }
});

// Touchponints - detectar 
renderer.domElement.addEventListener("touchstart", onTouchUpdate);
renderer.domElement.addEventListener("touchmove", onTouchUpdate);
renderer.domElement.addEventListener("touchend", onTouchEnd);
renderer.domElement.addEventListener("touchcancel", onTouchEnd);

function onTouchUpdate(event) {
  event.preventDefault();

  touchPoints = {};

  for (let t of event.touches) {
    touchPoints[t.identifier] = {
        x: t.clientX,
        y: t.clientY
    };
  }

  if (Object.keys(touchPoints).length === 3) {
      updateBoatFromTouches();
  }
}

function onTouchEnd(event) {
  for (let t of event.changedTouches) {
    delete touchPoints[t.identifier];
  }
}

function updateBoatFromTouches() {
    const keys = Object.keys(touchPoints);
    if (keys.length !== 3) return;

    const p = keys.map(k => touchPoints[k]);
    const world = p.map(pt => screenToWorld(pt.x, pt.y));
    const center = new THREE.Vector3(
        (world[0].x + world[1].x + world[2].x) / 3,
        2,
        (world[0].z + world[1].z + world[2].z) / 3
    );

    let frontIndex = 0;
    let maxDist = 0;

    for (let i = 0; i < 3; i++) {
        const d = world[i].distanceTo(center);
        if (d > maxDist) {
            maxDist = d;
            frontIndex = i;
        }
    }

    const front = world[frontIndex];
    const back1 = world[(frontIndex + 1) % 3];
    const back2 = world[(frontIndex + 2) % 3];

    const physicalBackCenter = new THREE.Vector3(
        (back1.x + back2.x) / 2,
        2,
        (back1.z + back2.z) / 2
    );

    const physicalCenter = new THREE.Vector3(
        (front.x + physicalBackCenter.x) / 2,
        2,
        (front.z + physicalBackCenter.z) / 2
    );

    boat.position.copy(physicalCenter);
    const dir = new THREE.Vector3().subVectors(front, physicalBackCenter);
    const angle = Math.atan2(dir.x, dir.z);

    boat.rotation.y = angle;
    const modelFront = new THREE.Vector3(0, 0, 100);
    const modelBack = new THREE.Vector3(0, 0, -120);

    const modelDir = new THREE.Vector3().subVectors(modelFront, modelBack);
    const modelAngle = Math.atan2(modelDir.x, modelDir.z);

    const correction = angle - modelAngle;

    boat.rotation.y = correction;
}


function screenToWorld(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((x - rect.left) / rect.width) * 2 - 1,
    -((y - rect.top) / rect.height) * 2 + 1
  );

  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(water);
  return hits.length > 0 ? hits[0].point.clone() : new THREE.Vector3();
}


// Animación principal
function animate() {
  requestAnimationFrame(animate);
  waterMaterial.uniforms.uTime.value += 0.02;
  const deltaTime = 1.0 / 60.0;

  // Animar agua
  if (water.material.uniforms && water.material.uniforms['time']) {
    water.material.uniforms['time'].value += deltaTime;
  }

  //animar olas
 if (waveFrames.length === framePaths.length) {

  waveFrameTimer += deltaTime;

  if (waveFrameTimer > 1 / waveFrameSpeed) {
    waveFrameTimer = 0;

    // Ocultamos frame actual
    waveFrames[currentWaveIndex].visible = false;
    currentWaveIndex += waveDirection;
    if (currentWaveIndex >= waveFrames.length - 1) {
      currentWaveIndex = waveFrames.length - 1;
      waveDirection = -1;
    }
    else if (currentWaveIndex <= 0) {
      currentWaveIndex = 0;
      waveDirection = 1;
    }
    // Mostrar siguiente frame 
    waveFrames[currentWaveIndex].visible = true;
  }

  //  Animacion olas traseras por frames 
if (backWaveFrames.length === backFramePaths.length) {

  backWaveFrameTimer += deltaTime;

  if (backWaveFrameTimer > 1 / backWaveFrameSpeed) {
    backWaveFrameTimer = 0;

    // Ocultar frame actual
    backWaveFrames[currentBackWaveIndex].visible = false;
    currentBackWaveIndex += backWaveDirection;
    if (currentBackWaveIndex >= backWaveFrames.length - 1) {
      currentBackWaveIndex = backWaveFrames.length - 1;
      backWaveDirection = -1;
    }
    else if (currentBackWaveIndex <= 0) {
      currentBackWaveIndex = 0;
      backWaveDirection = 1;
    }

    // Mostrar siguiente frame
    backWaveFrames[currentBackWaveIndex].visible = true;
  }
}

  // Hacer que el frame delantero siga al barco
  if (boat) {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(boat.quaternion);
    forward.normalize();

    const offset = 55;
    const wavePos = boat.position.clone().addScaledVector(forward, offset);

    waveFrameContainer.position.lerp(wavePos, 0.5);
    waveFrameContainer.rotation.y = boat.rotation.y;
  }

  // Hacer que el frame trasero siga al barco
  if (boat && backWaveFrameContainer) {
    const forwardB = new THREE.Vector3(0, 0, 1);
    forwardB.applyQuaternion(boat.quaternion);
    forwardB.normalize();

    const backOffset = -150; // negativo para atrás — ajusta a tu gusto
    const backPos = boat.position.clone().addScaledVector(forwardB, backOffset);

    backWaveFrameContainer.position.lerp(backPos, 0.5);
    backWaveFrameContainer.rotation.y = boat.rotation.y;
   }
}

  // Animación de aparición y flotación de las burbujas
  bubbles.forEach(bubble => {
    const grow = bubble.userData.growing;
    if (grow && grow.progress < 1) {
      grow.progress += grow.speed;
      const s = THREE.MathUtils.lerp(0.01, grow.target, grow.progress);
      bubble.scale.set(s, s, s);
      if (grow.progress >= 1) delete bubble.userData.growing;
    }
  });

  // === Empuje físico con HITBOX ===
  if (boat && boatHitbox) {
    const boatVel = new THREE.Vector3().subVectors(boat.position, lastBoatPosition);
    const boatSpeed = boatVel.length();

    const boatBox = new THREE.Box3().setFromObject(boatHitbox);

    bubbles.forEach((bubble, i) => {
      const bubbleBox = new THREE.Box3().setFromCenterAndSize(
        bubble.position.clone(),
        new THREE.Vector3(bubble.scale.x * 25, bubble.scale.y * 25, bubble.scale.z * 25)
      );

      if (boatBox.intersectsBox(bubbleBox)) {
        const pushDir = new THREE.Vector3().subVectors(bubble.position, boat.position).normalize();
        pushDir.y = 0;

        const pushStrength = THREE.MathUtils.clamp(boatSpeed * 180, 3, 100);

        if (!bubble.userData.velocity) bubble.userData.velocity = new THREE.Vector3();
        bubble.userData.velocity.addScaledVector(pushDir, pushStrength);
      }

      if (!bubble.userData.velocity) bubble.userData.velocity = new THREE.Vector3();

      // colisiones entre burbujas
      for (let j = i + 1; j < bubbles.length; j++) {
        const other = bubbles[j];
        const diff = new THREE.Vector3().subVectors(bubble.position, other.position);
        const dist = diff.length();
        const minDist = 25 * bubble.scale.x + 25 * other.scale.x;

        if (dist < minDist && dist > 0) {
          diff.normalize();
          const overlap = (minDist - dist) * 0.5;
          bubble.position.addScaledVector(diff, overlap);
          other.position.addScaledVector(diff, -overlap);

          const impulse = diff.multiplyScalar(0.4);
          bubble.userData.velocity.add(impulse);
          other.userData.velocity.sub(impulse);
        }
      }

      // fricción y movimiento
      bubble.userData.velocity.multiplyScalar(0.92);
      bubble.position.x += bubble.userData.velocity.x * 0.12;
      bubble.position.z += bubble.userData.velocity.z * 0.12;

      // límites laterales
      const limitX = 125;
      const limitZ = 75;
      if (bubble.position.x > limitX) { bubble.position.x = limitX; bubble.userData.velocity.x *= -0.7; }
      else if (bubble.position.x < -limitX) { bubble.position.x = -limitX; bubble.userData.velocity.x *= -0.7; }
      if (bubble.position.z > limitZ) { bubble.position.z = limitZ; bubble.userData.velocity.z *= -0.7; }
      else if (bubble.position.z < -limitZ) { bubble.position.z = -limitZ; bubble.userData.velocity.z *= -0.7; }

      // oscilación vertical 
      if (!bubble.userData.baseY) bubble.userData.baseY = bubble.position.y;
      const t = performance.now() * 0.001 + bubble.position.x * 0.03;
      bubble.position.y = bubble.userData.baseY + Math.sin(t * 2) * 4;
    });

    lastBoatPosition.copy(boat.position);
  }

  renderer.render(scene, camera);
}

animate();


// Mapa con destellos (HUD superior) 
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
let mapDots = [];

function resizeCanvas(canvas) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resizeCanvas(mapCanvas);

for (let i = 0; i < 30; i++) {
  mapDots.push({ x: Math.random() * mapCanvas.width, y: Math.random() * mapCanvas.height, size: Math.random() * 2 + 1, alpha: Math.random(), speed: 0.005 + Math.random() * 0.01 });
}

function animateMap() {
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.strokeStyle = "#1900ff26";
  mapCtx.lineWidth = 1;
  for (let x = 0; x < mapCanvas.width; x += 40) {
    mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, mapCanvas.height); mapCtx.stroke();
  }
  for (let y = 0; y < mapCanvas.height; y += 40) {
    mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(mapCanvas.width, y); mapCtx.stroke();
  }
  mapDots.forEach(dot => {
    dot.alpha += dot.speed;
    if (dot.alpha > 1 || dot.alpha < 0) dot.speed *= -1;
    mapCtx.beginPath(); mapCtx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
    mapCtx.fillStyle = `rgba(0,255,255,${dot.alpha})`; mapCtx.fill();
  });
  requestAnimationFrame(animateMap);
}
animateMap();

// HUD inferior (radar lines) 
const hudCanvas = document.getElementById('hudCanvas');
const hudCtx = hudCanvas.getContext('2d');
resizeCanvas(hudCanvas);
let hudTime = 0;

function animateHUD() {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  hudTime += 0.02;
  for (let i = 0; i < 10; i++) {
    const y = hudCanvas.height / 2 + Math.sin(hudTime + i) * 20;
    hudCtx.beginPath();
    hudCtx.moveTo(0, y);
    hudCtx.lineTo(hudCanvas.width, y);
    hudCtx.strokeStyle = `rgba(0,255,255,${0.2 + 0.1 * Math.sin(hudTime + i)})`;
    hudCtx.lineWidth = 1;
    hudCtx.stroke();
  }
  requestAnimationFrame(animateHUD);
}
animateHUD();