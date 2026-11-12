import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "canton-atlas/web/temple-diorama");
const modelPath = path.join(directory, "temple-diorama.glb");
const reportPath = path.join(directory, "asset-verification.json");
const errors = [];
const warnings = [];
const checks = [];
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const finite = (values, label) => check(values.every(Number.isFinite), `${label}: nonfinite value`);
const inUnitRange = value => Number.isFinite(value) && value >= 0 && value <= 1;
const round = value => Math.round(value * 1e6) / 1e6;
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function matrixMultiply(a, b) {
  return Array.from({ length: 16 }, (_, i) => {
    const row = i % 4;
    const col = Math.floor(i / 4);
    return a[row] * b[col * 4] + a[row + 4] * b[col * 4 + 1]
      + a[row + 8] * b[col * 4 + 2] + a[row + 12] * b[col * 4 + 3];
  });
}

function localMatrix(node) {
  if (node.matrix) {
    check(node.matrix.length === 16, `${node.name}: invalid transform matrix`);
    finite(node.matrix, node.name);
    return node.matrix;
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  const t = node.translation ?? [0, 0, 0];
  finite([x, y, z, w, ...s, ...t], `${node.name} transform`);
  check(Math.abs(Math.hypot(x, y, z, w) - 1) < 1e-4, `${node.name}: invalid quaternion`);
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    ...t, 1,
  ];
}

const report = {
  passed: false,
  verifiedAt: new Date().toISOString(),
  file: path.basename(modelPath),
  errors,
  warnings,
  checks,
};

try {
  const bytes = await fs.readFile(modelPath);
  report.glbBytes = bytes.length;
  report.sha256 = createHash("sha256").update(bytes).digest("hex");
  check(bytes.toString("ascii", 0, 4) === "glTF", "GLB magic is invalid");
  check(bytes.readUInt32LE(4) === 2, "Expected GLB version 2");
  check(bytes.readUInt32LE(8) === bytes.length, "GLB declared size does not match the file");
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    check(offset + 8 <= bytes.length, "Truncated chunk header");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    check(length % 4 === 0, "Chunk length is not aligned");
    check(offset + 8 + length <= bytes.length, "Chunk exceeds GLB file");
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += length + 8;
  }
  check(chunks.length === 2, "Expected exactly one JSON and one BIN chunk");
  check(chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, "Unexpected GLB chunk order");
  const gltf = JSON.parse(chunks[0].bytes.toString("utf8"));
  const bin = chunks[1].bytes;
  check(gltf.asset.version === "2.0", "Expected glTF 2.0");
  check(gltf.buffers.length === 1 && !gltf.buffers[0].uri, "Geometry buffer must be embedded");
  check(gltf.buffers[0].byteLength <= bin.length && bin.length - gltf.buffers[0].byteLength < 4, "BIN size is invalid");
  checks.push("GLB 2.0 header, total byte length, aligned JSON/BIN chunks");
  report.generator = gltf.asset.generator;

  const views = gltf.bufferViews;
  views.forEach((view, index) => {
    check(view.buffer === 0, `bufferView ${index}: unknown buffer`);
    check(Number.isInteger(view.byteLength) && view.byteLength > 0, `bufferView ${index}: invalid length`);
    const start = view.byteOffset ?? 0;
    check(Number.isInteger(start) && start >= 0, `bufferView ${index}: invalid offset`);
    check(start + view.byteLength <= gltf.buffers[0].byteLength, `bufferView ${index}: outside buffer`);
  });
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const readers = {
    5120: [1, "readInt8"], 5121: [1, "readUInt8"], 5122: [2, "readInt16LE"],
    5123: [2, "readUInt16LE"], 5125: [4, "readUInt32LE"], 5126: [4, "readFloatLE"],
  };
  let finiteScalars = 0;
  const accessors = gltf.accessors.map((accessor, index) => {
    check(!accessor.sparse, `accessor ${index}: sparse data needs a dedicated validator`);
    check(components[accessor.type], `accessor ${index}: unsupported shape`);
    check(readers[accessor.componentType], `accessor ${index}: invalid component type`);
    check(Number.isInteger(accessor.count) && accessor.count > 0, `accessor ${index}: invalid count`);
    const view = views[accessor.bufferView];
    check(view, `accessor ${index}: invalid bufferView`);
    const [byteSize, method] = readers[accessor.componentType];
    const width = components[accessor.type];
    const packedSize = byteSize * width;
    const stride = view.byteStride ?? packedSize;
    const offset = accessor.byteOffset ?? 0;
    check(stride >= packedSize && stride % byteSize === 0, `accessor ${index}: invalid stride`);
    check(offset >= 0 && offset % byteSize === 0, `accessor ${index}: misaligned offset`);
    check(offset + (accessor.count - 1) * stride + packedSize <= view.byteLength, `accessor ${index}: exceeds bufferView`);
    const values = new Float64Array(accessor.count * width);
    const minimum = Array(width).fill(Infinity);
    const maximum = Array(width).fill(-Infinity);
    for (let item = 0; item < accessor.count; item++) {
      for (let component = 0; component < width; component++) {
        const value = bin[method]((view.byteOffset ?? 0) + offset + item * stride + component * byteSize);
        check(Number.isFinite(value), `accessor ${index}: nonfinite data at ${item}/${component}`);
        values[item * width + component] = value;
        minimum[component] = Math.min(minimum[component], value);
        maximum[component] = Math.max(maximum[component], value);
        finiteScalars++;
      }
    }
    for (const [field, actual] of [["min", minimum], ["max", maximum]]) {
      if (!accessor[field]) continue;
      check(accessor[field].length === width, `accessor ${index}: invalid ${field}`);
      actual.forEach((value, component) => {
        check(Math.abs(value - accessor[field][component]) <= 1e-5 * Math.max(1, Math.abs(value)), `accessor ${index}: incorrect ${field}`);
      });
    }
    return { ...accessor, values, width, minimum, maximum };
  });
  checks.push("Every accessor scalar is finite; accessor ranges and declared bounds are valid");
  report.accessors = accessors.length;
  report.checkedNumericValues = finiteScalars;

  const imageReports = (gltf.images ?? []).map((image, index) => {
    check(!image.uri, `image ${index}: external or data URI found`);
    check(image.mimeType === "image/png", `image ${index}: expected embedded PNG`);
    const view = views[image.bufferView];
    check(view, `image ${index}: invalid embedded bufferView`);
    const start = view.byteOffset ?? 0;
    const png = bin.subarray(start, start + view.byteLength);
    check(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `image ${index}: invalid PNG header`);
    check(png.toString("ascii", 12, 16) === "IHDR", `image ${index}: missing IHDR`);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    check(width > 0 && height > 0, `image ${index}: empty image`);
    return { name: image.name, mimeType: image.mimeType, width, height, bytes: png.length };
  });
  (gltf.textures ?? []).forEach((texture, index) => {
    check(imageReports[texture.source], `texture ${index}: invalid image source`);
    if (texture.sampler !== undefined) check(gltf.samplers?.[texture.sampler], `texture ${index}: invalid sampler`);
  });
  function rejectUris(value, location = "gltf") {
    if (Array.isArray(value)) value.forEach((entry, index) => rejectUris(entry, `${location}[${index}]`));
    else if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        check(key !== "uri", `External dependency: ${location}.${key}`);
        rejectUris(entry, `${location}.${key}`);
      }
    }
  }
  rejectUris(gltf);
  checks.push("All images and geometry are inside the GLB; no URI or external asset dependencies");

  const materials = gltf.materials ?? [];
  check(materials.length >= 10, "Insufficient distinct architectural materials");
  let normalMappedMaterials = 0;
  materials.forEach((material, index) => {
    const pbr = material.pbrMetallicRoughness;
    check(pbr, `material ${index}: missing metallic/roughness PBR`);
    check((pbr.baseColorFactor ?? [1, 1, 1, 1]).length === 4, `material ${index}: invalid color`);
    check((pbr.baseColorFactor ?? [1, 1, 1, 1]).every(inUnitRange), `material ${index}: invalid base color`);
    check(inUnitRange(pbr.metallicFactor ?? 1), `material ${index}: invalid metallic factor`);
    check(inUnitRange(pbr.roughnessFactor ?? 1), `material ${index}: invalid roughness factor`);
    const textureFields = [pbr.baseColorTexture, pbr.metallicRoughnessTexture, material.normalTexture, material.occlusionTexture, material.emissiveTexture];
    textureFields.filter(Boolean).forEach(texture => {
      check(gltf.textures?.[texture.index], `material ${index}: invalid texture reference`);
    });
    if (material.normalTexture) {
      check(Number.isFinite(material.normalTexture.scale ?? 1), `material ${index}: invalid normal scale`);
      normalMappedMaterials++;
    }
    check(!material.extensions?.KHR_materials_unlit, `material ${index}: unexpected unlit image material`);
  });
  check(normalMappedMaterials > 0 && imageReports.length >= 3, "Expected stone, wood, and tile detail maps");
  checks.push("Metallic/roughness PBR materials, valid colors and texture references, embedded normal maps");

  let triangles = 0;
  let vertices = 0;
  let primitiveCount = 0;
  let nearZeroAreaTriangles = 0;
  let zeroNormals = 0;
  const usedMeshes = new Set();
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const parts = new Set();
  const visitedNodes = new Set();
  function visitNode(index, parent = identity(), ancestry = new Set()) {
    const node = gltf.nodes[index];
    check(node, `Invalid scene node ${index}`);
    check(!ancestry.has(index), `Cyclic node graph at ${index}`);
    check(!visitedNodes.has(index), `Node ${index} is instanced more than once in the scene`);
    visitedNodes.add(index);
    const descendants = new Set([...ancestry, index]);
    check(node.camera === undefined, "Camera node leaked into asset");
    check(!node.extensions?.KHR_lights_punctual, "Light node leaked into asset");
    check(!/Presentation|shadow receiving|orthographic.*camera|softbox/i.test(node.name ?? ""), `Presentation node exported: ${node.name}`);
    const world = matrixMultiply(parent, localMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes[node.mesh];
      check(mesh, `Node ${index}: invalid mesh reference`);
      usedMeshes.add(node.mesh);
      check(node.extras?.part, `${node.name}: missing architectural part`);
      parts.add(node.extras.part);
      for (const primitive of mesh.primitives) {
        primitiveCount++;
        check((primitive.mode ?? 4) === 4, `${node.name}: expected triangle surfaces`);
        check(materials[primitive.material], `${node.name}: missing PBR material`);
        const position = accessors[primitive.attributes.POSITION];
        const normal = accessors[primitive.attributes.NORMAL];
        check(position?.type === "VEC3" && position.componentType === 5126, `${node.name}: invalid positions`);
        check(normal?.type === "VEC3" && normal.count === position.count, `${node.name}: invalid normals`);
        const uv = accessors[primitive.attributes.TEXCOORD_0];
        if (materials[primitive.material].normalTexture) {
          check(uv?.type === "VEC2" && uv.count === position.count, `${node.name}: normal map missing valid UVs`);
        }
        for (const accessorIndex of Object.values(primitive.attributes)) {
          check(accessors[accessorIndex]?.count === position.count, `${node.name}: attribute count mismatch`);
        }
        const indices = primitive.indices === undefined ? null : accessors[primitive.indices];
        if (indices) {
          check(indices.type === "SCALAR" && [5121, 5123, 5125].includes(indices.componentType), `${node.name}: invalid index type`);
          check(indices.minimum[0] >= 0 && indices.maximum[0] < position.count, `${node.name}: vertex index out of range`);
        }
        const count = indices?.count ?? position.count;
        check(count % 3 === 0, `${node.name}: incomplete triangle`);
        triangles += count / 3;
        vertices += position.count;
        for (let i = 0; i < position.count; i++) {
          const x = position.values[i * 3], y = position.values[i * 3 + 1], z = position.values[i * 3 + 2];
          const transformed = [
            world[0] * x + world[4] * y + world[8] * z + world[12],
            world[1] * x + world[5] * y + world[9] * z + world[13],
            world[2] * x + world[6] * y + world[10] * z + world[14],
          ];
          finite(transformed, `${node.name} world position`);
          transformed.forEach((value, axis) => {
            minimum[axis] = Math.min(minimum[axis], value);
            maximum[axis] = Math.max(maximum[axis], value);
          });
          const normalLength = Math.hypot(...normal.values.subarray(i * 3, i * 3 + 3));
          if (normalLength < 1e-7) zeroNormals++;
          else check(Math.abs(normalLength - 1) < 1e-3, `${node.name}: nonunit normal`);
        }
        const vertex = index => {
          const offset = (indices ? indices.values[index] : index) * 3;
          return position.values.subarray(offset, offset + 3);
        };
        for (let i = 0; i < count; i += 3) {
          const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const crossSquared = (u[1] * v[2] - u[2] * v[1]) ** 2
            + (u[2] * v[0] - u[0] * v[2]) ** 2 + (u[0] * v[1] - u[1] * v[0]) ** 2;
          if (crossSquared < 1e-24) nearZeroAreaTriangles++;
        }
      }
    }
    (node.children ?? []).forEach(child => visitNode(child, world, descendants));
  }
  const scene = gltf.scenes[gltf.scene ?? 0];
  check(scene?.nodes?.length, "Missing scene roots");
  scene.nodes.forEach(index => visitNode(index));
  check(visitedNodes.size === gltf.nodes.length, "Unreachable nodes in GLB");
  check(usedMeshes.size === gltf.meshes.length, "Unused mesh data in GLB");
  check(!(gltf.cameras?.length) && !gltf.extensions?.KHR_lights_punctual, "Presentation camera/lights leaked into GLB");
  const size = maximum.map((value, axis) => value - minimum[axis]);
  check(size.every(value => value > 5 && value < 20), "Unexpected dimensions or flattened model");
  check(triangles > 10000 && usedMeshes.size > 50, "Expected substantial editable geometry");
  const requiredParts = ["Foundation", "Courtyard paving", "Gate", "Gate roof", "Gate open doors",
    "Main hall", "Main hall lower roof", "Main hall upper roof", "Main hall rear windows",
    "Main hall columns", "Main hall brackets", "Main hall steps", "Censer bronze",
    "Bell pavilion", "Drum pavilion", "Rear left tree", "Rear right tree", "Typography"];
  requiredParts.forEach(part => check(parts.has(part), `Missing expected part: ${part}`));
  checks.push("Triangle indices, vertex/normal/UV counts, normals and scene transforms are valid");
  checks.push("Three-dimensional bounds; front, rear, roofs, columns, gate, censer, pavilions, trees and extruded lettering");
  checks.push("All mesh nodes are reachable; presentation ground, camera and lights are excluded");
  if (nearZeroAreaTriangles) warnings.push(`${nearZeroAreaTriangles} near-zero-area triangles, consistent with collapsed rotational/ellipsoid pole faces; no invalid indices or nonfinite data`);
  if (zeroNormals) warnings.push(`${zeroNormals} zero-length vertex normals`);
  const blend = await fs.stat(path.join(directory, "temple-diorama.blend"));
  check(blend.isFile() && blend.size > 100000, "Editable Blender source missing or empty");
  checks.push("Separate editable .blend source exists");

  Object.assign(report, {
    passed: true,
    blendBytes: blend.size,
    meshes: usedMeshes.size,
    nodes: visitedNodes.size,
    primitives: primitiveCount,
    exportedVertices: vertices,
    triangles,
    materials: materials.length,
    textures: gltf.textures?.length ?? 0,
    uniqueEmbeddedImages: imageReports.length,
    normalMappedMaterials,
    embeddedImages: imageReports,
    boundsYUp: { min: minimum.map(round), max: maximum.map(round), size: size.map(round) },
    requiredParts,
    partCount: parts.size,
    excludedPresentationNodes: true,
    externalDependencies: 0,
    nearZeroAreaTriangles,
    zeroNormals,
  });
} catch (error) {
  errors.push(error.stack ?? String(error));
  process.exitCode = 1;
}
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
