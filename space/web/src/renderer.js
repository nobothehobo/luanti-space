// SPDX-License-Identifier: LGPL-2.1-or-later
import { material, distance, raycast } from "./world.js";
import { DESTINATIONS } from "./exploration.js";
import { modelMatrix } from "./ship-motion.js";
import { basis, eye } from "./flight.js";
const FACES = [
  {
    n: [1, 0, 0],
    q: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    light: 0.76,
  },
  {
    n: [-1, 0, 0],
    q: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    light: 0.56,
  },
  {
    n: [0, 1, 0],
    q: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    light: 1,
  },
  {
    n: [0, -1, 0],
    q: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    light: 0.42,
  },
  {
    n: [0, 0, 1],
    q: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
    light: 0.86,
  },
  {
    n: [0, 0, -1],
    q: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    light: 0.65,
  },
];
const UV = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ],
  TRI = [0, 1, 2, 0, 2, 3];
function vertex(out, p, color, uv, node) {
  out.push(...p, ...color, ...uv, node.id, node.rotation);
}
function cube(out, p, node, world, tint = null, scale = 1) {
  for (const face of FACES) {
    if (world && world.get(p.map((v, i) => v + face.n[i])).id) continue;
    const color =
      tint ||
      material(node.id).color.map((v) => v * (node.id === 4 ? 1 : face.light));
    for (const i of TRI)
      vertex(
        out,
        face.q[i].map((v, j) => p[j] + (v - 0.5) * scale),
        color,
        UV[i],
        node,
      );
  }
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
    gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}
export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.meshes = new Map();
    this.drawCalls = 0;
    const gl = (this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    }));
    if (!gl)
      throw new Error(
        "WebGL is unavailable. Enable hardware graphics or try Safari directly.",
      );
    this.program = program(
      gl,
      `
      attribute vec3 aPosition; attribute vec3 aColor; attribute vec2 aUV; attribute float aKind; attribute float aRotation;
      uniform mat3 uModel; uniform vec3 uEye; uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uForward; uniform vec3 uOffset; uniform mat4 uProjection;
      varying vec3 vWorld; varying vec3 vColor; varying vec2 vUV; varying float vKind; varying float vRotation; varying float vDistance;
      void main() { vec3 d=uModel*aPosition+uOffset-uEye; gl_Position=uProjection*vec4(dot(d,uRight),dot(d,uUp),-dot(d,uForward),1.);
        vWorld=uModel*aPosition+uOffset; vColor=aColor; vUV=aUV; vKind=aKind; vRotation=aRotation; vDistance=length(d); }`,
      `
      precision highp float; varying vec3 vWorld; varying vec3 vColor; varying vec2 vUV; varying float vKind; varying float vRotation; varying float vDistance;
      uniform vec3 uEye; uniform float uLod; uniform float uAlpha; uniform float uPreview;
      void main() { if(uLod>.5 && distance(vWorld,uEye)<40.) discard; vec2 uv=vUV; if(vRotation>.5) uv=vec2(1.-uv.y,uv.x); if(vRotation>1.5) uv=vec2(1.-uv.y,uv.x);
        if(vRotation>2.5) uv=vec2(1.-uv.y,uv.x);
        float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
        vec3 c=vColor*(edge<.028?.70:1.);
        if(vKind>2.5&&vKind<3.5) c*=.77+.23*step(.16,fract(uv.x*4.));
        if(vKind>3.5&&vKind<4.5) c=mix(c,vec3(.65,1.,.94),.25);
        if(uPreview>.5) c=vColor*(edge<.04?1.:.75);
        c=mix(c,vec3(.035,.065,.12),smoothstep(1400.,2300.,vDistance)); gl_FragColor=vec4(c,uAlpha); }`,
    );
    this.attributes = ["aPosition", "aColor", "aUV", "aKind", "aRotation"].map(
      (n) => gl.getAttribLocation(this.program, n),
    );
    this.uniforms = Object.fromEntries(
      [
        "uLod",
        "uModel",
        "uEye",
        "uRight",
        "uUp",
        "uForward",
        "uProjection",
        "uAlpha",
        "uPreview",
        "uOffset",
      ].map((n) => [n, gl.getUniformLocation(this.program, n)]),
    );
    this.previewBuffer = gl.createBuffer();
    this.sky = program(
      gl,
      "attribute vec2 aPosition; varying vec2 vUV; void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,1.,1.);}",
      `
      precision highp float; varying vec2 vUV;
      uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uForward; uniform float uAspect;
      void main(){
        vec2 ndc=vUV*2.-1.;
        vec3 d=normalize(uForward + uRight*ndc.x*uAspect*.577350269 + uUp*ndc.y*.577350269);
        vec3 c=mix(vec3(.025,.05,.085),vec3(.006,.012,.032),d.y*.5+.5);
        float halo=pow(max(0.,dot(d,normalize(vec3(.3,.5,-.8)))),24.);
        vec2 grid=vec2((atan(d.x,d.z)/6.283185307+.5)*720.,(asin(d.y)/3.141592654+.5)*360.);
        vec2 cell=floor(grid);
        float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
        vec2 center=vec2(fract(seed*37.3),fract(seed*19.7))*.6+.2;
        float star=step(.988,seed)*(1.-smoothstep(.07,.20,length(fract(grid)-center)));
        c+=vec3(.11,.07,.035)*halo+vec3(.55,.64,.72)*star;
        gl_FragColor=vec4(c,1.);}
`,
    );
    this.skyUniforms = Object.fromEntries(
      ["uRight", "uUp", "uForward", "uAspect"].map((n) => [
        n,
        gl.getUniformLocation(this.sky, n),
      ]),
    );
    this.planetLods = DESTINATIONS.map((p) => {
      const vertices = [],
        lat = 24,
        lon = 48,
        radius = p.radius - (p.streamed ? 7 : 2);
      const point = (a, b) => [
        Math.cos(a) * Math.sin(b),
        Math.sin(a),
        Math.cos(a) * Math.cos(b),
      ];
      for (let y = 0; y < lat; y++)
        for (let x = 0; x < lon; x++) {
          const corners = [
            point(-Math.PI / 2 + (y * Math.PI) / lat, (x * 2 * Math.PI) / lon),
            point(
              -Math.PI / 2 + ((y + 1) * Math.PI) / lat,
              (x * 2 * Math.PI) / lon,
            ),
            point(
              -Math.PI / 2 + ((y + 1) * Math.PI) / lat,
              ((x + 1) * 2 * Math.PI) / lon,
            ),
            point(
              -Math.PI / 2 + (y * Math.PI) / lat,
              ((x + 1) * 2 * Math.PI) / lon,
            ),
          ];
          for (const i of [0, 1, 2, 0, 2, 3]) {
            const n = corners[i],
              light =
                0.45 + 0.55 * Math.max(0, n[1] * 0.8 + n[0] * 0.3 + n[2] * 0.3);
            vertex(
              vertices,
              n.map((v, j) => v * radius + p.center[j]),
              p.color.map((v) => v * light),
              [0.5, 0.5],
              { id: -1, rotation: 0 },
            );
          }
        }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW,
      );
      return { planet: p, buffer, count: vertices.length / 10 };
    });
    this.skyAttribute = gl.getAttribLocation(this.sky, "aPosition");
    this.skyBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    this.rebuild();
  }
  rebuild() {
    const gl = this.gl;
    for (const ck of this.world.dirty) {
      const old = this.meshes.get(ck);
      if (old) gl.deleteBuffer(old.buffer);
      const vertices = [];
      for (const k of this.world.chunks.get(ck) || [])
        cube(
          vertices,
          k.split(",").map(Number),
          this.world.cells.get(k),
          this.world,
        );
      if (!vertices.length) {
        this.meshes.delete(ck);
        continue;
      }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW,
      );
      this.meshes.set(ck, {
        buffer,
        count: vertices.length / 10,
        center: ck.split(",").map((v) => Number(v) * 16 + 8),
      });
    }
    this.world.dirty.clear();
  }
  bind(buffer) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const sizes = [3, 3, 2, 1, 1],
      offsets = [0, 3, 6, 8, 9];
    for (let i = 0; i < 5; i++) {
      gl.enableVertexAttribArray(this.attributes[i]);
      gl.vertexAttribPointer(
        this.attributes[i],
        sizes[i],
        gl.FLOAT,
        false,
        40,
        offsets[i] * 4,
      );
    }
  }
  render(player, target, valid, settings, ship = null, dt = 1 / 60) {
    const gl = this.gl,
      canvas = this.canvas,
      ratio = Math.min(
        devicePixelRatio,
        { low: 1, balanced: 1.5, high: 2 }[settings.quality],
      );
    const w = Math.round(canvas.clientWidth * ratio),
      h = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    let camera = player,
      cameraEye = eye(player.feet);
    if (ship?.piloting) {
      if (settings.camera !== "cockpit") {
        const desired = ship.global([0, 4, -15]),
          anchor = ship.global([0, 2, -1]);
        // Stop the chase camera at terrain. Camera motion never changes player/ship state.
        const d = desired.map((v, i) => v - anchor[i]),
          length = Math.hypot(...d);
        const hit = raycast(this.world, anchor, d, length);
        const clipped = hit
          ? anchor.map(
              (v, i) => v + (d[i] * Math.max(0, hit.distance - 0.7)) / length,
            )
          : desired;
        if (
          !this.cameraEye ||
          this.cameraSource !== ship ||
          distance(this.cameraEye, clipped) > 60
        )
          this.cameraEye = clipped;
        const smoothing = 1 - Math.exp(-8 * Math.min(0.1, dt));
        this.cameraEye = this.cameraEye.map(
          (v, i) => v + (clipped[i] - v) * smoothing,
        );
        cameraEye = this.cameraEye;
        const target = ship.global([0, 1, 8]),
          aim = target.map((v, i) => v - cameraEye[i]);
        camera = {
          yaw: Math.atan2(aim[0], aim[2]),
          pitch: Math.atan2(aim[1], Math.hypot(aim[0], aim[2])),
        };
      } else {
        camera = { yaw: ship.yaw, pitch: ship.pitch };
        this.cameraEye = null;
      }
      this.cameraSource = ship;
    } else {
      this.cameraEye = null;
      this.cameraSource = null;
    }
    const cameraBasis = basis(camera.yaw, camera.pitch);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.sky);
    gl.uniform3fv(this.skyUniforms.uRight, cameraBasis.right);
    gl.uniform3fv(this.skyUniforms.uUp, cameraBasis.up);
    gl.uniform3fv(this.skyUniforms.uForward, cameraBasis.forward);
    gl.uniform1f(this.skyUniforms.uAspect, w / h);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.enableVertexAttribArray(this.skyAttribute);
    gl.vertexAttribPointer(this.skyAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    const b = cameraBasis,
      e = cameraEye,
      f = 1 / Math.tan(Math.PI / 6),
      near = 0.08,
      far = 2400;
    const projection = new Float32Array([
      f / (w / h),
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) / (near - far),
      -1,
      0,
      0,
      (2 * far * near) / (near - far),
      0,
    ]);
    gl.uniformMatrix4fv(this.uniforms.uProjection, false, projection);
    for (const [n, v] of [
      ["uEye", e],
      ["uRight", b.right],
      ["uUp", b.up],
      ["uForward", b.forward],
    ])
      gl.uniform3fv(this.uniforms[n], v);
    gl.uniform1f(this.uniforms.uLod, 0);
    gl.uniformMatrix3fv(this.uniforms.uModel, false, modelMatrix());
    gl.uniform1f(this.uniforms.uAlpha, 1);
    gl.uniform1f(this.uniforms.uPreview, 0);
    gl.uniform3fv(this.uniforms.uOffset, [0, 0, 0]);
    this.drawCalls = 1;
    if (this.world.dirty.size) this.rebuild();
    for (const mesh of this.meshes.values()) {
      if (distance(mesh.center, e) > 850) continue;
      this.bind(mesh.buffer);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      this.drawCalls++;
    }
    gl.uniform1f(this.uniforms.uLod, 1);
    for (const lod of this.planetLods) {
      // Close-up edits use voxel meshes; the interior LOD is only a distant silhouette.
      if (distance(lod.planet.center, e) < lod.planet.radius - 10) continue;
      this.bind(lod.buffer);
      gl.drawArrays(gl.TRIANGLES, 0, lod.count);
      this.drawCalls++;
    }
    gl.uniform1f(this.uniforms.uLod, 0);
    if (ship) {
      if (this.shipSource !== ship || this.shipRevision !== ship.revision) {
        if (this.shipBuffer) gl.deleteBuffer(this.shipBuffer);
        const vertices = [];
        for (const [k, n] of ship.cells)
          cube(vertices, k.split(",").map(Number), n, ship);
        this.shipBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shipBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(vertices),
          gl.STATIC_DRAW,
        );
        this.shipCount = vertices.length / 10;
        this.shipSource = ship;
        this.shipRevision = ship.revision;
      }
      gl.uniformMatrix3fv(
        this.uniforms.uModel,
        false,
        modelMatrix(ship.yaw, ship.pitch),
      );
      gl.uniform3fv(this.uniforms.uOffset, ship.position);
      this.bind(this.shipBuffer);
      gl.drawArrays(gl.TRIANGLES, 0, this.shipCount);
      this.drawCalls++;
    }
    gl.uniformMatrix3fv(
      this.uniforms.uModel,
      false,
      target?.model || modelMatrix(),
    );
    gl.uniform3fv(this.uniforms.uOffset, target?.offset || [0, 0, 0]);
    if (target) {
      const vertices = [];
      cube(
        vertices,
        target.above,
        settings,
        null,
        valid ? [0.22, 1, 0.8] : [1, 0.24, 0.32],
        1.006,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, this.previewBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.DYNAMIC_DRAW,
      );
      this.bind(this.previewBuffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(this.uniforms.uAlpha, 0.43);
      gl.uniform1f(this.uniforms.uPreview, 1);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 10);
      gl.depthMask(true);
      this.drawCalls++;
    }
  }
}
