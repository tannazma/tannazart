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
import floorMedallionImage from '../../wall-texture-3.jpg'

const canvasContainer = ref(null)
let scene, camera, renderer, animationFrameId
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false
let prevMouseX = 0, prevMouseY = 0
let yaw = 0, pitch = 0

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

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight.position.set(0, 10, 5)
  scene.add(directionalLight)

  // 4. Build Room (Floor, Ceiling, Walls)
  const roomWidth = 20
  const roomHeight = 5
  const roomDepth = 24

  const textureLoader = new THREE.TextureLoader()
  const wallImageAspect = 5760 / 3840
  const wallTextureScale = 2
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
  floorMedallion.position.y = 0.02
  scene.add(floorMedallion)

  const medallionBorder = new THREE.Mesh(
    new THREE.RingGeometry(4.25, 4.38, 128),
    new THREE.MeshStandardMaterial({ color: 0xb39a6a, roughness: 0.62, metalness: 0.18 })
  )
  medallionBorder.rotation.x = -Math.PI / 2
  medallionBorder.position.y = 0.025
  scene.add(medallionBorder)

  // Soft acoustic ceiling panels and gallery track lighting.
  const ceilingTexture = createSurfaceTexture('#aaa69d', ['#f2efe8', '#eeebe4', '#f0ede6', '#eae7e0'])
  ceilingTexture.repeat.set(5, 6)
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshStandardMaterial({ map: ceilingTexture, roughness: 0.92, side: THREE.DoubleSide })
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = roomHeight
  scene.add(ceiling)

  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x383833, roughness: 0.38, metalness: 0.55 })
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0x514e47, roughness: 0.42, metalness: 0.4 })
  const trackPositions = [-8, 0, 8]
  const fixturePositions = [-6, -2, 2, 6]

  trackPositions.forEach((z) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(roomWidth - 1, 0.055, 0.08), trackMaterial)
    rail.position.set(0, roomHeight - 0.08, z)
    scene.add(rail)

    fixturePositions.forEach((x) => {
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 12), fixtureMaterial)
      fixture.position.set(x, roomHeight - 0.2, z)
      scene.add(fixture)

      const target = new THREE.Object3D()
      target.position.set(x, 0, z)
      scene.add(target)

      const spotlight = new THREE.SpotLight(0xffe8c8, 18, 11, Math.PI / 5, 0.7, 2)
      spotlight.position.set(x, roomHeight - 0.3, z)
      spotlight.target = target
      scene.add(spotlight)
    })
  })

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

  const rightDivider = new THREE.Mesh(
    dividerPanelGeo,
    createWallMaterial(7, roomHeight, true)
  )
  rightDivider.position.set(7, roomHeight / 2, 0)
  scene.add(rightDivider)

  // 5. Add Artworks to Walls
  // Example artwork placement function
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

        ;[-0.28, 0, 0.28].forEach((offset) => {
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

  // Reuse the existing artwork files to fill the larger gallery layout.
  const galleryArtworks = [
    // left divider
    [artwork3, 2.4, 2, new THREE.Vector3(-6.5, 1.8, 0.09), 0],
    [artwork2, 2, 3, new THREE.Vector3(-6.5, 1.8, -0.09), Math.PI],

    // left wal  
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
    // Only look around if mouse is clicked/dragged or pointer locked
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
    camera.position.x = Math.max(-9, Math.min(9, camera.position.x))
    camera.position.z = Math.max(-11, Math.min(11, camera.position.z))

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