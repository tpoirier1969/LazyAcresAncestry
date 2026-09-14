import {
  ATLAS_HOME_ANCHOR,
  ATLAS_RELIEF_TEXTURE_FALLBACK_URL,
  ATLAS_RELIEF_TEXTURE_URL,
} from './atlas-map.js';

export const ATLAS_FLIP_Y = false;

export function atlasPointToLocal(longitudeDeg, latitudeDeg, anchor = ATLAS_HOME_ANCHOR) {
  const lon = longitudeDeg * Math.PI / 180;
  const lat = latitudeDeg * Math.PI / 180;
  const cosLat = Math.cos(lat);
  const point = {
    x: Math.sin(lon) * cosLat,
    y: Math.sin(lat),
    z: -Math.cos(lon) * cosLat,
  };

  const yaw = anchor.longitude * Math.PI / 180;
  const pitch = -anchor.latitude * Math.PI / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = cy * point.x + sy * point.z;
  const z1 = -sy * point.x + cy * point.z;

  return {
    x: x1,
    y: cp * point.y - sp * z1,
    z: sp * point.y + cp * z1,
  };
}

export function buildSphereMesh(longitudeSegments = 256, latitudeSegments = 128) {
  const vertices = [];
  const indices = [];

  for (let row = 0; row <= latitudeSegments; row += 1) {
    const v = row / latitudeSegments;
    const latitudeDeg = 90 - v * 180;

    for (let col = 0; col <= longitudeSegments; col += 1) {
      const u = col / longitudeSegments;
      const longitudeDeg = u * 360 - 180;
      const local = atlasPointToLocal(longitudeDeg, latitudeDeg);
      vertices.push(local.x, local.y, local.z, u, v);
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
    this.atlasSize = { width: 4424, height: 2214 };
    this.reliefSize = { width: 8192, height: 4096 };

    if (!this.available) return;

    try {
      this.initialize();
      this.loadTexture();
      this.loadDetailTexture();
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
      relief: gl.getUniformLocation(this.program, 'uRelief'),
      labels: gl.getUniformLocation(this.program, 'uLabels'),
      atlasTexel: gl.getUniformLocation(this.program, 'uAtlasTexel'),
      reliefTexel: gl.getUniformLocation(this.program, 'uReliefTexel'),
    };

    const mesh = buildSphereMesh();
    this.indexCount = mesh.indices.length;

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    this.texture = createSolidTexture(gl, [222, 196, 141, 255]);
    this.reliefTexture = createSolidTexture(gl, [128, 128, 128, 255]);
    this.labelTexture = createLabelTexture(gl);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CW);
  }

  loadTexture() {
    this.loadImageIntoTexture(this.texture, this.textureUrl, {
      name: 'Atlas base texture',
      onLoad: image => {
        this.atlasSize = imageSize(image, this.atlasSize);
        this.ready = true;
        this.onReady?.();
      },
    });
  }

  loadDetailTexture() {
    const gl = this.gl;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const reliefUrl = maxTextureSize >= 8192
      ? ATLAS_RELIEF_TEXTURE_URL
      : ATLAS_RELIEF_TEXTURE_FALLBACK_URL;

    this.loadImageIntoTexture(this.reliefTexture, reliefUrl, {
      name: 'Atlas high-resolution detail texture',
      onLoad: image => {
        this.reliefSize = imageSize(image, this.reliefSize);
        this.onReady?.();
      },
    });
  }

  loadImageIntoTexture(texture, url, { name = 'Atlas texture', onLoad = null } = {}) {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', () => {
      if (!this.available) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, ATLAS_FLIP_Y);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      configureTextureQuality(gl, image);
      onLoad?.(image);
    }, { once: true });
    image.addEventListener('error', () => {
      console.error(`${name} failed to load`, url);
    }, { once: true });
    image.src = url;
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
    gl.uniform2f(
      this.locations.atlasTexel,
      1 / Math.max(1, this.atlasSize.width),
      1 / Math.max(1, this.atlasSize.height),
    );
    gl.uniform2f(
      this.locations.reliefTexel,
      1 / Math.max(1, this.reliefSize.width),
      1 / Math.max(1, this.reliefSize.height),
    );

    bindTexture(gl, this.texture, 0, this.locations.atlas);
    bindTexture(gl, this.reliefTexture, 1, this.locations.relief);
    bindTexture(gl, this.labelTexture, 2, this.locations.labels);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    return this.ready;
  }
}

function imageSize(image, fallback) {
  return {
    width: image.naturalWidth || image.width || fallback.width,
    height: image.naturalHeight || image.height || fallback.height,
  };
}

function createSolidTexture(gl, rgba) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
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
    new Uint8Array(rgba),
  );
  return texture;
}

function createLabelTexture(gl) {
  const canvas = createAtlasLabelCanvas();
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, ATLAS_FLIP_Y);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  configureTextureQuality(gl, canvas);
  return texture;
}

function createAtlasLabelCanvas(width = 4096, height = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Labels are deliberately sparse and quiet. They should feel hand-lettered
  // into the parchment, not behave like a modern political-map overlay.
  const labels = [
    ['Mare Atlanticum', -35, 30, 30],
    ['Mare Pacificum', -148, 8, 27],
    ['Mare Indicum', 78, -23, 25],
    ['Lacus Superior', -87.5, 48.0, 18],
    ['Occidens', -118, 3, 21],
    ['Oriens', 108, 5, 21],
  ];

  labels.forEach(([text, longitude, latitude, size]) => {
    const x = ((longitude + 180) / 360) * width;
    const y = ((90 - latitude) / 180) * height;
    ctx.font = `italic 500 ${size}px "Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive`;
    ctx.fillStyle = 'rgba(62,42,28,.42)';
    ctx.fillText(text, x, y);
  });

  return canvas;
}

function bindTexture(gl, texture, unit, uniform) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uniform, unit);
}

function configureTextureQuality(gl, image) {
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const powerOfTwo = isPowerOfTwo(width) && isPowerOfTwo(height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, webgl2 || powerOfTwo ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  if (webgl2 || powerOfTwo) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
    || gl.getExtension('MOZ_EXT_texture_filter_anisotropic')
    || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  if (anisotropy) {
    const maximum = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, maximum));
  }
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
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
precision highp float;

uniform sampler2D uAtlas;
uniform sampler2D uRelief;
uniform sampler2D uLabels;
uniform vec2 uAtlasTexel;
uniform vec2 uReliefTexel;
varying vec2 vUv;
varying vec3 vNormal;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float paperNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float gridLine(float coordinate, float divisions) {
  float cell = fract(coordinate * divisions);
  float distanceToLine = min(cell, 1.0 - cell);
  return 1.0 - smoothstep(0.0, 0.0035, distanceToLine);
}

void main() {
  vec4 source = texture2D(uAtlas, vUv);
  vec3 detail = texture2D(uRelief, vUv).rgb;
  float sourceLuma = luminance(source.rgb);
  float detailLuma = luminance(detail);

  float sourceBlue = source.b - max(source.r, source.g);
  float detailBlue = detail.b - max(detail.r, detail.g);
  float water = max(
    smoothstep(0.005, 0.13, sourceBlue),
    smoothstep(0.015, 0.15, detailBlue) * 0.92
  );

  // Antique parchment land with a restrained slate-blue water wash. Oceans
  // and inland lakes use the same family so the sphere reads as one map.
  vec3 landPaper = vec3(0.82, 0.71, 0.52);
  vec3 seaPaper = vec3(0.56, 0.66, 0.68);
  vec3 antique = mix(landPaper, seaPaper, water);

  float broadRelief = (sourceLuma - 0.50) * 0.58 + (detailLuma - 0.50) * 0.24;
  antique += broadRelief * mix(vec3(0.50, 0.41, 0.28), vec3(0.26, 0.31, 0.32), water);

  // Recover the fine linework that disappears when a detailed map is merely
  // sepia-toned. This is an unsharp pass over the actual source textures, not
  // an artificial coastline or political-border outline.
  float sourceNeighbor = (
    luminance(texture2D(uAtlas, vUv + vec2(uAtlasTexel.x, 0.0)).rgb)
    + luminance(texture2D(uAtlas, vUv - vec2(uAtlasTexel.x, 0.0)).rgb)
    + luminance(texture2D(uAtlas, vUv + vec2(0.0, uAtlasTexel.y)).rgb)
    + luminance(texture2D(uAtlas, vUv - vec2(0.0, uAtlasTexel.y)).rgb)
  ) * 0.25;
  float detailNeighbor = (
    luminance(texture2D(uRelief, vUv + vec2(uReliefTexel.x, 0.0)).rgb)
    + luminance(texture2D(uRelief, vUv - vec2(uReliefTexel.x, 0.0)).rgb)
    + luminance(texture2D(uRelief, vUv + vec2(0.0, uReliefTexel.y)).rgb)
    + luminance(texture2D(uRelief, vUv - vec2(0.0, uReliefTexel.y)).rgb)
  ) * 0.25;
  float fineDetail = clamp(
    (sourceLuma - sourceNeighbor) * 2.4 + (detailLuma - detailNeighbor) * 1.25,
    -0.16,
    0.16
  );
  antique += fineDetail * mix(vec3(0.72, 0.59, 0.39), vec3(0.40, 0.50, 0.52), water);

  // Retain a little native color so terrain and water have depth without
  // slipping back into a modern satellite-globe appearance.
  vec3 mutedDetail = mix(vec3(detailLuma), detail, 0.24);
  antique = mix(antique, mutedDetail, 0.08);

  float longitudeGrid = gridLine(vUv.x, 24.0);
  float latitudeGrid = gridLine(vUv.y, 12.0);
  float graticule = max(longitudeGrid, latitudeGrid) * 0.035;
  antique = mix(antique, vec3(0.34, 0.28, 0.21), graticule);

  vec4 label = texture2D(uLabels, vUv);
  antique = mix(antique, vec3(0.27, 0.19, 0.13), label.a * 0.46);

  float grain = paperNoise(vUv * vec2(8192.0, 4096.0));
  antique *= 0.994 + grain * 0.012;

  float facing = clamp(-vNormal.z, 0.0, 1.0);
  float sphereShade = 0.79 + 0.21 * pow(facing, 0.44);
  antique *= sphereShade;

  gl_FragColor = vec4(clamp(antique, 0.0, 1.0), source.a);
}
`;
