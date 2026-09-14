import {
  ATLAS_BOUNDARY_TEXTURE_URL,
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

export function buildSphereMesh(longitudeSegments = 192, latitudeSegments = 96) {
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
    this.boundarySize = { width: 3840, height: 1920 };

    if (!this.available) return;

    try {
      this.initialize();
      this.loadTexture();
      this.loadDetailTextures();
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
      boundary: gl.getUniformLocation(this.program, 'uBoundary'),
      labels: gl.getUniformLocation(this.program, 'uLabels'),
      boundaryTexel: gl.getUniformLocation(this.program, 'uBoundaryTexel'),
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
    this.boundaryTexture = createSolidTexture(gl, [255, 255, 255, 255]);
    this.labelTexture = createLabelTexture(gl);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    // This application camera looks down +Z. Outward-facing sphere triangles
    // therefore appear clockwise in window coordinates.
    gl.frontFace(gl.CW);
  }

  loadTexture() {
    this.loadImageIntoTexture(this.texture, this.textureUrl, {
      name: 'Atlas base texture',
      onLoad: () => {
        this.ready = true;
        this.onReady?.();
      },
    });
  }

  loadDetailTextures() {
    const gl = this.gl;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const reliefUrl = maxTextureSize >= 8192
      ? ATLAS_RELIEF_TEXTURE_URL
      : ATLAS_RELIEF_TEXTURE_FALLBACK_URL;

    this.loadImageIntoTexture(this.reliefTexture, reliefUrl, {
      name: 'Atlas high-resolution relief texture',
      onLoad: () => this.onReady?.(),
    });

    this.loadImageIntoTexture(this.boundaryTexture, ATLAS_BOUNDARY_TEXTURE_URL, {
      name: 'Atlas political boundary texture',
      onLoad: image => {
        this.boundarySize = {
          width: image.naturalWidth || image.width || 3840,
          height: image.naturalHeight || image.height || 1920,
        };
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
      this.locations.boundaryTexel,
      1 / Math.max(1, this.boundarySize.width),
      1 / Math.max(1, this.boundarySize.height),
    );

    bindTexture(gl, this.texture, 0, this.locations.atlas);
    bindTexture(gl, this.reliefTexture, 1, this.locations.relief);
    bindTexture(gl, this.boundaryTexture, 2, this.locations.boundary);
    bindTexture(gl, this.labelTexture, 3, this.locations.labels);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    return this.ready;
  }
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

  const labels = [
    ['CANADA', -108, 59, 58, false],
    ['UNITED STATES', -103, 38, 48, false],
    ['ONTARIO', -83.5, 50.5, 31, false],
    ['QUEBEC', -71.5, 52.5, 30, false],
    ['MICHIGAN', -85.5, 44.5, 28, false],
    ['LAKE SUPERIOR', -87.5, 48.1, 25, true],
    ['ACADIA', -64.5, 46.2, 24, true],
    ['ATLANTIC OCEAN', -35, 34, 44, true],
    ['IRELAND', -8, 53.2, 25, false],
    ['ENGLAND', -2, 52.5, 24, false],
    ['FRANCE', 2.2, 46.4, 28, false],
    ['SPAIN', -3.8, 40.1, 27, false],
    ['ITALY', 12.5, 42.2, 25, false],
    ['GERMANY', 10.2, 51.2, 25, false],
    ['SWEDEN', 15.5, 62.2, 24, false],
    ['FINLAND', 26, 64.2, 24, false],
    ['RUSSIA', 68, 59, 54, false],
  ];

  labels.forEach(([text, longitude, latitude, size, italic]) => {
    const x = ((longitude + 180) / 360) * width;
    const y = ((90 - latitude) / 180) * height;
    ctx.font = `${italic ? 'italic ' : ''}600 ${size}px Georgia, 'Times New Roman', serif`;
    ctx.lineWidth = Math.max(1.5, size * 0.045);
    ctx.strokeStyle = 'rgba(229,207,158,.42)';
    ctx.fillStyle = italic ? 'rgba(70,49,31,.66)' : 'rgba(63,43,27,.72)';
    ctx.strokeText(text, x, y);
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
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(12, maximum));
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
uniform sampler2D uBoundary;
uniform sampler2D uLabels;
uniform vec2 uBoundaryTexel;
varying vec2 vUv;
varying vec3 vNormal;

float paperNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float gridLine(float coordinate, float divisions) {
  float cell = fract(coordinate * divisions);
  float distanceToLine = min(cell, 1.0 - cell);
  return 1.0 - smoothstep(0.0, 0.005, distanceToLine);
}

float boundaryLuma(vec2 uv) {
  vec3 color = texture2D(uBoundary, uv).rgb;
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 source = texture2D(uAtlas, vUv);
  float sourceLuma = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float blueLead = source.b - max(source.r, source.g);
  float water = smoothstep(0.015, 0.17, blueLead);

  vec3 landPaper = vec3(0.80, 0.69, 0.49);
  vec3 seaPaper = vec3(0.72, 0.65, 0.53);
  vec3 antique = mix(landPaper, seaPaper, water);

  float sourceContrast = (sourceLuma - 0.50) * 0.72;
  antique += sourceContrast * mix(vec3(0.53, 0.43, 0.28), vec3(0.31, 0.29, 0.25), water);

  // The separate 8K relief/bathymetry layer supplies the fine structure that
  // was missing from the first antique pass when the user zoomed toward the
  // globe. It is deliberately subtle so this remains a historical atlas, not
  // a satellite globe.
  float relief = texture2D(uRelief, vUv).r;
  float reliefDetail = (relief - 0.50) * 0.24;
  antique += reliefDetail * mix(vec3(0.58, 0.48, 0.32), vec3(0.33, 0.31, 0.27), water);

  vec3 sepiaSource = vec3(
    dot(source.rgb, vec3(0.393, 0.769, 0.189)),
    dot(source.rgb, vec3(0.349, 0.686, 0.168)),
    dot(source.rgb, vec3(0.272, 0.534, 0.131))
  );
  antique = mix(antique, sepiaSource, 0.12);

  // Extract political/coastline edges from the vector-derived monochrome map.
  // This gives the sphere the crisp atlas structure seen in the visual target
  // without replacing the shaded physical geography beneath it.
  float centerBoundary = boundaryLuma(vUv);
  float eastBoundary = boundaryLuma(vec2(min(1.0, vUv.x + uBoundaryTexel.x), vUv.y));
  float southBoundary = boundaryLuma(vec2(vUv.x, min(1.0, vUv.y + uBoundaryTexel.y)));
  float boundaryEdge = max(abs(centerBoundary - eastBoundary), abs(centerBoundary - southBoundary));
  boundaryEdge = smoothstep(0.018, 0.11, boundaryEdge);
  antique = mix(antique, vec3(0.29, 0.22, 0.14), boundaryEdge * 0.50);

  float longitudeGrid = gridLine(vUv.x, 36.0);
  float latitudeGrid = gridLine(vUv.y, 18.0);
  float graticule = max(longitudeGrid, latitudeGrid) * 0.075;
  antique = mix(antique, vec3(0.34, 0.27, 0.19), graticule);

  vec4 label = texture2D(uLabels, vUv);
  antique = mix(antique, vec3(0.29, 0.22, 0.14), label.a * 0.70);

  float grain = paperNoise(vUv * vec2(6144.0, 3072.0));
  antique *= 0.988 + grain * 0.022;

  float facing = clamp(-vNormal.z, 0.0, 1.0);
  float sphereShade = 0.76 + 0.24 * pow(facing, 0.42);
  antique *= sphereShade;

  gl_FragColor = vec4(clamp(antique, 0.0, 1.0), source.a);
}
`;
