export function buildSphereMesh(longitudeSegments = 128, latitudeSegments = 64) {
  const vertices = [];
  const indices = [];

  for (let row = 0; row <= latitudeSegments; row += 1) {
    const v = row / latitudeSegments;
    const lat = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let col = 0; col <= longitudeSegments; col += 1) {
      const u = col / longitudeSegments;
      const lon = (u - 0.5) * Math.PI * 2;
      vertices.push(
        Math.sin(lon) * cosLat,
        sinLat,
        -Math.cos(lon) * cosLat,
        u,
        v,
      );
    }
  }

  const stride = longitudeSegments + 1;
  for (let row = 0; row < latitudeSegments; row += 1) {
    for (let col = 0; col < longitudeSegments; col += 1) {
      const a = row * stride + col;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, c, b, c, d, b);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    vertexCount: (longitudeSegments + 1) * (latitudeSegments + 1),
    triangleCount: longitudeSegments * latitudeSegments * 2,
  };
}

export class GlobeWebGLRenderer {
  constructor(canvas, textureUrl, onReady = null) {
    this.canvas = canvas;
    this.textureUrl = textureUrl;
    this.onReady = onReady;
    this.gl = canvas?.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      depth: true,
    }) || canvas?.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      depth: true,
    });
    this.available = Boolean(this.gl);
    this.ready = false;

    if (!this.available) return;

    try {
      this.initialize();
      this.loadTexture();
    } catch (error) {
      console.error('WebGL globe initialization failed', error);
      this.available = false;
    }
  }

  initialize() {
    const gl = this.gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.locations = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      uv: gl.getAttribLocation(this.program, 'aUv'),
      radius: gl.getUniformLocation(this.program, 'uRadius'),
      yaw: gl.getUniformLocation(this.program, 'uYaw'),
      pitch: gl.getUniformLocation(this.program, 'uPitch'),
      focal: gl.getUniformLocation(this.program, 'uFocal'),
      centerZ: gl.getUniformLocation(this.program, 'uCenterZ'),
      cx: gl.getUniformLocation(this.program, 'uCx'),
      cy: gl.getUniformLocation(this.program, 'uCy'),
      viewport: gl.getUniformLocation(this.program, 'uViewport'),
      nearDepth: gl.getUniformLocation(this.program, 'uNearDepth'),
      farDepth: gl.getUniformLocation(this.program, 'uFarDepth'),
      atlas: gl.getUniformLocation(this.program, 'uAtlas'),
    };

    const mesh = buildSphereMesh();
    this.indexCount = mesh.indices.length;

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([222, 196, 141, 255]),
    );

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    // This application camera looks down +Z. Outward-facing sphere triangles
    // therefore appear clockwise in window coordinates.
    gl.frontFace(gl.CW);
  }

  loadTexture() {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => {
      if (!this.available) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.ready = true;
      this.onReady?.();
    }, { once: true });
    image.addEventListener('error', () => {
      console.error('Antique atlas texture failed to load', this.textureUrl);
    }, { once: true });
    image.src = this.textureUrl;
    this.image = image;
  }

  resize(cssWidth, cssHeight, dpr) {
    if (!this.canvas) return;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  render(camera, yaw, pitch, radius) {
    if (!this.available) return false;
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!width || !height) return false;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.locations.uv);
    gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);

    const dpr = camera.dpr || 1;
    const focal = camera.focal * dpr;
    const cx = camera.cx * dpr;
    const cy = camera.cy * dpr;
    const nearDepth = Math.max(0.05, camera.centerZ - radius - 0.5);
    const farDepth = camera.centerZ + radius + 0.5;

    gl.uniform1f(this.locations.radius, radius);
    gl.uniform1f(this.locations.yaw, yaw);
    gl.uniform1f(this.locations.pitch, pitch);
    gl.uniform1f(this.locations.focal, focal);
    gl.uniform1f(this.locations.centerZ, camera.centerZ);
    gl.uniform1f(this.locations.cx, cx);
    gl.uniform1f(this.locations.cy, cy);
    gl.uniform2f(this.locations.viewport, width, height);
    gl.uniform1f(this.locations.nearDepth, nearDepth);
    gl.uniform1f(this.locations.farDepth, farDepth);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.locations.atlas, 0);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    return this.ready;
  }
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || 'Unable to compile WebGL shader');
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || 'Unable to link WebGL program');
  }
  return program;
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aUv;

uniform float uRadius;
uniform float uYaw;
uniform float uPitch;
uniform float uFocal;
uniform float uCenterZ;
uniform float uCx;
uniform float uCy;
uniform vec2 uViewport;
uniform float uNearDepth;
uniform float uFarDepth;

varying vec2 vUv;
varying vec3 vNormal;

vec3 rotateSphere(vec3 p) {
  float cy = cos(uYaw);
  float sy = sin(uYaw);
  float cp = cos(uPitch);
  float sp = sin(uPitch);
  float x1 = cy * p.x + sy * p.z;
  float z1 = -sy * p.x + cy * p.z;
  return vec3(
    x1,
    cp * p.y - sp * z1,
    sp * p.y + cp * z1
  );
}

void main() {
  vec3 normal = rotateSphere(aPosition);
  vec3 world = normal * uRadius;
  float depth = uCenterZ + world.z;
  float screenX = uCx + world.x * uFocal / depth;
  float screenY = uCy - world.y * uFocal / depth;
  float ndcX = screenX / (uViewport.x * 0.5) - 1.0;
  float ndcY = 1.0 - screenY / (uViewport.y * 0.5);
  float ndcZ = clamp((depth - uNearDepth) / (uFarDepth - uNearDepth), 0.0, 1.0) * 2.0 - 1.0;

  gl_Position = vec4(ndcX * depth, ndcY * depth, ndcZ * depth, depth);
  vUv = aUv;
  vNormal = normal;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 color = texture2D(uAtlas, vUv);
  float facing = clamp(-vNormal.z, 0.0, 1.0);
  float shade = 0.74 + 0.26 * pow(facing, 0.42);
  color.rgb *= shade;
  gl_FragColor = vec4(color.rgb, color.a);
}
`;
