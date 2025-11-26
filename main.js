import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
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
camera.position.set(0, 60, 200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Audio ---
const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();

// Sonidos
const oceanSound = new THREE.Audio(listener);
const boatSound = new THREE.Audio(listener);
const openSound = new THREE.Audio(listener);
const closeSound = new THREE.Audio(listener);

audioLoader.load('sounds/ocean.mp3', buffer => {
  oceanSound.setBuffer(buffer);
  oceanSound.setLoop(true);
  oceanSound.setVolume(0.4);
});

audioLoader.load('sounds/boat.mp3', buffer => {
  boatSound.setBuffer(buffer);
  boatSound.setLoop(true);
  boatSound.setVolume(0.7);
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

let audioStarted = false;
renderer.domElement.addEventListener("click", () => {
  if (!audioStarted) {
    audioStarted = true;
    if (oceanSound.buffer) oceanSound.play();
  }
});


// boton mute
let isMuted = false;
const allSounds = [oceanSound, boatSound, openSound, closeSound];

function applyMuteState() {
  allSounds.forEach(s => {
    if (!s) return;

    if (isMuted) {
      s.setVolume(0);
    } else {
      if (s === oceanSound) s.setVolume(0.4);
      if (s === boatSound) s.setVolume(0.7);
      if (s === openSound) s.setVolume(1.0);
      if (s === closeSound) s.setVolume(1.0);
    }
  });
}
const muteBtn = document.getElementById("muteBtn");
const muteVideo = document.getElementById("muteVideo");
muteVideo.src = "videos/botones/sound.webm";

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
const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

const water = new Water(waterGeometry, {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: new THREE.TextureLoader().load(
        "https://threejs.org/examples/textures/waternormals.jpg",
        (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: new THREE.Color(0x001433), 
    reflectivity: 0.005,
    distortionScale: 1.8,
    fog: scene.fog !== undefined
});

water.rotation.x = -Math.PI / 2;
scene.add(water);

function updateSun() {
    const inclination = 0.02;
    const azimuth = 0.205;

    const theta = Math.PI * (inclination - 0.5);
    const phi = 2 * Math.PI * (azimuth - 0.5);

    sun.x = Math.cos(phi);
    sun.y = Math.sin(phi) * Math.sin(theta);
    sun.z = Math.sin(phi) * Math.cos(theta);

    sky.material.uniforms["sunPosition"].value.copy(sun);
    water.material.uniforms["sunDirection"].value.copy(sun).normalize();
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

// movimiento / cámara / modos
let targetBoatPos = null;
let targetCameraPos = null;
let cinematicMode = false;
let inDetailsMode = false;

// Burbujas
let bubbles = [];

function getMouseNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1
  };
}

// Bote
const loader = new GLTFLoader();
loader.load('models/3dpea.com_Sin_nombre/Sin_nombre.gltf', (gltfScene) => {
  boatContainer = new THREE.Object3D();
  boatContainer.name = "boatContainer";
  boatVisual = gltfScene.scene;
  boatVisual.name = "boatVisual";
  boatVisual.traverse((child) => {
    if (child.isMesh) {
      console.log(child.material);
    }
  });
  boatVisual.scale.set(1.1, 1.1, 1.1);
  boatVisual.position.set(0, 0.5, 0);

  // HITBOX
  const hitboxSize = new THREE.Vector3(40, 40, 200);
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

  boatContainer.position.set(0, 0.5, 0);

  boat = boatContainer;
  lastBoatPosition.copy(boat.position);

  scene.add(boatContainer);

}, undefined, function (error) {
  console.error('Error al cargar el modelo:', error);
});


// === ESPUMA DETRÁS DEL BARCO ===
const backFoamPlanes = [];
const backFoamPerLine = 25; // numero de manchas por línea
const backFoamLines = 5;  // 5 generadores de espuma

const foamTexture = new THREE.TextureLoader().load("public/textures/foam.png");

const backLateralOffsets = [-20,-12, -4, 4, 12];  // izquierda - centro - derecha

for (let line = 0; line < backFoamLines; line++) {
  for (let i = 0; i < backFoamPerLine; i++) {

    const material = new THREE.MeshBasicMaterial({
      map: foamTexture,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.PlaneGeometry(3, 3); // tamaño espuma
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    backFoamPlanes.push({
      mesh: plane,
      life: Math.random() * 1.5,
      maxLife: 1 + Math.random(),
      delay: Math.random() * 0.5,
      lineOffset: backLateralOffsets[line]
    });
  }
}


// === ESPUMA FRONTAL ===
const frontFoamLeftPlanes = [];
const frontFoamRightPlanes = [];
const frontFoamPerLine = 25;
const frontFoamTexture = foamTexture;
let frontGeneratorOffsetLeft = -6;
let frontGeneratorOffsetRight = -6;

// CREAR ESPUMA FRONTAL IZQUIERDA
for (let i = 0; i < frontFoamPerLine; i++) {
    const material = new THREE.MeshBasicMaterial({
        map: frontFoamTexture,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.PlaneGeometry(3, 3);
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    frontFoamLeftPlanes.push({
        mesh: plane,
        life: Math.random() * 1.5,
        maxLife: 1 + Math.random(),
        delay: Math.random() * 0.5,
        lineOffset: frontGeneratorOffsetLeft
    });
}

// CREAR ESPUMA FRONTAL DERECHA
for (let i = 0; i < frontFoamPerLine; i++) {
    const material = new THREE.MeshBasicMaterial({
        map: frontFoamTexture,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.PlaneGeometry(3, 3);
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    frontFoamRightPlanes.push({
        mesh: plane,
        life: Math.random() * 1.5,
        maxLife: 1 + Math.random(),
        delay: Math.random() * 0.5,
        lineOffset: frontGeneratorOffsetRight
    });
}

// === ESPUMA A LOS LADOS DEL BARCO ===
const sideFoamPlanes = [];
const sideFoamPerLine = 50; // numero de manchas por línea
const sideFoamLines = 2;  // 2 generadores de espuma

const sideFoamTexture = foamTexture;

const sideLateralOffsets = [-25, 15];

for (let line = 0; line < sideFoamLines; line++) {
  for (let i = 0; i < sideFoamPerLine; i++) {

    const material = new THREE.MeshBasicMaterial({
      map: sideFoamTexture,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.PlaneGeometry(3, 3); // tamaño espuma
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    sideFoamPlanes.push({
      mesh: plane,
      life: Math.random() * 1.5,
      maxLife: 1 + Math.random(),
      delay: Math.random() * 0.5,
      lineOffset: sideLateralOffsets[line]
    });
  }
}


// Interacciones: pointerdown / move / up
// El raycast para arrastrar se hace contra el modelo visual para facilidad
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (cinematicMode) return;
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

    if (boatSound.buffer && !boatSound.isPlaying) {
      boatSound.play();
    }
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (cinematicMode || !isDragging) return;

  const ndc = getMouseNDC(event);
  mouse.x = ndc.x; mouse.y = ndc.y;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(water);
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

    // limitar posición si estás en modo detalles
    if (inDetailsMode) {
      const limitX = 170;
      const limitZ = 100;
      boat.position.x = THREE.MathUtils.clamp(boat.position.x, -limitX, limitX);
      boat.position.z = THREE.MathUtils.clamp(boat.position.z, -limitZ, limitZ);
    }

    lastBoatPosition.copy(boat.position);
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (isDragging) {
    isDragging = false;
    try { renderer.domElement.releasePointerCapture(event.pointerId); } catch (e) {}
    if (boatSound.isPlaying) boatSound.stop();
  }
});

renderer.domElement.addEventListener('pointercancel', () => { isDragging = false; });

// Botón Detalles 
const detailsBtn = document.getElementById('detailsBtn');
detailsBtn.addEventListener('click', () => {
  if (!boat || cinematicMode) return;

  const DETAILS_CAMERA_POS = new THREE.Vector3(0, 200, 0);
  const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 60, 200);
  const CENTER_BOAT_POS = new THREE.Vector3(0, 2, 0);

  if (!inDetailsMode) {
    targetBoatPos = CENTER_BOAT_POS.clone();
    targetCameraPos = DETAILS_CAMERA_POS.clone();
    cinematicMode = true;
    isDragging = false;
    inDetailsMode = true;
    detailsBtn.innerHTML =`<video src="videos/botones/botonVolver.webm" autoplay loop muted></video>`;
    detailsBtn.classList.add("returnMode");
    if (boat.userData && boat.userData.velocity) boat.userData.velocity.set(0,0,0);
  } else {
    cinematicMode = true;
    targetCameraPos = DEFAULT_CAMERA_POS.clone();
    targetBoatPos = null;
    inDetailsMode = false;
    detailsBtn.textContent = 'Detalles';
    detailsBtn.classList.remove("returnMode");

    // limpiar burbujas
    bubbles.forEach(b => {
      if (b.userData && b.userData.sprite) scene.remove(b.userData.sprite);
      if (b.geometry) b.geometry.dispose();
      if (b.material) b.material.dispose();
      scene.remove(b);
    });
    bubbles.length = 0;
  }
});

// Burbujas 
function spawnBubbles() {
  // limpiar
  bubbles.forEach(b => {
    if (b.userData && b.userData.sprite) scene.remove(b.userData.sprite);
    scene.remove(b);
  });
  bubbles = [];

  const bubbleCount = 6;
  const bubbleRadius = 20;
  const minDistance = bubbleRadius * 2.5;
  const minDistanceFromBoat = bubbleRadius * 3;

  const videoPaths = [
    'videos/dimensiones.webm',
    'videos/rendimiento.webm',
    'videos/capacidades.webm',
    'videos/propulsion.webm',
    'videos/sistema.webm',
    'videos/navegacion.webm'
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
        color: 0xBE0077,
        transparent: true,
        opacity: 0.3,
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
detailsBtn.addEventListener('click', () => {
  if (infoPanel.classList.contains('visible')) {
    stopTyping();
    infoPanel.classList.remove('visible');
    detailsBtn.textContent = 'Detalles';
  }
});

// click sobre burbujas
renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(bubbles, true);
  if (intersects.length > 0) {
    let clicked = intersects[0].object;
    while (clicked && !bubbles.includes(clicked)) clicked = clicked.parent;
    const index = bubbles.indexOf(clicked);
    if (index >= 0) onBubbleClick(clicked, index);
  }
});

// Desplazamiento espuma trasera
function updateBackFoam(delta) {
  if (!boat) return;

  backFoamPlanes.forEach(w => {
    w.life -= delta;

    if (w.life <= 0) {
      w.life = w.maxLife;

      // offset base detrás del barco
      w.offset = new THREE.Vector3(w.lineOffset, 0.2, -110);
      const sideFactor = w.lineOffset * 0.1;
      w.offset.x += sideFactor;

      w.mesh.scale.set(0.2, 0.2, 0.2);
      w.mesh.material.opacity = 0.5;
      w.mesh.visible = true;
    }

    if (w.offset) {
      const p = w.offset.clone();
      p.applyAxisAngle(new THREE.Vector3(0,1,0), boat.rotation.y);
      p.add(boat.position);
      w.mesh.position.copy(p);
    }

    const t = w.life / w.maxLife;

    const size = THREE.MathUtils.lerp(2, 30, 1 - t);
    w.mesh.scale.set(size, size, size);

    w.mesh.material.opacity = t * 0.5;

    if (w.offset) {
      w.offset.z -= 0.4 * delta * 100;
    }
  });
}


// Desplazamiento espuma delantera
function updateFrontFoamLeft(delta) {
    if (!boat) return;

    frontFoamLeftPlanes.forEach(w => {
        w.life -= delta;

        if (w.life <= 0) {
            w.life = w.maxLife;
            w.offset = new THREE.Vector3(w.lineOffset, 0.2, 100);

            w.mesh.scale.set(3, 3, 3);
            w.mesh.material.opacity = 0.5;
            w.mesh.visible = true;
        }

        if (w.offset) {
            const p = w.offset.clone();
            p.applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y);
            p.add(boat.position);
            w.mesh.position.copy(p);
        }

        const t = w.life / w.maxLife;
        const size = THREE.MathUtils.lerp(2, 30, 1 - t);
        w.mesh.scale.set(size, size, size);
        w.mesh.material.opacity = t * 0.5;

        // movimiento hacia atrás
        if (w.offset) {
            w.offset.z -= 0.4 * delta * 100;

            // movimiento lateral hacia la IZQUIERDA
            const lateralSpeed = 0.3;
            w.offset.x -= lateralSpeed * delta * 60;
        }
    });
}

function updateFrontFoamRight(delta) {
    if (!boat) return;

    frontFoamRightPlanes.forEach(w => {
        w.life -= delta;

        if (w.life <= 0) {
            w.life = w.maxLife;
            w.offset = new THREE.Vector3(w.lineOffset, 0.2, 100);

            w.mesh.scale.set(3, 3, 3);
            w.mesh.material.opacity = 0.5;
            w.mesh.visible = true;
        }

        if (w.offset) {
            const p = w.offset.clone();
            p.applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y);
            p.add(boat.position);
            w.mesh.position.copy(p);
        }

        const t = w.life / w.maxLife;
        const size = THREE.MathUtils.lerp(2, 30, 1 - t);
        w.mesh.scale.set(size, size, size);
        w.mesh.material.opacity = t * 0.5;

        // movimiento hacia atrás
        if (w.offset) {
            w.offset.z -= 0.4 * delta * 100;

            // movimiento lateral hacia la DERECHA
            const lateralSpeed = 0.3;
            w.offset.x += lateralSpeed * delta * 60;
        }
    });
}

// Desplazamiento espuma de los lados
function updateSideFoam(delta) {
    if (!boat) return;

    sideFoamPlanes.forEach(w => {
        w.life -= delta;

        if (w.life <= 0) {
            w.life = w.maxLife;

            // Offset lateral
            w.offset = new THREE.Vector3(w.lineOffset, 0.2, 30);

            w.mesh.scale.set(0.2, 0.2, 0.2);
            w.mesh.material.opacity = 0.4;
            w.mesh.visible = true;
        }

        if (w.offset) {
            let p = w.offset.clone();
            p.applyAxisAngle(new THREE.Vector3(0,1,0), boat.rotation.y);
            p.add(boat.position);
            w.mesh.position.copy(p);
        }

        const t = w.life / w.maxLife;

        const size = THREE.MathUtils.lerp(1, 12, 1 - t);
        w.mesh.scale.set(size, size, size);

        w.mesh.material.opacity = t * 0.4;

        if (w.offset) {
            w.offset.z -= 0.4 * delta * 200;
        }
    });
}


// Animación principal
function animate() {
  requestAnimationFrame(animate);

  water.material.uniforms["time"].value += 1.0 / 60.0;

  const deltaTime = 1.0 / 60.0;

  updateBackFoam(deltaTime);
  updateFrontFoamLeft(deltaTime);
  updateFrontFoamRight(deltaTime);
  updateSideFoam(deltaTime);

  // Animar agua
  if (water.material.uniforms && water.material.uniforms['time']) {
    water.material.uniforms['time'].value += deltaTime;
  }
  

  // mover bote hacia el centro
  if (boat && targetBoatPos) {
    boat.position.lerp(targetBoatPos, 0.05);
    if (boat.position.distanceTo(targetBoatPos) < 0.05) {
      boat.position.copy(targetBoatPos);
      targetBoatPos = null;
    }
  }

  // mover cámara
  if (targetCameraPos) {
    camera.position.lerp(targetCameraPos, 0.06);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(targetCameraPos) < 0.5) {
      targetCameraPos = null;
      if (cinematicMode) {
        if (inDetailsMode) {
          // FORZAMOS la posición del barco al centro
          if (boat) {
            boat.position.set(0, 2, 0);
            if (!boat.userData) boat.userData = {};
            if (boat.userData.velocity) boat.userData.velocity.set(0,0,0);
            lastBoatPosition.copy(boat.position);
          }
          spawnBubbles();
        } else {
          camera.lookAt(0, 0, 0);
        }
        cinematicMode = false;
      }
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