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
import artwork1 from '../assets/artwork1.jpg'
import artwork2 from '../assets/artwork2.jpg'
import artwork3 from '../assets/artwork3.jpg'
import wallTextureImage from '../../wall-texture-4.jpg'
import floorTextureImage from '../../floor-texture.jpg'
import floorMedallionImage from '../../floor-texture-2.jpg'
import dividerPatternImage from '../../wall-devider-texture.jpg'

const canvasContainer = ref(null)
let scene, camera, renderer, animationFrameId
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false
let yaw = 0, pitch = 0
let eventController

onMounted(() => {
  // 1. Scene & Camera Setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffffff)

  camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(0, 1.6, 8) // Eye level height

  // 2. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  canvasContainer.value.appendChild(renderer.domElement)

  // 3. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1)
  scene.add(ambientLight)

  // 4. Build Room (Floor, Ceiling, Walls)
  const roomWidth = 20
  const roomHeight = 5
  const roomDepth = 24

  const textureLoader = new THREE.TextureLoader()
  const wallImageAspect = 5760 / 3840
  const wallTextureScale = 2

  // Reuse the wall image while preserving its aspect ratio on each surface.
  const createWallMaterial = (surfaceWidth, surfaceHeight, doubleSided = false) => {
    const texture = textureLoader.load(wallTextureImage)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(
      (surfaceWidth / surfaceHeight / wallImageAspect) * wallTextureScale,
      wallTextureScale
    )

    return new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide
    })
  }

  // Generate a subtle repeating panel texture for the ceiling.
  const createSurfaceTexture = (baseColor, panelColors) => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')
    context.fillStyle = baseColor
    context.fillRect(0, 0, canvas.width, canvas.height)

    const panelSize = 128
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const color = panelColors[(row * 3 + column * 5) % panelColors.length]
        context.fillStyle = color
        context.fillRect(column * panelSize + 2, row * panelSize + 2, panelSize - 4, panelSize - 4)
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    return texture
  }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth)
  const floorTexture = textureLoader.load(floorTextureImage)
  floorTexture.colorSpace = THREE.SRGBColorSpace
  floorTexture.wrapS = THREE.RepeatWrapping
  floorTexture.wrapT = THREE.RepeatWrapping
  floorTexture.repeat.set(5, 6)
  floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const floorMat = new THREE.MeshBasicMaterial({
    map: floorTexture,
    toneMapped: false
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // Mark out the far room with a second floor texture and a narrow trim.
  const farRoomFloorZoneWidth = roomWidth - 2
  const farRoomFloorZoneDepth = roomDepth / 2 - 1
  const farRoomFloorTexture = floorTexture.clone()
  farRoomFloorTexture.repeat.set(4, 3)
  farRoomFloorTexture.needsUpdate = true
  const farRoomFloorZone = new THREE.Mesh(
    new THREE.PlaneGeometry(farRoomFloorZoneWidth, farRoomFloorZoneDepth),
    new THREE.MeshBasicMaterial({
      map: farRoomFloorTexture,
      toneMapped: false
    })
  )
  farRoomFloorZone.rotation.x = -Math.PI / 2
  farRoomFloorZone.position.set(0, 0.008, -roomDepth / 4)
  scene.add(farRoomFloorZone)

  const floorZoneTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x97805b,
    roughness: 0.62,
    metalness: 0.16
  })
  const floorZoneCenterZ = -roomDepth / 4
  const floorZoneTopTrim = new THREE.Mesh(
    new THREE.BoxGeometry(farRoomFloorZoneWidth, 0.025, 0.04),
    floorZoneTrimMaterial
  )
  floorZoneTopTrim.position.set(0, 0.018, floorZoneCenterZ - farRoomFloorZoneDepth / 2)
  scene.add(floorZoneTopTrim)
  const floorZoneBottomTrim = floorZoneTopTrim.clone()
  floorZoneBottomTrim.position.z = floorZoneCenterZ + farRoomFloorZoneDepth / 2
  scene.add(floorZoneBottomTrim)
  const floorZoneSideTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.025, farRoomFloorZoneDepth),
    floorZoneTrimMaterial
  )
  floorZoneSideTrim.position.set(-farRoomFloorZoneWidth / 2, 0.018, floorZoneCenterZ)
  scene.add(floorZoneSideTrim)
  const floorZoneRightTrim = floorZoneSideTrim.clone()
  floorZoneRightTrim.position.x = farRoomFloorZoneWidth / 2
  scene.add(floorZoneRightTrim)

  // Center the patterned medallion inside the far-room floor zone.
  const floorMedallionTexture = textureLoader.load(floorMedallionImage)
  floorMedallionTexture.colorSpace = THREE.SRGBColorSpace
  floorMedallionTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const floorMedallion = new THREE.Mesh(
    new THREE.CircleGeometry(4.25, 128),
    new THREE.MeshBasicMaterial({
      map: floorMedallionTexture,
      toneMapped: false
    })
  )
  floorMedallion.rotation.x = -Math.PI / 2 
  floorMedallion.position.set(0, 0.02, floorZoneCenterZ)
  scene.add(floorMedallion)

  const medallionBorder = new THREE.Mesh(
    new THREE.RingGeometry(4.25, 4.38, 128),
    new THREE.MeshStandardMaterial({ color: 0xb39a6a, roughness: 0.62, metalness: 0.18 })
  )
  medallionBorder.rotation.x = -Math.PI / 2
  medallionBorder.position.set(0, 0.025, floorZoneCenterZ)
  scene.add(medallionBorder)

  // Add acoustic ceiling panels.
  const ceilingTexture = createSurfaceTexture('#aaa69d', ['#f2efe8', '#eeebe4', '#f0ede6', '#eae7e0'])
  ceilingTexture.repeat.set(5, 6)
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshStandardMaterial({ map: ceilingTexture, roughness: 0.92, side: THREE.DoubleSide })
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = roomHeight
  scene.add(ceiling)

  // Back Wall
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomHeight),
    createWallMaterial(roomWidth, roomHeight)
  )
  backWall.position.set(0, roomHeight / 2, -roomDepth / 2)
  scene.add(backWall)

  // Left Wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomDepth, roomHeight),
    createWallMaterial(roomDepth, roomHeight)
  )
  leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0)
  leftWall.rotation.y = Math.PI / 2
  scene.add(leftWall)

  // Right Wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomDepth, roomHeight),
    createWallMaterial(roomDepth, roomHeight)
  )
  rightWall.position.set(roomWidth / 2, roomHeight / 2, 0)
  rightWall.rotation.y = -Math.PI / 2
  scene.add(rightWall)

  // Central divider creates two exhibition zones with a wide passage between them.
  const dividerPanelGeo = new THREE.PlaneGeometry(7, roomHeight)
  const leftDivider = new THREE.Mesh(
    dividerPanelGeo,
    createWallMaterial(7, roomHeight, true)
  )
  leftDivider.position.set(-6.5, roomHeight / 2, 0)
  scene.add(leftDivider)

  // Give the right divider its geometric pattern; keep the left divider in the wall finish.
  const dividerPatternTexture = textureLoader.load(dividerPatternImage)
  dividerPatternTexture.colorSpace = THREE.SRGBColorSpace
  dividerPatternTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const dividerPatternMaterial = new THREE.MeshBasicMaterial({
    map: dividerPatternTexture,
    toneMapped: false,
    side: THREE.DoubleSide
  })
  const rightDivider = new THREE.Mesh(
    dividerPanelGeo,
    dividerPatternMaterial
  )
  rightDivider.position.set(6.5, roomHeight / 2, 0)
  scene.add(rightDivider)

  // 5. Add Artworks to Walls
  // Load each artwork with a frame and three aligned picture lights.
  const pictureLightOffsets = [-0.28, 0, 0.28]
  const addArtwork = (imageUrl, width, height, position, rotationY) => {
    textureLoader.load(imageUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        const artGeo = new THREE.PlaneGeometry(width, height)
        const artMat = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveMap: texture,
          emissiveIntensity: 0.35,
          roughness: 0.9,
          metalness: 0,
          toneMapped: false
        })
        const artMesh = new THREE.Mesh(artGeo, artMat)
        
        // Add a simple frame border
        const frameGeo = new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.05)
        const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
        const frameMesh = new THREE.Mesh(frameGeo, frameMat)
        // Keep the solid frame behind the artwork so it does not cover it.
        frameMesh.position.z = -0.06
        
        const group = new THREE.Group()
        group.add(artMesh)
        group.add(frameMesh)

        const pictureLightMaterial = new THREE.MeshBasicMaterial({ color: 0x88734e })
        const pictureLight = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(width * 0.7, 1.4), 0.06, 0.12),
          pictureLightMaterial
        )
        pictureLight.position.set(0, height / 2 + 0.14, 0.12)
        group.add(pictureLight)

        pictureLightOffsets.forEach((offset) => {
          const lightX = width * offset
          const lightHead = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.06, 0.12, 12),
            pictureLightMaterial
          )
          lightHead.position.set(lightX, height / 2 + 0.08, 0.12)
          group.add(lightHead)

          const lightTarget = new THREE.Object3D()
          lightTarget.position.set(lightX, 0, 0.02)
          group.add(lightTarget)

          const spotlight = new THREE.SpotLight(0xfff0d8, 3, 5, Math.PI / 6, 0.85, 2)
          spotlight.position.set(lightX, height / 2 + 0.22, 0.48)
          spotlight.target = lightTarget
          group.add(spotlight)
        })
        
        group.position.copy(position)
        group.rotation.y = rotationY
        scene.add(group)
    })
  }

  // Reuse the existing artwork files to fill the gallery layout.
  const galleryArtworks = [
    // left divider
    [artwork3, 2.4, 2, new THREE.Vector3(-6.5, 1.8, 0.09), 0],
    [artwork2, 2, 3, new THREE.Vector3(-6.5, 1.8, -0.09), Math.PI],

    // Left wall
    [artwork2, 2, 3, new THREE.Vector3(-9.9, 1.8, -7), Math.PI / 2],
    [artwork3, 2.4, 2, new THREE.Vector3(-9.9, 1.8, -2), Math.PI / 2],
    
    // front wall
    [artwork1, 2.4, 2, new THREE.Vector3(-6, 1.8, -11.9), 0],
    [artwork2, 2, 3, new THREE.Vector3(-2, 1.8, -11.9), 0],
    [artwork3, 2.4, 2, new THREE.Vector3(2, 1.8, -11.9), 0],
    [artwork1, 2.4, 2, new THREE.Vector3(6, 1.8, -11.9), 0],
    
    // right wall
    [artwork1, 2.4, 2, new THREE.Vector3(9.9, 1.8, -7), -Math.PI / 2],
    [artwork2, 2, 3, new THREE.Vector3(9.9, 1.8, -2), -Math.PI / 2],


    // right divider
    [artwork1, 2.4, 2, new THREE.Vector3(6.5, 1.8, 0.09), 0],
    [artwork3, 2.4, 2, new THREE.Vector3(6.5, 1.8, -0.09), Math.PI]
  ]

  galleryArtworks.forEach(([image, width, height, position, rotationY]) => {
    addArtwork(image, width, height, position, rotationY)
  })

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
    const movementX = e.movementX || 0
    const movementY = e.movementY || 0

    yaw += movementX * 0.003
    pitch -= movementY * 0.003
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

    const direction = new THREE.Vector3()
    direction.x = Math.sin(yaw) * Math.cos(pitch)
    direction.y = Math.sin(pitch)
    direction.z = -Math.cos(yaw) * Math.cos(pitch)
    camera.lookAt(camera.position.clone().add(direction))
  }

  // One controller removes all input and resize listeners when the component unmounts.
  eventController = new AbortController()
  const listenerOptions = { signal: eventController.signal }
  window.addEventListener('keydown', onKeyDown, listenerOptions)
  window.addEventListener('keyup', onKeyUp, listenerOptions)
  canvasContainer.value.addEventListener('click', () => {
    canvasContainer.value.requestPointerLock()
  }, listenerOptions)
  canvasContainer.value.addEventListener('mousemove', onMouseMove, listenerOptions)

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
    camera.position.x = Math.max(-9, Math.min(9, camera.position.x))
    camera.position.z = Math.max(-11, Math.min(11, camera.position.z))

    renderer.render(scene, camera)
  }
  animate()

  // Keep the camera projection matched to the gallery container.
  const handleResize = () => {
    if (!canvasContainer.value) return
    camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }
  window.addEventListener('resize', handleResize, listenerOptions)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId)
  eventController?.abort()
  renderer?.dispose()
  renderer?.domElement.remove()
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