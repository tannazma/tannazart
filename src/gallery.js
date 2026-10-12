import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const artwork1 = './src/assets/arts/artwork1.webp'
const artwork2 = './src/assets/arts/artwork2.webp'
const artwork3 = './src/assets/arts/artwork3.webp'
const artwork4 = './src/assets/arts/artwork4.webp'
const artwork5 = './src/assets/arts/artwork5.webp'
const artwork6 = './src/assets/arts/artwork6.webp'
const artwork8 = './src/assets/arts/artwork8.webp'
const artwork9 = './src/assets/arts/artwork9.webp'
const artwork10 = './src/assets/arts/artwork10.webp'
const wallTextureImage = './src/assets/wall-texture.webp'
const floorTextureImage = './src/assets/floor-texture.webp'
const floorMedallionImage = './src/assets/floor-texture-2.webp'
const ceilingTextureImage = './src/assets/ceiling-texture.webp'

const moveHandToTarget = (root, joints, hand, target) => {
  for (let iteration = 0; iteration < 18; iteration += 1) {
    for (const joint of joints) {
      root.updateMatrixWorld(true)
      const jointPosition = joint.getWorldPosition(new THREE.Vector3())
      const handDirection = hand.getWorldPosition(new THREE.Vector3()).sub(jointPosition).normalize()
      const targetDirection = target.clone().sub(jointPosition).normalize()
      const rotationAxis = new THREE.Vector3().crossVectors(handDirection, targetDirection)
      if (rotationAxis.lengthSq() < 1e-8) continue

      const angle = Math.acos(THREE.MathUtils.clamp(handDirection.dot(targetDirection), -1, 1))
      const worldRotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis.normalize(), angle)
      const parentRotation = joint.parent.getWorldQuaternion(new THREE.Quaternion())
      const localRotation = parentRotation.clone().invert()
        .multiply(worldRotation)
        .multiply(parentRotation)
      joint.quaternion.premultiply(localRotation)
    }
  }
}

function mountGallery(container) {
  let camera
  let renderer
  let moveForward = false
  let moveBackward = false
  let moveLeft = false
  let moveRight = false
  let joystickX = 0
  let joystickY = 0
  let yaw = 0
  let pitch = 0
  let galleryEntered = false
  let lookPointerId = null
  let previousLookX = 0
  let previousLookY = 0
  let previousFrameTime = performance.now()
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
  player.position.set(-4, 0, 8)
  player.add(camera)
  scene.add(player)

  // 2. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.xr.enabled = true
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.pointerEvents = 'none'
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
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.54)
  scene.add(ambientLight)

  // 4. Build Room (Floor, Ceiling, Walls)
  const roomWidth = 20
  const roomHeight = 5
  const roomDepth = 24
  const loadingOverlay = document.querySelector('#loading-overlay')
  const loadingVisual = document.querySelector('#loading-visual')
  const loadingProgress = document.querySelector('#loading-progress')
  const loadingProgressFill = document.querySelector('#loading-progress-fill')
  const loadingProgressLabel = document.querySelector('#loading-progress-label')
  const loadingButton = document.querySelector('#loading-button')
  const controlsOverlay = document.querySelector('.controls-overlay')
  const updateLoadingProgress = (progress) => {
    const value = Math.round(Math.max(0, Math.min(progress, 100)))
    loadingProgress.setAttribute('aria-valuenow', value)
    loadingProgressFill.style.width = `${value}%`
    loadingProgressLabel.textContent = `${value}%`
  }
  let resolveEnvironmentLoad
  const environmentLoaded = new Promise((resolve) => {
    resolveEnvironmentLoad = resolve
  })
  const loadingManager = new THREE.LoadingManager()
  loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    updateLoadingProgress((itemsLoaded / itemsTotal) * 45)
  }
  loadingManager.onLoad = () => {
    updateLoadingProgress(45)
    resolveEnvironmentLoad()
  }
  loadingManager.onError = (url) => {
    console.error(`Could not load texture: ${url}`)
  }
  const textureLoader = new THREE.TextureLoader(loadingManager)
  const artworkTextureLoader = new THREE.TextureLoader()
  const roomSurfaceTint = 0xe0e0e0
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
      color: roomSurfaceTint,
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
    color: roomSurfaceTint,
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
      color: roomSurfaceTint,
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
      color: roomSurfaceTint,
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
      color: roomSurfaceTint,
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

  const exhibitCanvas = document.createElement('canvas')
  exhibitCanvas.width = 1600
  exhibitCanvas.height = 1450
  const exhibitContext = exhibitCanvas.getContext('2d')
  exhibitContext.fillStyle = '#181a19'
  exhibitContext.textAlign = 'left'
  exhibitContext.font = '20px sans-serif'
  exhibitContext.fillText('GALLERY EXHIBITION', 76, 112)
  exhibitContext.font = 'bold 94px sans-serif'
  exhibitContext.fillText('Tannaz', 76, 420)
  exhibitContext.fillText('Akbari', 76, 530)
  exhibitContext.font = '48px Georgia, serif'
  exhibitContext.font = '19px sans-serif'
  exhibitContext.fillText('My Virtual Experimental', 76, 770)
  exhibitContext.fillText('Art Gallery', 76, 801)

  exhibitContext.font = '19px sans-serif'
  exhibitContext.fillText('About me', 700, 150)
  exhibitContext.font = '42px Georgia, serif'
  exhibitContext.fillText('Combination of culture with art', 700, 225)

  const drawExhibitParagraph = (text, startY) => {
    exhibitContext.font = '27px sans-serif'
    const words = text.split(' ')
    const lines = []
    let line = ''

    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word
      if (exhibitContext.measureText(candidate).width > 820 && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    })
    if (line) lines.push(line)

    lines.forEach((textLine, index) => {
      exhibitContext.fillText(textLine, 700, startY + index * 40)
    })
    return startY + lines.length * 40 + 36
  }

  let exhibitTextY = drawExhibitParagraph(
    "I’m a developer who enjoys making art and crafts in my spare time. I’m still an amateur, learning as I go and trying different materials, including oil pastels, acrylic paint, and watercolors.",
    290
  )
  exhibitTextY = drawExhibitParagraph(
    'I’m also interested in using new technology to make useful tools for artists. My hope is to build a bridge between art and technology, creating simple things that make the creative process a little easier and leave artists more time to make',
    exhibitTextY
  )
  exhibitTextY = drawExhibitParagraph(
    'Enjoying the gallery? Explore more of my original artwork at tannazart.com, or visit my GitHub profile at github.com/tannazma to see more web and WebXR projects!',
    exhibitTextY
  )

  const exhibitTexture = new THREE.CanvasTexture(exhibitCanvas)
  exhibitTexture.colorSpace = THREE.SRGBColorSpace
  const exhibitPanel = new THREE.Group()
  const exhibitPoster = new THREE.Mesh(
    new THREE.PlaneGeometry(4.35, 3.92),
    new THREE.MeshBasicMaterial({ map: exhibitTexture, transparent: true, depthWrite: false })
  )
  exhibitPoster.position.z = 0.01
  exhibitPanel.add(exhibitPoster)
  const exhibitLineLight = new THREE.Mesh(
    new THREE.PlaneGeometry(4.15, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xffedc7, toneMapped: false })
  )
  exhibitLineLight.position.set(0, 2, -0.145)
  exhibitPanel.add(exhibitLineLight)
  exhibitPanel.position.set(-9.84, 1, 6)
  exhibitPanel.rotation.y = Math.PI / 2
  scene.add(exhibitPanel)

  const initialCameraPosition = player.localToWorld(camera.position.clone())
  const initialViewTarget = exhibitPanel.position.clone()
  initialViewTarget.y = 1
  const initialViewDirection = initialViewTarget.clone().sub(initialCameraPosition)
  yaw = Math.atan2(initialViewDirection.x, -initialViewDirection.z)
  pitch = Math.asin(initialViewDirection.y / initialViewDirection.length())
  camera.lookAt(initialViewTarget)

  const entranceCenterX = -2
  const entranceWidth = 2.6
  const entranceHeight = 2.8
  const entranceZ = roomDepth / 2
  const entranceLeft = entranceCenterX - entranceWidth / 2
  const entranceRight = entranceCenterX + entranceWidth / 2
  const addEntranceWallSection = (width, height, x, y) => {
    const section = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      createWallMaterial(width, height)
    )
    section.position.set(x, y, entranceZ)
    scene.add(section)
  }

  addEntranceWallSection(
    entranceLeft + roomWidth / 2,
    roomHeight,
    (-roomWidth / 2 + entranceLeft) / 2,
    roomHeight / 2
  )
  addEntranceWallSection(
    roomWidth / 2 - entranceRight,
    roomHeight,
    (entranceRight + roomWidth / 2) / 2,
    roomHeight / 2
  )
  addEntranceWallSection(
    entranceWidth,
    roomHeight - entranceHeight,
    entranceCenterX,
    (roomHeight + entranceHeight) / 2
  )


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
    if (!galleryEntered) return
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

  const addArtwork = (imageUrl, width, height, position, rotationY, title, medium) =>
    new Promise((resolve, reject) => {
      artworkTextureLoader.load(imageUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      const artGeo = new THREE.PlaneGeometry(width, height)
      const artMat = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.4,
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

      const lampFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0xf4f1e8,
        roughness: 0.32,
        metalness: -2
      })
      const lampLensMaterial = new THREE.MeshBasicMaterial({
        color: 0xffe8bd,
        toneMapped: false
      })
      const pictureLightRail = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(width * 0.68, 0.95), 0.045, 0.055),
        lampFrameMaterial
      )
      pictureLightRail.position.set(0, height / 2 + 0.38, 0.05)
      group.add(pictureLightRail)

      pictureLightOffsets.forEach((offset) => {
        const lightX = width * offset
        const lightTarget = new THREE.Object3D()
        lightTarget.position.set(lightX, 0, 0.02)
        group.add(lightTarget)

        const spotlightPosition = new THREE.Vector3(lightX, height / 2 + 0.18, 0.05)
        const beamDirection = lightTarget.position.clone().sub(spotlightPosition).normalize()

        const lampMount = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.08, 0.035),
          lampFrameMaterial
        )
        lampMount.position.set(lightX, height / 2 + 0.38, 0.05)
        group.add(lampMount)

        const lampBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.105, 0.16, 16),
          lampFrameMaterial
        )
        lampBody.position.copy(spotlightPosition).addScaledVector(beamDirection, -0.08)
        lampBody.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDirection)
        group.add(lampBody)

        const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.068, 16), lampLensMaterial)
        lampLens.position.copy(spotlightPosition).addScaledVector(beamDirection, 0.085)
        lampLens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), beamDirection)
        group.add(lampLens)

        const spotlight = new THREE.SpotLight(0xfff4df, 14, 9, Math.PI / 3, 0.8, 0.3)
        spotlight.position.copy(spotlightPosition)
        spotlight.target = lightTarget
        group.add(spotlight)
      })

      group.position.copy(position)
      group.rotation.y = rotationY
      scene.add(group)
      resolve()
      }, undefined, reject)
    })

  // Reuse the existing artwork files to fill the gallery layout.
  const dividerArtworkOffset = dividerThickness / 2 + 0.095
  const galleryArtworks = [
    // left divider
    [artwork4, 3.2, 3.2, new THREE.Vector3(-6.5, 2.25, dividerArtworkOffset), 0, 'Light in the dark', 'Acrylic paint on canvas | May 2026'],
    [artwork6, 3.2, 3.2, new THREE.Vector3(-6.5, 2.1, -dividerArtworkOffset), Math.PI, 'Are you pooping?', 'Oil pastels on paper | September 2026'],

    // Left wall
    [artwork2, 2.8, 4, new THREE.Vector3(-9.9, 2.3, -6), Math.PI / 2, 'The red lighthouse', 'Oil pastels on paper | September 2026'],

    // front wall
    [artwork1, 3.2, 3.2, new THREE.Vector3(-2, 2.1, -11.9), 0, 'Daisies flowers', 'Oil pastels on paper | August 2026'],
    [artwork9, 2.4, 3.4, new THREE.Vector3(4.4, 2.1, -11.9), 0, 'By the window', 'Watercolor on paper | September 2026'],

    // right wall
    [artwork3, 2.8, 4, new THREE.Vector3(9.9, 2.1, -6), -Math.PI / 2, 'Traditional Persian Tea', 'Oil pastels on paper | September 2026'],
    
    // right divider
    [artwork5, 3.2, 3.2, new THREE.Vector3(6.5, 2.1, dividerArtworkOffset), 0, 'Sun flowers vase', 'Acrylic paint on canvas | May 2026'],
    [artwork8, 2.4, 3.3, new THREE.Vector3(7, 2.5, -dividerArtworkOffset), Math.PI, 'Fried Egg in a pan', 'Oil pastels on paper | October 2026'],
    
    // First right wall
    [artwork10, 1.8, 2.8, new THREE.Vector3(9.9, 2.2, 6), -Math.PI / 2, 'Grandma\'s front door', 'Watercolor on paper | October 2026'],
  ]
  
  const visitorEntries = [
    { spot: { x: -8, z: -6, rotation: -Math.PI / 2 }, modelUrl: './src/assets/visitors/visitor1.glb' },
    { spot: { x: 4.4, z: -5.5, rotation: Math.PI }, modelUrl: './src/assets/visitors/visitor2.glb' },
    { spot: { x: 3.5, z: 5, rotation: Math.PI / 2 }, modelUrl: './src/assets/visitors/visitor3.glb' },
    { spot: { x: 4, z: -7, rotation: Math.PI / 2 }, modelUrl: './src/assets/visitors/visitor4.glb' },
    { spot: { x: 8, z: -4, rotation: 0 }, modelUrl: './src/assets/visitors/visitor5.glb' },
    { spot: { x: 4.2, z: -7, rotation: -Math.PI  }, modelUrl: './src/assets/visitors/visitor6.glb' },
    { spot: { x: -4.4, z: -1, rotation: Math.PI }, modelUrl: './src/assets/visitors/visitor3.glb' },
    { spot: { x: -5, z: -5.5, rotation: 0 }, modelUrl: './src/assets/visitors/visitor2.glb' },
  ]
  const galleryVisitors = []

  const visitorHeight = 1.7
  const loadVisitorModel = (modelUrl, spot) => new Promise((resolve, reject) => {
    const absoluteUrl = new URL(modelUrl, window.location.href).href
    const loader = new GLTFLoader(loadingManager)
    loader.load(
      absoluteUrl,
      (gltf) => {
        const visitor = gltf.scene
        if (modelUrl.endsWith('/visitor6.glb')) {
          const hips = visitor.getObjectByName('Hips')
          const arms = [
            ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
            ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
          ].map(([shoulderName, armName, forearmName, handName]) => ({
            shoulder: visitor.getObjectByName(shoulderName),
            arm: visitor.getObjectByName(armName),
            forearm: visitor.getObjectByName(forearmName),
            hand: visitor.getObjectByName(handName)
          }))

          if (hips && arms.every(({ shoulder, arm, forearm, hand }) => shoulder && arm && forearm && hand)) {
            visitor.updateMatrixWorld(true)
            const hipsPosition = hips.getWorldPosition(new THREE.Vector3())
            arms.forEach(({ shoulder, arm, forearm, hand }) => {
              const shoulderX = shoulder.getWorldPosition(new THREE.Vector3()).x
              const side = Math.sign(shoulderX - hipsPosition.x)
              const target = hipsPosition.clone().add(new THREE.Vector3(side * 0.14, 0.12, 0.1))
              moveHandToTarget(visitor, [forearm, arm, shoulder], hand, target)
            })
          }
        }

        const boundingBox = new THREE.Box3().setFromObject(visitor)
        const modelSize = new THREE.Vector3()
        boundingBox.getSize(modelSize)

        const scale = visitorHeight / Math.max(modelSize.y, 0.001)
        visitor.scale.setScalar(scale)

        visitor.position.set(spot.x, 0, spot.z)
        const scaledBox = new THREE.Box3().setFromObject(visitor)
        visitor.position.y -= scaledBox.min.y
        visitor.rotation.y = spot.rotation

        visitor.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false
            child.receiveShadow = false
          }
        })

        scene.add(visitor)
        resolve({
          group: visitor,
          head: visitor.userData?.head ?? null,
          idlePhase: Math.random() * Math.PI * 2,
          baseHeight: visitor.position.y
        })
      },
      undefined,
      (error) => {
        console.error(`Could not load visitor model: ${modelUrl}`, error)
        reject(error)
      }
    )
  })

  const visitorLoads = visitorEntries.map((entry) =>
    loadVisitorModel(entry.modelUrl, entry.spot)
      .then((visitor) => {
        galleryVisitors.push(visitor)
      })
      .catch((error) => {
        console.error(`Failed to add visitor at spot ${entry.spot.x}, ${entry.spot.z}`, error)
      })
  )

  const loadGalleryArtworks = async () => {
    await environmentLoaded
    await Promise.all(visitorLoads)
    for (let index = 0; index < galleryArtworks.length; index += 1) {
      const [image, width, height, position, rotationY, title, medium] = galleryArtworks[index]
      try {
        await addArtwork(image, width, height, position, rotationY, title, medium)
      } catch (error) {
        console.error(`Could not load artwork: ${title}`, error)
      }
      updateLoadingProgress(45 + ((index + 1) / galleryArtworks.length) * 55)
    }

    updateLoadingProgress(100)
    loadingVisual.hidden = true
    loadingButton.hidden = false
    loadingButton.disabled = false
    loadingButton.addEventListener('click', () => {
      galleryEntered = true
      moveForward = false
      moveBackward = false
      moveLeft = false
      moveRight = false
      renderer.domElement.style.pointerEvents = 'auto'
      renderer.domElement.style.touchAction = 'none'
      controlsOverlay.hidden = false
      loadingOverlay.remove()
    }, { once: true })
  }

  loadGalleryArtworks()

  // 6. Event Listeners for Movement & Looking
  const onKeyDown = (event) => {
    if (!galleryEntered) return
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

  const updateView = (movementX, movementY) => {
    yaw += movementX * 0.003
    pitch -= movementY * 0.003
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

    const direction = new THREE.Vector3()
    direction.x = Math.sin(yaw) * Math.cos(pitch)
    direction.y = Math.sin(pitch)
    direction.z = -Math.cos(yaw) * Math.cos(pitch)
    const cameraPosition = new THREE.Vector3()
    camera.getWorldPosition(cameraPosition)
    camera.lookAt(cameraPosition.add(direction))
  }

  const onMouseMove = (event) => {
    if (!galleryEntered) return
    updateView(event.movementX || 0, event.movementY || 0)
  }

  const mobileJoystick = container.querySelector('.mobile-joystick')
  const joystickKnob = mobileJoystick.querySelector('.mobile-joystick-knob')
  let joystickPointerId = null
  const updateJoystick = (event) => {
    const bounds = mobileJoystick.getBoundingClientRect()
    const maxTravel = (bounds.width - joystickKnob.offsetWidth) / 2
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const deltaX = event.clientX - centerX
    const deltaY = event.clientY - centerY
    const distance = Math.hypot(deltaX, deltaY)
    const scale = distance > maxTravel ? maxTravel / distance : 1
    const knobX = deltaX * scale
    const knobY = deltaY * scale
    joystickX = knobX / maxTravel
    joystickY = knobY / maxTravel
    joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`
  }
  const resetJoystick = () => {
    joystickPointerId = null
    joystickX = 0
    joystickY = 0
    joystickKnob.style.transform = 'translate(-50%, -50%)'
  }
  mobileJoystick.addEventListener('pointerdown', (event) => {
    if (joystickPointerId !== null) return
    event.preventDefault()
    joystickPointerId = event.pointerId
    mobileJoystick.setPointerCapture(event.pointerId)
    updateJoystick(event)
  }, listenerOptions)
  mobileJoystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === joystickPointerId) updateJoystick(event)
  }, listenerOptions)
  mobileJoystick.addEventListener('pointerup', (event) => {
    if (event.pointerId === joystickPointerId) resetJoystick()
  }, listenerOptions)
  mobileJoystick.addEventListener('pointercancel', resetJoystick, listenerOptions)
  mobileJoystick.addEventListener('lostpointercapture', resetJoystick, listenerOptions)

  container.addEventListener('pointerdown', (event) => {
    if (!galleryEntered || event.pointerType !== 'touch' || event.target.closest('.mobile-joystick')) return
    event.preventDefault()
    container.setPointerCapture(event.pointerId)
    lookPointerId = event.pointerId
    previousLookX = event.clientX
    previousLookY = event.clientY
  }, listenerOptions)
  container.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookPointerId) return
    event.preventDefault()
    updateView(event.clientX - previousLookX, event.clientY - previousLookY)
    previousLookX = event.clientX
    previousLookY = event.clientY
  }, listenerOptions)
  const stopLooking = (event) => {
    if (event.pointerId === lookPointerId) lookPointerId = null
  }
  container.addEventListener('pointerup', stopLooking, listenerOptions)
  container.addEventListener('pointercancel', stopLooking, listenerOptions)

  // One controller removes all input and resize listeners when the gallery unmounts.
  window.addEventListener('keydown', onKeyDown, listenerOptions)
  window.addEventListener('keyup', onKeyUp, listenerOptions)
  container.addEventListener('click', (event) => {
    if (galleryEntered && window.matchMedia('(pointer: fine)').matches) {
      container.requestPointerLock()
    }
  }, listenerOptions)
  document.addEventListener('mousemove', onMouseMove, listenerOptions)

  // 7. Animation Loop (Handles Walking physics)
  const animate = () => {
    const frameTime = performance.now()
    const deltaTime = Math.min((frameTime - previousFrameTime) / 1000, 0.05)
    previousFrameTime = frameTime
    const elapsedTime = frameTime * 0.001
    const speed = 3 * deltaTime
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    direction.y = 0
    direction.normalize()

    const sideDirection = new THREE.Vector3(-direction.z, 0, direction.x)
    const forwardAmount = Number(moveForward) - Number(moveBackward) - joystickY
    const sideAmount = Number(moveRight) - Number(moveLeft) + joystickX
    const movementLength = Math.min(1, Math.hypot(forwardAmount, sideAmount))
    if (movementLength > 0) {
      const movementDirection = direction.multiplyScalar(forwardAmount)
        .addScaledVector(sideDirection, sideAmount)
        .normalize()
      moveCamera(movementDirection, speed * movementLength)
    }

    // Use either Quest thumbstick for smooth locomotion in VR.
    if (galleryEntered) {
      xrControllers.forEach((controller) => {
        const gamepad = controller.userData.inputSource?.gamepad
        if (!gamepad || gamepad.axes.length < 4) return

        const stickX = Math.abs(gamepad.axes[2]) > 0.15 ? gamepad.axes[2] : 0
        const stickY = Math.abs(gamepad.axes[3]) > 0.15 ? gamepad.axes[3] : 0
        if (!stickX && !stickY) return

        const stickLength = Math.min(1, Math.hypot(stickX, stickY))
        const stickDirection = direction.clone().multiplyScalar(-stickY)
          .addScaledVector(sideDirection, stickX)
          .normalize()
        moveCamera(stickDirection, stickLength * speed)
      })
    }

    // Keep camera inside room boundaries
    player.position.x = Math.max(-9, Math.min(9, player.position.x))
    player.position.z = Math.max(-11, Math.min(11, player.position.z))

    galleryVisitors.forEach((visitor) => {
      visitor.group.position.y = visitor.baseHeight + Math.sin(elapsedTime + visitor.idlePhase) * 0.012
      if (visitor.head) {
        visitor.head.rotation.y = Math.sin(elapsedTime * 0.55 + visitor.idlePhase) * 0.06
      }
    })

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
