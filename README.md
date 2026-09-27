# Virtual Art Gallery

An interactive 3D gallery built with Three.js. Three.js is loaded from jsDelivr, so an internet connection is required.

Because browsers block local images as WebGL textures from `file://` pages, serve this folder over HTTP with Python's built-in server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Use W, A, S, D or the arrow keys to move, and click the gallery to look around with the mouse.
