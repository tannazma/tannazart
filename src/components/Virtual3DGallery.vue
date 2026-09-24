<template>
  <div class="gallery-container" ref="canvasContainer">
    <div class="controls-overlay">
      <h3>Virtual Art Gallery</h3>
      <p>Use <strong>W, A, S, D</strong> or <strong>Arrow Keys</strong> to walk around. Move mouse to look around.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const canvasContainer = ref(null)
let scene, camera, renderer, animationFrameId
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false
let prevMouseX = 0, prevMouseY = 0
let yaw = 0, pitch = 0

onMounted(() => {
  // 1. Scene & Camera Setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111111)

  camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(0, 1.6, 5) // Eye level height

  // 2. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  canvasContainer.value.appendChild(renderer.domElement)

  // 3. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight.position.set(0, 10, 5)
  scene.add(directionalLight)

  // 4. Build Room (Floor, Ceiling, Walls)
  const roomWidth = 16
  const roomHeight = 5
  const roomDepth = 16

  // Floor
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // Back Wall
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 })
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat)
  backWall.position.set(0, roomHeight / 2, -roomDepth / 2)
  scene.add(backWall)

  // Left Wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat)
  leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0)
  leftWall.rotation.y = Math.PI / 2
  scene.add(leftWall)

  // Right Wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat)
  rightWall.position.set(roomWidth / 2, roomHeight / 2, 0)
  rightWall.rotation.y = -Math.PI / 2
  scene.add(rightWall)

  // 5. Add Artworks to Walls
  const textureLoader = new THREE.TextureLoader()
  
  // Example artwork placement function
  const addArtwork = (imageUrl, width, height, position, rotationY) => {
    textureLoader.load(imageUrl, (texture) => {
      const artGeo = new THREE.PlaneGeometry(width, height)
      const artMat = new THREE.MeshBasicMaterial({ map: texture })
      const artMesh = new THREE.Mesh(artGeo, artMat)
      
      // Add a simple frame border
      const frameGeo = new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.05)
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x332211 })
      const frameMesh = new THREE.Mesh(frameGeo, frameMat)
      frameMesh.position.z = -0.02
      
      const group = new THREE.Group()
      group.add(artMesh)
      group.add(frameMesh)
      
      group.position.copy(position)
      group.rotation.y = rotationY
      scene.add(group)
    })
  }

  // Place your pieces around the room walls (Replace with your actual hosted image URLs or assets)
  addArtwork('https://images.unsplash.com/photo-1579783900882-c0d3dad7b119', 3, 2, new THREE.Vector3(0, 1.8, -7.9), 0)
  addArtwork('https://images.unsplash.com/photo-1578926375605-eaf7559b1458', 3, 2, new THREE.Vector3(-7.9, 1.8, 0), Math.PI / 2)

  // 6. Event Listeners for Movement & Looking
  const onKeyDown = (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') moveForward = true
    if (e.code === 'KeyS' || e.code === 'ArrowDown') moveBackward = true
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveLeft = true
    if (e.code === 'KeyD' || e.code === 'ArrowRight') moveRight = true
  }

  const onKeyUp = (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') moveForward = false
    if (e.code === 'KeyS' || e.code === 'ArrowDown') moveBackward = false
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveLeft = false
    if (e.code === 'KeyD' || e.code === 'ArrowRight') moveRight = false
  }

  const onMouseMove = (e) => {
    // Only look around if mouse is clicked/dragged or pointer locked
    const movementX = e.movementX || 0
    const movementY = e.movementY || 0

    yaw -= movementX * 0.003
    pitch -= movementY * 0.003
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

    const direction = new THREE.Vector3()
    direction.x = Math.sin(yaw) * Math.cos(pitch)
    direction.y = Math.sin(pitch)
    direction.z = -Math.cos(yaw) * Math.cos(pitch)
    camera.lookAt(camera.position.clone().add(direction))
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvasContainer.value.addEventListener('click', () => {
    canvasContainer.value.requestPointerLock()
  })
  canvasContainer.value.addEventListener('mousemove', onMouseMove)

  // 7. Animation Loop (Handles Walking physics)
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)

    const speed = 0.05
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()

    const sideDir = new THREE.Vector3(-dir.z, 0, dir.x)

    if (moveForward) camera.position.addScaledVector(dir, speed)
    if (moveBackward) camera.position.addScaledVector(dir, -speed)
    if (moveRight) camera.position.addScaledVector(sideDir, speed)
    if (moveLeft) camera.position.addScaledVector(sideDir, -speed)

    // Keep camera inside room boundaries
    camera.position.x = Math.max(-7, Math.min(7, camera.position.x))
    camera.position.z = Math.max(-7, Math.min(7, camera.position.z))

    renderer.render(scene, camera)
  }
  animate()

  // Handle window resizing
  const handleResize = () => {
    if (!canvasContainer.value) return
    camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', () => {})
})
</script>

<style scoped>
.gallery-container {
  position: relative;
  width: 100%;
  height: 600px;
  overflow: hidden;
  border-radius: 8px;
  cursor: crosshair;
}

.controls-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 10px 16px;
  border-radius: 6px;
  font-family: sans-serif;
  font-size: 13px;
  pointer-events: none;
  z-index: 10;
}

.controls-overlay h3 {
  margin: 0 0 5px 0;
  font-size: 15px;
}
</style>