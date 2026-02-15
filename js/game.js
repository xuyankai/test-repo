import * as THREE from "three";

// ——— Config ———
const CONFIG = {
  moveSpeed: 0.2,
  lookSensitivity: 0.002,
  gravity: -0.008,
  jumpForce: 0.18,
  arenaSize: 40,
  wallHeight: 8,
  maxAmmo: 30,
  damage: 34,
  enemyHealth: 100,
  enemySpeed: 0.04,
  enemyDamage: 8,
  spawnInterval: 4000,
};

// ——— State ———
let scene, camera, renderer, raycaster, mouse;
let move = { forward: 0, right: 0 };
let velocityY = 0;
let isGrounded = true;
let canShoot = true;
let shootCooldown = 0;
let playerHealth = 100;
let ammo = CONFIG.maxAmmo;
let score = 0;
let gameRunning = false;
let enemies = [];
let walls = [];
let clock;

// ——— Init ———
function init() {
  const canvas = document.getElementById("game-canvas");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);
  scene.fog = new THREE.Fog(0x0a0a12, 20, 55);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2(0, 0);
  clock = new THREE.Clock();

  buildArena();
  addLights();
  bindControls();
  bindUI();
  window.addEventListener("resize", onResize);
}

function addLights() {
  const amb = new THREE.AmbientLight(0x222244, 0.4);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0x4488ff, 0.6);
  dir.position.set(15, 25, 15);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 60;
  dir.shadow.camera.left = -30;
  dir.shadow.camera.right = 30;
  dir.shadow.camera.top = 30;
  dir.shadow.camera.bottom = -30;
  scene.add(dir);

  const point = new THREE.PointLight(0x00ffaa, 0.5, 50);
  point.position.set(0, 6, 0);
  scene.add(point);
}

function buildArena() {
  const half = CONFIG.arenaSize / 2;
  const floorGeo = new THREE.PlaneGeometry(CONFIG.arenaSize, CONFIG.arenaSize);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d18,
    metalness: 0.2,
    roughness: 0.9,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid lines on floor
  const gridHelper = new THREE.GridHelper(CONFIG.arenaSize, 20, 0x00ffaa, 0x113322);
  gridHelper.position.y = 0.01;
  gridHelper.material.opacity = 0.15;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Walls (invisible colliders + visible neon edges)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.3,
    roughness: 0.8,
  });
  const wallGeo = new THREE.BoxGeometry(1, CONFIG.wallHeight, 1);

  const positions = [
    [-half, CONFIG.wallHeight / 2, 0],
    [half, CONFIG.wallHeight / 2, 0],
    [0, CONFIG.wallHeight / 2, -half],
    [0, CONFIG.wallHeight / 2, half],
  ];
  const scales = [
    [1, 1, CONFIG.arenaSize],
    [1, 1, CONFIG.arenaSize],
    [CONFIG.arenaSize, 1, 1],
    [CONFIG.arenaSize, 1, 1],
  ];

  for (let i = 0; i < 4; i++) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(...positions[i]);
    wall.scale.set(...scales[i]);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);
  }
}

function createEnemy(x, z) {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xff4466,
    emissive: 0xff2244,
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);

  group.position.set(x, 0, z);
  group.userData = { health: CONFIG.enemyHealth };
  scene.add(group);
  enemies.push(group);
}

function spawnEnemy() {
  if (!gameRunning) return;
  const margin = 12;
  const x = (Math.random() - 0.5) * 2 * margin;
  const z = (Math.random() - 0.5) * 2 * margin;
  createEnemy(x, z);
}

function hitEnemy(enemy, damage) {
  enemy.userData.health -= damage;
  if (enemy.userData.health <= 0) {
    scene.remove(enemy);
    enemies = enemies.filter((e) => e !== enemy);
    score += 100;
    updateHUD();
  }
}

function updateEnemies(delta) {
  const playerPos = camera.position;
  for (const enemy of enemies) {
    const dx = playerPos.x - enemy.position.x;
    const dz = playerPos.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    if (dist < 15) {
      enemy.position.x += (dx / dist) * CONFIG.enemySpeed;
      enemy.position.z += (dz / dist) * CONFIG.enemySpeed;
      enemy.lookAt(playerPos.x, enemy.position.y, playerPos.z);
      if (dist < 4 && Math.random() < 0.02) {
        playerHealth = Math.max(0, playerHealth - CONFIG.enemyDamage);
        updateHUD();
        if (playerHealth <= 0) endGame();
      }
    }
  }
}

function shoot() {
  if (!gameRunning || !canShoot || ammo <= 0) return;
  ammo--;
  updateHUD();
  canShoot = false;
  shootCooldown = 150;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const allEnemyMeshes = enemies.flatMap((g) => g.children);
  const intersects = raycaster.intersectObjects(allEnemyMeshes);
  if (intersects.length > 0) {
    const enemy = intersects[0].object.parent;
    if (enemy && enemy.userData && typeof enemy.userData.health === "number") {
      hitEnemy(enemy, CONFIG.damage);
    }
  }
}

function updatePlayer(delta) {
  const speed = CONFIG.moveSpeed;
  const dir = new THREE.Vector3(move.right, 0, -move.forward).normalize();
  dir.applyQuaternion(camera.quaternion);
  dir.y = 0;
  dir.normalize();
  camera.position.x += dir.x * speed;
  camera.position.z += dir.z * speed;

  velocityY += CONFIG.gravity;
  camera.position.y += velocityY;
  const floorY = 2;
  if (camera.position.y <= floorY) {
    camera.position.y = floorY;
    velocityY = 0;
    isGrounded = true;
  }

  const half = CONFIG.arenaSize / 2 - 1.2;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -half, half);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -half, half);
}

function bindControls() {
  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW": move.forward = 1; break;
      case "KeyS": move.forward = -1; break;
      case "KeyA": move.right = -1; break;
      case "KeyD": move.right = 1; break;
      case "Space":
        if (isGrounded) {
          velocityY = CONFIG.jumpForce;
          isGrounded = false;
        }
        e.preventDefault();
        break;
    }
  });
  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW": move.forward = move.forward === 1 ? 0 : move.forward; break;
      case "KeyS": move.forward = move.forward === -1 ? 0 : move.forward; break;
      case "KeyA": move.right = move.right === -1 ? 0 : move.right; break;
      case "KeyD": move.right = move.right === 1 ? 0 : move.right; break;
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!document.pointerLockElement) return;
    camera.rotation.order = "YXZ";
    camera.rotation.y -= e.movementX * CONFIG.lookSensitivity;
    camera.rotation.x -= e.movementY * CONFIG.lookSensitivity;
    camera.rotation.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, camera.rotation.x));
  });

  document.addEventListener("mousedown", (e) => {
    if (e.button === 0) shoot();
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("restart-btn").addEventListener("click", startGame);
}

function bindUI() {
  document.getElementById("game-container").addEventListener("click", () => {
    if (gameRunning && document.pointerLockElement === null) {
      document.getElementById("game-canvas").requestPointerLock();
    }
  });
}

function startGame() {
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");
  playerHealth = 100;
  ammo = CONFIG.maxAmmo;
  score = 0;
  camera.position.set(0, 2, 0);
  camera.rotation.set(0, 0, 0);
  velocityY = 0;
  move = { forward: 0, right: 0 };
  enemies.forEach((e) => scene.remove(e));
  enemies = [];
  updateHUD();
  gameRunning = true;
  document.getElementById("game-canvas").requestPointerLock();
  setTimeout(spawnEnemy, 2000);
  spawnLoop();
}

function spawnLoop() {
  if (!gameRunning) return;
  spawnEnemy();
  setTimeout(spawnLoop, CONFIG.spawnInterval);
}

function endGame() {
  gameRunning = false;
  document.exitPointerLock();
  document.getElementById("final-score").textContent = `Score: ${score}`;
  document.getElementById("game-over").classList.remove("hidden");
}

function updateHUD() {
  document.getElementById("health").textContent = `❤ ${Math.max(0, playerHealth)}`;
  document.getElementById("ammo").textContent = `▮`.repeat(ammo) + `▯`.repeat(CONFIG.maxAmmo - ammo) + ` ${ammo}`;
  document.getElementById("score").textContent = score;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ——— Loop ———
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta() * 1000, 50);

  if (gameRunning) {
    updatePlayer(delta);
    updateEnemies(delta);
    if (shootCooldown > 0) {
      shootCooldown -= delta;
      if (shootCooldown <= 0) canShoot = true;
    }
    if (ammo < CONFIG.maxAmmo && Math.random() < 0.008) {
      ammo = Math.min(CONFIG.maxAmmo, ammo + 1);
      updateHUD();
    }
  }

  renderer.render(scene, camera);
}

init();
animate();
