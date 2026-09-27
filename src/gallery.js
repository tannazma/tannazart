import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js'
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/webxr/VRButton.js'

const artwork1 = './src/assets/arts/artwork1.jpg'
const artwork2 = './src/assets/arts/artwork2.jpg'
const artwork3 = './src/assets/arts/artwork3.jpg'
const artwork4 = './src/assets/arts/artwork4.jpeg'
const artwork5 = './src/assets/arts/artwork5.png'
const artwork6 = './src/assets/arts/artwork6.jpeg'
const artwork7 = './src/assets/arts/artwork7.jpeg'
const wallTextureImage = './src/assets/wall-texture-4.jpg'
const floorTextureImage = './src/assets/floor-texture.jpg'
const floorMedallionImage = './src/assets/floor-texture-2.jpg'
const ceilingTextureImage = './src/assets/ceiling-texture.jpg'

function mountGallery(container) {
  let camera
  let renderer
  let moveForward = false
  let moveBackward = false
  let moveLeft = false
  let moveRight = false
  let yaw = 0
  let pitch = 0
  const eventController = new AbortController()
  const listenerOptions = { signal: eventController.signal }

  // 1. Scene & Camera Setup
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffffff)

  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  )
  camera.position.set(0, 1.6, 0) // Eye level height
  const player = new THREE.Group()
  player.position.set(0, 0, 8)
  player.add(camera)
  scene.add(player)

  // 2. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.xr.enabled = true
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  const vrButton = VRButton.createButton(renderer)
  document.body.appendChild(vrButton)

  const xrControllers = [renderer.xr.getController(0), renderer.xr.getController(1)]
  xrControllers.forEach((controller) => {
    controller.addEventListener('connected', (event) => {
      controller.userData.inputSource = event.data
    })
    controller.addEventListener('disconnected', () => {
      controller.userData.inputSource = null
    })
    scene.add(controller)
  })

  // 3. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1)
  scene.add(ambientLight)

  // 4. Build Room (Floor, Ceiling, Walls)
  const roomWidth = 20
  const roomHeight = 5
  const roomDepth = 24
  const loadingOverlay = document.querySelector('#loading-overlay')
  const loadingButton = document.querySelector('#loading-button')
  const loadingManager = new THREE.LoadingManager()
  loadingManager.onLoad = () => {
    loadingButton.textContent = 'Enter Gallery'
    loadingButton.disabled = false
    loadingButton.style.cursor = 'pointer'
    loadingButton.addEventListener('click', () => loadingOverlay.remove(), { once: true })
  }
  loadingManager.onError = () => {
    loadingButton.textContent = 'Some artwork could not load'
    loadingButton.disabled = true
  }
  const textureLoader = new THREE.TextureLoader(loadingManager)
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
  const farRoomFloorTexture = textureLoader.load(floorTextureImage)
  farRoomFloorTexture.colorSpace = THREE.SRGBColorSpace
  farRoomFloorTexture.wrapS = THREE.RepeatWrapping
  farRoomFloorTexture.wrapT = THREE.RepeatWrapping
  farRoomFloorTexture.repeat.set(4, 3)
  farRoomFloorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
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

  // Tile the architectural image across the ceiling without stretching each copy.
  const ceilingTexture = textureLoader.load(ceilingTextureImage)
  ceilingTexture.colorSpace = THREE.SRGBColorSpace
  ceilingTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const ceilingImageAspect = 4193 / 3145
  const ceilingSurfaceAspect = roomWidth / roomDepth
  const ceilingTileCountDepth = 4
  const ceilingTileCountWidth = ceilingSurfaceAspect / ceilingImageAspect * ceilingTileCountDepth
  ceilingTexture.wrapS = THREE.RepeatWrapping
  ceilingTexture.wrapT = THREE.RepeatWrapping
  ceilingTexture.repeat.set(ceilingTileCountWidth, ceilingTileCountDepth)
  ceilingTexture.offset.set((1 - ceilingTileCountWidth) / 2, 0)

  // Map the architectural image onto a flat ceiling.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshBasicMaterial({
      map: ceilingTexture,
      toneMapped: false,
      side: THREE.DoubleSide
    })
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
  const dividerThickness = 0.25
  const dividerPanelGeo = new THREE.BoxGeometry(7, roomHeight, dividerThickness)
  const dividerTexture = textureLoader.load(wallTextureImage)
  dividerTexture.colorSpace = THREE.SRGBColorSpace
  const dividerEdgeMaterial = new THREE.MeshBasicMaterial({
    map: dividerTexture,
    toneMapped: false
  })
  const createDividerMaterials = (faceMaterial) => [
    dividerEdgeMaterial,
    dividerEdgeMaterial,
    dividerEdgeMaterial,
    dividerEdgeMaterial,
    faceMaterial,
    faceMaterial
  ]

  const leftDivider = new THREE.Mesh(
    dividerPanelGeo,
    createDividerMaterials(createWallMaterial(7, roomHeight, true))
  )
  leftDivider.position.set(-6.5, roomHeight / 2, 0)
  scene.add(leftDivider)

  // Keep both dividers in the same wall finish.
  const rightDivider = new THREE.Mesh(
    dividerPanelGeo,
    createDividerMaterials(createWallMaterial(7, roomHeight, true))
  )
  rightDivider.position.set(6.5, roomHeight / 2, 0)
  scene.add(rightDivider)

  const dividerCollisionBounds = [leftDivider, rightDivider].map((divider) =>
    new THREE.Box3().setFromObject(divider).expandByScalar(0.35)
  )
  const moveCamera = (direction, distance) => {
    const destination = player.position.clone().addScaledVector(direction, distance)
    const collidesWithDivider = dividerCollisionBounds.some((bounds) => bounds.containsPoint(destination))
    if (!collidesWithDivider) player.position.copy(destination)
  }

  // 5. Add Artworks to Walls
  // Load each artwork with a frame and three aligned picture lights.
  const pictureLightOffsets = [-0.28, 0, 0.28]
  const descriptionWidth = 0.8
  const descriptionHeight = 1.35
  const descriptionGap = 0.2
  const createDescriptionMaterial = (title, medium) => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 540
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#c8c8c8'
    context.lineWidth = 5
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
    const wrapText = (text, maxWidth) => {
      const words = text.split(' ')
      const lines = []
      let line = ''
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word
        if (context.measureText(candidate).width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = candidate
        }
      })
      if (line) lines.push(line)
      return lines
    }

    context.fillStyle = '#141414'
    context.font = 'bold 27px Georgia'
    wrapText(title.toUpperCase(), 250).forEach((line, index) => {
      context.fillText(line, 32, 78 + index * 38)
    })
    context.fillStyle = '#404040'
    context.font = '23px Georgia'
    wrapText(medium, 250).forEach((line, index) => {
      context.fillText(line, 32, 190 + index * 32)
    })
    context.fillStyle = '#313231'
    context.font = '18px Georgia'
    context.fillText('Tannaz Akbari', 32, 455)
    context.fillText('https://tannazart.com', 32, 480)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  }

  const addArtwork = (imageUrl, width, height, position, rotationY, title, medium) => {
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

      const description = new THREE.Mesh(
        new THREE.PlaneGeometry(descriptionWidth, descriptionHeight),
        createDescriptionMaterial(title, medium)
      )
      const artworkFrameRightEdge = (width + 0.2) / 2
      description.position.set(
        artworkFrameRightEdge + descriptionGap + descriptionWidth / 2,
        -0.08,
        0.03
      )
      group.add(description)

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
  const dividerArtworkOffset = dividerThickness / 2 + 0.095
  const galleryArtworks = [
    // left divider
    [artwork4, 3.2, 3.2, new THREE.Vector3(-6.5, 2.25, dividerArtworkOffset), 0, 'Light in the dark', 'Acrylic paint on canvas'],
    [artwork6, 3.2, 3.2, new THREE.Vector3(-6.5, 2.1, -dividerArtworkOffset), Math.PI, 'Are you pooping?', 'Oil pastels on paper'],

    // Left wall
    [artwork2, 2.8, 4, new THREE.Vector3(-9.9, 2.3, -6), Math.PI / 2, 'The red lighthouse', 'Oil pastels on paper'],

    // front wall
    [artwork1, 3.2, 3.2, new THREE.Vector3(0, 2.1, -11.9), 0, 'Daisies flowers', 'Oil pastels on paper'],

    // right wall
    [artwork3, 2.8, 4, new THREE.Vector3(9.9, 2.1, -6), -Math.PI / 2, 'Traditional Persian Tea', 'Oil pastels on paper'],

    // right divider
    [artwork5, 3.2, 3.2, new THREE.Vector3(6.5, 2.1, dividerArtworkOffset), 0, 'Sun flowers vase', 'Acrylic paint on canvas'],
    [artwork7, 1.4, 2.15, new THREE.Vector3(6.5, 2.5, -dividerArtworkOffset), Math.PI, 'Customized Door hanging', 'made by air dry clay and acrylic paints']
  ]

  galleryArtworks.forEach(([image, width, height, position, rotationY, title, medium]) => {
    addArtwork(image, width, height, position, rotationY, title, medium)
  })

  // 6. Event Listeners for Movement & Looking
  const onKeyDown = (event) => {
    if (event.code === 'KeyW' || event.code === 'ArrowUp') moveForward = true
    if (event.code === 'KeyS' || event.code === 'ArrowDown') moveBackward = true
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') moveLeft = true
    if (event.code === 'KeyD' || event.code === 'ArrowRight') moveRight = true
  }

  const onKeyUp = (event) => {
    if (event.code === 'KeyW' || event.code === 'ArrowUp') moveForward = false
    if (event.code === 'KeyS' || event.code === 'ArrowDown') moveBackward = false
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') moveLeft = false
    if (event.code === 'KeyD' || event.code === 'ArrowRight') moveRight = false
  }

  const onMouseMove = (event) => {
    const movementX = event.movementX || 0
    const movementY = event.movementY || 0

    yaw += movementX * 0.003
    pitch -= movementY * 0.003
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

    const direction = new THREE.Vector3()
    direction.x = Math.sin(yaw) * Math.cos(pitch)
    direction.y = Math.sin(pitch)
    direction.z = -Math.cos(yaw) * Math.cos(pitch)
    camera.lookAt(camera.position.clone().add(direction))
  }

  // One controller removes all input and resize listeners when the gallery unmounts.
  window.addEventListener('keydown', onKeyDown, listenerOptions)
  window.addEventListener('keyup', onKeyUp, listenerOptions)
  container.addEventListener('click', () => {
    container.requestPointerLock()
  }, listenerOptions)
  container.addEventListener('mousemove', onMouseMove, listenerOptions)

  // 7. Animation Loop (Handles Walking physics)
  const animate = () => {
    const speed = 0.05
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    direction.y = 0
    direction.normalize()

    const sideDirection = new THREE.Vector3(-direction.z, 0, direction.x)

    if (moveForward) moveCamera(direction, speed)
    if (moveBackward) moveCamera(direction, -speed)
    if (moveRight) moveCamera(sideDirection, speed)
    if (moveLeft) moveCamera(sideDirection, -speed)

    // Use either Quest thumbstick for smooth locomotion in VR.
    xrControllers.forEach((controller) => {
      const gamepad = controller.userData.inputSource?.gamepad
      if (!gamepad || gamepad.axes.length < 4) return

      const stickX = Math.abs(gamepad.axes[2]) > 0.15 ? gamepad.axes[2] : 0
      const stickY = Math.abs(gamepad.axes[3]) > 0.15 ? gamepad.axes[3] : 0
      if (!stickX && !stickY) return

      moveCamera(direction, -stickY * speed)
      moveCamera(sideDirection, stickX * speed)
    })

    // Keep camera inside room boundaries
    player.position.x = Math.max(-9, Math.min(9, player.position.x))
    player.position.z = Math.max(-11, Math.min(11, player.position.z))

    renderer.render(scene, camera)
  }
  renderer.setAnimationLoop(animate)

  // Keep the camera projection matched to the gallery container.
  const handleResize = () => {
    if (!container) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', handleResize, listenerOptions)

  return () => {
    renderer.setAnimationLoop(null)
    eventController.abort()
    vrButton.remove()
    xrControllers.forEach((controller) => scene.remove(controller))
    renderer.dispose()
    renderer.domElement.remove()
  }
}

const galleryContainer = document.querySelector('.gallery-container')
if (!galleryContainer) throw new Error('Gallery container not found')
if (!THREE) throw new Error('Three.js failed to load from its CDN')
mountGallery(galleryContainer)
