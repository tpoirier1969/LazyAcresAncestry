import {
  ATLAS_HOME_ANCHOR,
  ATLAS_REGIONAL_DETAIL_BOUNDS,
  ATLAS_REGIONAL_DETAIL_URL,
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

export function buildSphereMesh(longitudeSegments = 360, latitudeSegments = 180) {
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
    this.regionalReady = false;
    this.atlasSize = { width: 4424, height: 2214 };
    this.reliefSize = { width: 8192, height: 4096 };
    this.regionalSize = { width: 4096, height: 2340 };

    if (!this.available) return;

    try {
      this.initialize();
      this.loadTexture();
      this.loadDetailTexture();
      this.loadRegionalDetailTexture();
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
      viewTilt: gl.getUniformLocation(this.program, 'uViewTilt'),
      focal: gl.getUniformLocation(this.program, 'uFocal'),
      centerZ: gl.getUniformLocation(this.program, 'uCenterZ'),
      cx: gl.getUniformLocation(this.program, 'uCx'),
      cy: gl.getUniformLocation(this.program, 'uCy'),
      viewport: gl.getUniformLocation(this.program, 'uViewport'),
      nearDepth: gl.getUniformLocation(this.program, 'uNearDepth'),
      farDepth: gl.getUniformLocation(this.program, 'uFarDepth'),
      atlas: gl.getUniformLocation(this.program, 'uAtlas'),
      relief: gl.getUniformLocation(this.program, 'uRelief'),
      regional: gl.getUniformLocation(this.program, 'uRegional'),
      labels: gl.getUniformLocation(this.program, 'uLabels'),
      atlasTexel: gl.getUniformLocation(this.program, 'uAtlasTexel'),
      reliefTexel: gl.getUniformLocation(this.program, 'uReliefTexel'),
      regionalTexel: gl.getUniformLocation(this.program, 'uRegionalTexel'),
      regionalBounds: gl.getUniformLocation(this.program, 'uRegionalBounds'),
      regionalReady: gl.getUniformLocation(this.program, 'uRegionalReady'),
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
    this.regionalTexture = createSolidTexture(gl, [128, 128, 128, 255]);
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
      name: 'Atlas global high-resolution detail texture',
      onLoad: image => {
        this.reliefSize = imageSize(image, this.reliefSize);
        this.onReady?.();
      },
    });
  }

  loadRegionalDetailTexture() {
    this.loadImageIntoTexture(this.regionalTexture, ATLAS_REGIONAL_DETAIL_URL, {
      name: 'NASA Great Lakes regional detail texture',
      onLoad: image => {
        this.regionalSize = imageSize(image, this.regionalSize);
        this.regionalReady = true;
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
    const regionalBounds = atlasUvBounds(ATLAS_REGIONAL_DETAIL_BOUNDS);

    gl.uniform1f(this.locations.radius, radius);
    gl.uniform1f(this.locations.yaw, yaw);
    gl.uniform1f(this.locations.pitch, pitch);
    gl.uniform1f(this.locations.viewTilt, camera.viewTilt || 0);
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
    gl.uniform2f(
      this.locations.regionalTexel,
      1 / Math.max(1, this.regionalSize.width),
      1 / Math.max(1, this.regionalSize.height),
    );
    gl.uniform4f(
      this.locations.regionalBounds,
      regionalBounds.left,
      regionalBounds.top,
      regionalBounds.right,
      regionalBounds.bottom,
    );
    gl.uniform1f(this.locations.regionalReady, this.regionalReady ? 1 : 0);

    bindTexture(gl, this.texture, 0, this.locations.atlas);
    bindTexture(gl, this.reliefTexture, 1, this.locations.relief);
    bindTexture(gl, this.labelTexture, 2, this.locations.labels);
    bindTexture(gl, this.regionalTexture, 3, this.locations.regional);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    return this.ready;
  }
}

export function atlasUvBounds(bounds) {
  return {
    left: (bounds.west + 180) / 360,
    top: (90 - bounds.north) / 180,
    right: (bounds.east + 180) / 360,
    bottom: (90 - bounds.south) / 180,
  };
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

  const labels = [
    ['Mare Atlanticum', -35, 30, 26],
    ['Mare Pacificum', -148, 8, 24],
    ['Mare Indicum', 78, -23, 22],
    ['Lacus Superior', -87.5, 48.0, 16],
    ['Occidens', -118, 3, 18],
    ['Oriens', 108, 5, 18],
  ];

  labels.forEach(([text, longitude, latitude, size]) => {
    const x = ((longitude + 180) / 360) * width;
    const y = ((90 - latitude) / 180) * height;
    ctx.font = `italic 500 ${size}px "Palatino Linotype", "Book Antiqua", Georgia, serif`;
    ctx.fillStyle = 'rgba(61,43,29,.34)';
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
uniform float uViewTilt;
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
  vec3 sphereNormal = rotateSphere(aPosition);
  vec3 world = sphereNormal * uRadius;
  world.z += uCenterZ;

  float viewCos = cos(uViewTilt);
  float viewSin = sin(uViewTilt);
  float pivotZ = uCenterZ - uRadius;
  float relativeZ = world.z - pivotZ;
  vec3 pitchedWorld = vec3(
    world.x,
    viewCos * world.y - viewSin * relativeZ,
    pivotZ + viewSin * world.y + viewCos * relativeZ
  );
  vec3 pitchedNormal = vec3(
    sphereNormal.x,
    viewCos * sphereNormal.y - viewSin * sphereNormal.z,
    viewSin * sphereNormal.y + viewCos * sphereNormal.z
  );

  float depth = pitchedWorld.z;
  float screenX = uCx + pitchedWorld.x * uFocal / depth;
  float screenY = uCy - pitchedWorld.y * uFocal / depth;
  float ndcX = screenX / (uViewport.x * 0.5) - 1.0;
  float ndcY = 1.0 - screenY / (uViewport.y * 0.5);
  float ndcZ = clamp((depth - uNearDepth) / (uFarDepth - uNearDepth), 0.0, 1.0) * 2.0 - 1.0;

  gl_Position = vec4(ndcX * depth, ndcY * depth, ndcZ * depth, depth);
  vUv = aUv;
  vNormal = pitchedNormal;
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uAtlas;
uniform sampler2D uRelief;
uniform sampler2D uRegional;
uniform sampler2D uLabels;
uniform vec2 uAtlasTexel;
uniform vec2 uReliefTexel;
uniform vec2 uRegionalTexel;
uniform vec4 uRegionalBounds;
uniform float uRegionalReady;
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
  return 1.0 - smoothstep(0.0, 0.0030, distanceToLine);
}

float regionalMask(vec2 uv) {
  vec2 span = max(uRegionalBounds.zw - uRegionalBounds.xy, vec2(0.000001));
  vec2 low = (uv - uRegionalBounds.xy) / span;
  vec2 high = (uRegionalBounds.zw - uv) / span;
  float edge = min(min(low.x, low.y), min(high.x, high.y));
  float inside = step(0.0, low.x) * step(0.0, low.y) * step(0.0, high.x) * step(0.0, high.y);
  return inside * smoothstep(0.0, 0.055, edge) * uRegionalReady;
}

void main() {
  vec4 source = texture2D(uAtlas, vUv);
  vec3 detail = texture2D(uRelief, vUv).rgb;
  float regionMix = regionalMask(vUv);
  vec2 regionalUv = clamp(
    (vUv - uRegionalBounds.xy) / max(uRegionalBounds.zw - uRegionalBounds.xy, vec2(0.000001)),
    vec2(0.0),
    vec2(1.0)
  );
  vec3 regionalDetail = texture2D(uRegional, regionalUv).rgb;
  detail = mix(detail, regionalDetail, regionMix * 0.92);

  float sourceLuma = luminance(source.rgb);
  float detailLuma = luminance(detail);

  float sourceBlue = source.b - max(source.r, source.g);
  float detailBlue = detail.b - max(detail.r, detail.g);
  float water = max(
    smoothstep(0.005, 0.13, sourceBlue),
    smoothstep(0.015, 0.15, detailBlue) * 0.92
  );

  vec3 landPaper = vec3(0.82, 0.71, 0.52);
  vec3 seaPaper = vec3(0.68, 0.69, 0.65);
  vec3 antique = mix(landPaper, seaPaper, water);

  float broadRelief = (sourceLuma - 0.50) * 0.54 + (detailLuma - 0.50) * 0.38;
  antique += broadRelief * mix(vec3(0.50, 0.41, 0.28), vec3(0.31, 0.34, 0.31), water);

  float sourceEast = luminance(texture2D(uAtlas, vUv + vec2(uAtlasTexel.x, 0.0)).rgb);
  float sourceWest = luminance(texture2D(uAtlas, vUv - vec2(uAtlasTexel.x, 0.0)).rgb);
  float sourceNorth = luminance(texture2D(uAtlas, vUv + vec2(0.0, uAtlasTexel.y)).rgb);
  float sourceSouth = luminance(texture2D(uAtlas, vUv - vec2(0.0, uAtlasTexel.y)).rgb);
  float sourceNeighbor = (sourceEast + sourceWest + sourceNorth + sourceSouth) * 0.25;

  float detailEast = luminance(texture2D(uRelief, vUv + vec2(uReliefTexel.x, 0.0)).rgb);
  float detailWest = luminance(texture2D(uRelief, vUv - vec2(uReliefTexel.x, 0.0)).rgb);
  float detailNorth = luminance(texture2D(uRelief, vUv + vec2(0.0, uReliefTexel.y)).rgb);
  float detailSouth = luminance(texture2D(uRelief, vUv - vec2(0.0, uReliefTexel.y)).rgb);
  if (regionMix > 0.01) {
    vec2 rEast = clamp(regionalUv + vec2(uRegionalTexel.x, 0.0), vec2(0.0), vec2(1.0));
    vec2 rWest = clamp(regionalUv - vec2(uRegionalTexel.x, 0.0), vec2(0.0), vec2(1.0));
    vec2 rNorth = clamp(regionalUv + vec2(0.0, uRegionalTexel.y), vec2(0.0), vec2(1.0));
    vec2 rSouth = clamp(regionalUv - vec2(0.0, uRegionalTexel.y), vec2(0.0), vec2(1.0));
    detailEast = mix(detailEast, luminance(texture2D(uRegional, rEast).rgb), regionMix);
    detailWest = mix(detailWest, luminance(texture2D(uRegional, rWest).rgb), regionMix);
    detailNorth = mix(detailNorth, luminance(texture2D(uRegional, rNorth).rgb), regionMix);
    detailSouth = mix(detailSouth, luminance(texture2D(uRegional, rSouth).rgb), regionMix);
  }
  float detailNeighbor = (detailEast + detailWest + detailNorth + detailSouth) * 0.25;

  float fineDetail = clamp(
    (sourceLuma - sourceNeighbor) * 2.1 + (detailLuma - detailNeighbor) * 2.15,
    -0.20,
    0.20
  );
  antique += fineDetail * mix(vec3(0.74, 0.60, 0.39), vec3(0.43, 0.47, 0.42), water);

  float reliefGradient = length(vec2(detailEast - detailWest, detailNorth - detailSouth));
  float engraving = smoothstep(0.020, 0.11, reliefGradient);
  antique = mix(
    antique,
    vec3(0.33, 0.27, 0.18),
    engraving * mix(0.075, 0.022, water)
  );

  vec3 mutedDetail = mix(vec3(detailLuma), detail, 0.10);
  antique = mix(antique, mutedDetail, 0.022);

  float longitudeGrid = gridLine(vUv.x, 24.0);
  float latitudeGrid = gridLine(vUv.y, 12.0);
  float graticule = max(longitudeGrid, latitudeGrid) * 0.024;
  antique = mix(antique, vec3(0.35, 0.29, 0.21), graticule);

  vec4 label = texture2D(uLabels, vUv);
  antique = mix(antique, vec3(0.27, 0.19, 0.13), label.a * 0.36);

  float coarseGrain = paperNoise(vUv * vec2(720.0, 360.0)) - 0.5;
  float fineGrain = paperNoise(vUv * vec2(8192.0, 4096.0)) - 0.5;
  antique += coarseGrain * vec3(0.030, 0.024, 0.016);
  antique += fineGrain * vec3(0.008, 0.007, 0.005);

  float facing = clamp(-vNormal.z, 0.0, 1.0);
  float sphereShade = 0.79 + 0.21 * pow(facing, 0.44);
  antique *= sphereShade;

  gl_FragColor = vec4(clamp(antique, 0.0, 1.0), source.a);
}
`;
