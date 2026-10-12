# Virtual Art Gallery

An interactive 3D gallery built with Three.js to showcase Tannaz Akbari's original artwork. Explore a virtual exhibition space, view paintings with their titles and mediums, and visit the About Me display.

The gallery supports desktop navigation with keyboard and mouse controls. It also offers immersive VR through WebXR when the browser and headset support it.

## Run locally

Three.js is loaded from jsDelivr, so an internet connection is required. Because browsers block local images as WebGL textures from `file://` pages, serve this folder over HTTP with Python's built-in server:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Controls

- **W, A, S, D** or **arrow keys**: move around the gallery
- **Mouse**: click the gallery and move the mouse to look around
- **VR headset**: when available, use the on-page VR button to enter; use the controller thumbsticks to move
