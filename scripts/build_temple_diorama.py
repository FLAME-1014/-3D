"""Build an original, fully three-dimensional temple miniature.

Run with Blender 5+: blender --background --factory-startup --python this_file.py
The GLB contains real geometry and embedded PBR textures; no image billboards.
"""

from pathlib import Path
from collections import defaultdict
import json
import math
import random
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "canton-atlas" / "web" / "temple-diorama"
OUT.mkdir(parents=True, exist_ok=True)
TEX = OUT / "textures"
TEX.mkdir(exist_ok=True)
random.seed(37)
START = time.time()
TAU = math.tau

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for mesh in list(bpy.data.meshes):
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def linear(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def normal_texture(name, kind):
    n = 256
    yy, xx = np.mgrid[0:n, 0:n].astype(float) / n
    rng = np.random.default_rng({"stone": 11, "wood": 12, "tile": 13}[kind])
    height = np.zeros((n, n), dtype=float)
    if kind == "wood":
        warp = .012 * np.sin(TAU * xx * 3) + .006 * np.sin(TAU * xx * 9)
        height = .35 * np.sin(TAU * (yy + warp) * 42) + .14 * np.sin(TAU * yy * 86)
    else:
        for frequency, weight in [(3, .6), (11, .27), (28, .13), (67, .045)]:
            phase = rng.random(4) * TAU
            height += weight * np.sin(TAU * xx * frequency + phase[0]) * np.cos(TAU * yy * (frequency + 2) + phase[1])
        if kind == "tile":
            height *= .35
    height += rng.normal(0, .025, (n, n))
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .24
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .24
    normals = np.dstack((-dx, -dy, np.ones_like(dx)))
    normals /= np.linalg.norm(normals, axis=2, keepdims=True)
    pixels = np.dstack((normals * .5 + .5, np.ones_like(dx))).astype(np.float32)
    image = bpy.data.images.new(name, width=n, height=n, alpha=True)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(TEX / f"{kind}-normal.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


NORMALS = {kind: normal_texture(f"PBR · {kind} microrelief", kind) for kind in ("stone", "wood", "tile")}


def material(name, color, roughness=.75, metal=0, texture=None, bump=.28):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear(color), 1)
    m.use_nodes = True
    node = m.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = m.diffuse_color
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metal
    if texture:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = NORMALS[texture]
        normal = m.node_tree.nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = bump
        m.node_tree.links.new(tex.outputs["Color"], normal.inputs["Color"])
        m.node_tree.links.new(normal.outputs["Normal"], node.inputs["Normal"])
    return m


M = {
    "stone": material("01 · warm limestone", "#ccc3ae", .88, texture="stone"),
    "stone_light": material("02 · carved ivory stone", "#e3dbc7", .8, texture="stone"),
    "stone_dark": material("03 · slate foundation", "#777e79", .88, texture="stone"),
    "joint": material("04 · paving mortar", "#aaa797", .96),
    "red": material("05 · vermilion lacquered timber", "#a54536", .52, texture="wood", bump=.18),
    "red_light": material("06 · warm red beam ends", "#bf6650", .58, texture="wood", bump=.16),
    "wood": material("07 · carved dark hardwood", "#593e31", .68, texture="wood"),
    "wood_light": material("08 · warm wooden lattice", "#98704c", .63, texture="wood"),
    "teal": material("09 · glazed jade roof tiles", "#4c7273", .37, .10, "tile"),
    "teal_light": material("10 · roof tile variation", "#628585", .41, .08, "tile"),
    "teal_dark": material("11 · roof underside", "#304f51", .58, texture="wood"),
    "gold": material("12 · muted gilded bronze", "#c9a45c", .33, .7),
    "bronze": material("13 · aged bronze censer", "#6f795a", .44, .65),
    "bronze_dark": material("14 · deep bronze recess", "#39463d", .6, .5),
    "wall": material("15 · warm plaster", "#e4d9bf", .91, texture="stone", bump=.16),
    "green": material("16 · jade green foliage", "#55764e", .92),
    "green_light": material("17 · sunlit foliage", "#80905a", .95),
    "green_dark": material("18 · shaded foliage", "#3f664a", .95),
    "earth": material("19 · garden earth", "#665545", 1),
    "cream": material("20 · bright ivory lettering", "#fff0c9", .42, .08),
}


class Geometry:
    def __init__(self, part, mat):
        self.part, self.mat = part, mat
        self.verts, self.faces, self.smooth = [], [], []

    def add(self, vertices, faces, smooth=False):
        offset = len(self.verts)
        self.verts.extend(vertices)
        self.faces.extend(tuple(v + offset for v in face) for face in faces)
        self.smooth.extend([smooth] * len(faces))

    def box(self, center, size, angle=0):
        x, y, z = center
        a, b, c = [s / 2 for s in size]
        cs, sn = math.cos(angle), math.sin(angle)
        pts = [(x + dx * cs - dy * sn, y + dx * sn + dy * cs, z + dz)
               for dx, dy, dz in [(-a, -b, -c), (a, -b, -c), (a, b, -c), (-a, b, -c),
                                  (-a, -b, c), (a, -b, c), (a, b, c), (-a, b, c)]]
        self.add(pts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                       (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])

    def tube(self, points, radius, sides=7, radii=None):
        pts = [Vector(p) for p in points]
        vertices, faces = [], []
        for i, point in enumerate(pts):
            tangent = (pts[min(i + 1, len(pts) - 1)] - pts[max(0, i - 1)]).normalized()
            reference = Vector((0, 0, 1)) if abs(tangent.z) < .93 else Vector((1, 0, 0))
            u = tangent.cross(reference).normalized()
            v = tangent.cross(u).normalized()
            r = radii[i] if radii else radius
            for j in range(sides):
                theta = TAU * j / sides
                vertices.append(tuple(point + r * (u * math.cos(theta) + v * math.sin(theta))))
        for i in range(len(pts) - 1):
            for j in range(sides):
                faces.append((i * sides + j, i * sides + (j + 1) % sides,
                              (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j))
        faces += [tuple(reversed(range(sides))), tuple((len(pts) - 1) * sides + j for j in range(sides))]
        self.add(vertices, faces, True)

    def lathe(self, center, profile, segments=24):
        x, y, z = center
        pts = [(x + r * math.cos(TAU * j / segments), y + r * math.sin(TAU * j / segments), z + h)
               for h, r in profile for j in range(segments)]
        faces = []
        for row in range(len(profile) - 1):
            for j in range(segments):
                faces.append((row * segments + j, row * segments + (j + 1) % segments,
                              (row + 1) * segments + (j + 1) % segments, (row + 1) * segments + j))
        faces += [tuple(reversed(range(segments))),
                  tuple((len(profile) - 1) * segments + j for j in range(segments))]
        self.add(pts, faces, True)

    def ellipsoid(self, center, radius, rings=7, segments=12, smooth=True):
        x, y, z = center
        rx, ry, rz = radius
        pts = [(x + rx * math.sin(math.pi * i / rings) * math.cos(TAU * j / segments),
                y + ry * math.sin(math.pi * i / rings) * math.sin(TAU * j / segments),
                z + rz * math.cos(math.pi * i / rings))
               for i in range(rings + 1) for j in range(segments)]
        faces = []
        for i in range(rings):
            for j in range(segments):
                faces.append((i * segments + j, (i + 1) * segments + j,
                              (i + 1) * segments + (j + 1) % segments, i * segments + (j + 1) % segments))
        self.add(pts, faces, smooth)

    def finish(self):
        mesh = bpy.data.meshes.new(f"{self.part} / {self.mat} geometry")
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update()
        for polygon, smooth in zip(mesh.polygons, self.smooth):
            polygon.use_smooth = smooth
        # Collapse coincident poles of spheres, lathed finials and hip panels.
        # Remove zero-area faces before export so the portable mesh is clean.
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-7)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        collapsed = [face for face in bm.faces if face.calc_area() < 1e-10]
        if collapsed:
            bmesh.ops.delete(bm, geom=collapsed, context="FACES")
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        obj = bpy.data.objects.new(f"{self.part} · {self.mat}", mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(M[self.mat])
        obj["part"] = self.part
        obj["real_geometry"] = True
        uv = mesh.uv_layers.new(name="Surface UV")
        for polygon in mesh.polygons:
            normal = polygon.normal
            axis = max(range(3), key=lambda i: abs(normal[i]))
            for idx in polygon.loop_indices:
                co = mesh.vertices[mesh.loops[idx].vertex_index].co
                pair = (co.x, co.y) if axis == 2 else ((co.x, co.z) if axis == 1 else (co.y, co.z))
                uv.data[idx].uv = (pair[0] * .72, pair[1] * .72)
        return obj


BUILDERS = {}


def g(part, mat):
    key = (part, mat)
    if key not in BUILDERS:
        BUILDERS[key] = Geometry(part, mat)
    return BUILDERS[key]


def rounded_box(name, center, size, mat, bevel=.04, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(M[mat])
    obj["part"] = name.split(" / ")[0]
    obj["real_geometry"] = True
    mod = obj.modifiers.new("Soft handmade edge", "BEVEL")
    mod.width, mod.segments = bevel, segments
    obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
    return obj


def column(part, x, y, bottom, top, r=.13):
    g(part, "stone_light").lathe((x, y, bottom), [(0, r * 1.7), (.10, r * 1.7), (.16, r * 1.35), (.23, r * 1.35)])
    g(part, "red").lathe((x, y, bottom + .17), [(0, r), (top - bottom - .17, r * .91)])
    g(part, "gold").lathe((x, y, top - .13), [(0, r * 1.06), (.035, r * 1.06)])


def roof(part, cx, cy, width, depth, eave, rise, ridge, tile_step=.24, angle=0):
    """Four curved, continuous roof panels with modeled tile rolls and seams."""
    hw, hd, hr = width / 2, depth / 2, ridge / 2
    lift = min(depth * .12, .32)
    cs, sn = math.cos(angle), math.sin(angle)

    def surface(panel, side, u, v, offset=0):
        if panel == "long":
            x, y = ((hr + (hw - hr) * v) * u, side * hd * v)
        else:
            x, y = (side * (hr + (hw - hr) * v), hd * u * v)
        z = eave + rise * (1 - v) ** 1.65 + lift * abs(u) ** 7 * v ** 5 + .055 * v ** 10 + offset
        return (cx + cs * x - sn * y, cy + sn * x + cs * y, z)

    surface_mesh = g(part, "teal_dark")
    for panel in ("long", "hip"):
        for side in (-1, 1):
            nu, nv = (40, 20) if panel == "long" else (20, 20)
            pts = [surface(panel, side, -1 + 2 * i / nu, j / nv)
                   for j in range(nv + 1) for i in range(nu + 1)]
            faces = []
            for j in range(nv):
                for i in range(nu):
                    a = j * (nu + 1) + i
                    face = (a, a + 1, a + nu + 2, a + nu + 1)
                    if (panel == "long" and side == -1) or (panel == "hip" and side == 1):
                        face = tuple(reversed(face))
                    faces.append(face)
            # Give each curved roof panel a closed underside and real thickness.
            upper_count = len(pts)
            solid_pts = pts + [(x, y, z - .105) for x, y, z in pts]
            solid_faces = faces + [tuple(i + upper_count for i in reversed(face)) for face in faces]
            perimeter = list(range(nu + 1))
            perimeter += [j * (nu + 1) + nu for j in range(1, nv + 1)]
            perimeter += [nv * (nu + 1) + i for i in range(nu - 1, -1, -1)]
            perimeter += [j * (nu + 1) for j in range(nv - 1, 0, -1)]
            for i, a in enumerate(perimeter):
                b = perimeter[(i + 1) % len(perimeter)]
                solid_faces.append((a, b, b + upper_count, a + upper_count))
            surface_mesh.add(solid_pts, solid_faces, True)
            count = max(8, round((width if panel == "long" else depth) / tile_step))
            for k in range(count + 1):
                u = -1 + 2 * k / count
                tilemat = "teal_light" if k % 5 == 0 else "teal"
                start = .02 if panel == "long" else .10
                path = [surface(panel, side, u, start + (1 - start) * j / 16, .035) for j in range(17)]
                g(part, tilemat).tube(path, .044 if width > 5 else .034, sides=6)
                # Overlapping tile ends across the rolls create readable roof texture.
                for j in range(1, 9):
                    v = j / 9
                    if panel == "hip" and v < .22:
                        continue
                    du = .80 / count
                    seam = [surface(panel, side, min(1, max(-1, u + d)), v, .045)
                            for d in (-du, 0, du)]
                    g(part, tilemat).tube(seam, .013, sides=4)
            edge = [surface(panel, side, -1 + 2 * i / 40, 1, -.015) for i in range(41)]
            g(part, "teal").tube(edge, .085 if width > 5 else .065, sides=8)
            g(part, "gold").tube([(x, y, z - .065) for x, y, z in edge], .021, sides=6)
            # The fascia has real depth; the model reads correctly from below.
            g(part, "red").tube([(x, y, z - .14) for x, y, z in edge], .072, sides=6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hip = [surface("long", sy, sx, j / 20, .09) for j in range(21)]
            g(part, "gold").tube(hip, .038, sides=7)
            tip = Vector(hip[-1])
            outward = Vector((cs * sx - sn * sy, sn * sx + cs * sy, 0)).normalized()
            curl = [tip + outward * (.11 * j / 6) + Vector((0, 0, .28 * (j / 6) ** 1.7)) for j in range(7)]
            g(part, "teal").tube([tuple(p) for p in curl], .045, sides=7,
                                 radii=[.068 * (1 - .72 * j / 6) for j in range(7)])
    ridge_path = []
    for i in range(25):
        t = -1 + 2 * i / 24
        x = t * hr
        ridge_path.append((cx + cs * x, cy + sn * x, eave + rise + .11 + .17 * abs(t) ** 7))
    g(part, "gold").tube(ridge_path, .07, sides=10)
    for sign in (-1, 1):
        tip = Vector(ridge_path[0 if sign == -1 else -1])
        path = [tip + Vector((cs * sign * .18 * t, sn * sign * .18 * t, .30 * t * t)) for t in np.linspace(0, 1, 10)]
        g(part, "teal").tube([tuple(p) for p in path], .06, 8,
                             [.075 * (1 - .6 * j / 9) for j in range(10)])


def lattice(part, cx, cy, z, width, height, back=False):
    # Actual small wooden strips, not a window photograph.
    g(part, "wood").box((cx, cy, z), (width, .09, height))
    face_y = cy + (.055 if back else -.055)
    for dx in (-width / 2, width / 2):
        g(part, "red_light").box((cx + dx, face_y, z), (.065, .09, height + .09))
    for dz in (-height / 2, height / 2):
        g(part, "red_light").box((cx, face_y, z + dz), (width, .09, .065))
    nx = max(2, round(width / .16))
    nz = max(2, round(height / .18))
    for i in range(1, nx):
        g(part, "wood_light").box((cx - width / 2 + width * i / nx, face_y, z), (.026, .035, height))
    for i in range(1, nz):
        g(part, "wood_light").box((cx, face_y, z - height / 2 + height * i / nz), (width, .035, .024))


def dougong(part, x, y, z, small=False):
    s = .65 if small else 1
    for level, width in enumerate((.27, .45, .64)):
        g(part, "red_light" if level != 1 else "teal").box((x, y - .035 * level, z + level * .075 * s),
                                                        (width * s, .29 * s, .085 * s))
    for dx in (-.22, .22):
        g(part, "gold").box((x + dx * s, y - .04, z + .16 * s), (.045 * s, .32 * s, .06 * s))


def tree(part, x, y, height=1.8, scale=1):
    g(part, "stone_light").lathe((x, y, .75), [(0, .42 * scale), (.10, .45 * scale),
                                              (.34, .50 * scale), (.40, .53 * scale)], 20)
    g(part, "earth").lathe((x, y, 1.11), [(0, .46 * scale), (.025, .46 * scale)], 20)
    top = 1.12 + height
    trunk = [(x, y, 1.13), (x + .10 * scale, y, 1.12 + height * .38),
             (x - .08 * scale, y + .06, 1.12 + height * .72), (x + .08, y, top - .15)]
    g(part, "wood").tube(trunk, .10 * scale, 9, [.11 * scale, .09 * scale, .07 * scale, .035 * scale])
    for j in range(5):
        theta = j * TAU / 5 + .3
        end = (x + .54 * scale * math.cos(theta), y + .45 * scale * math.sin(theta), top - .25 + (j % 2) * .2)
        g(part, "wood").tube([trunk[2], end], .045 * scale, 7)
        g(part, ["green", "green_light", "green_dark"][j % 3]).ellipsoid(end, (.53 * scale, .48 * scale, .38 * scale), 6, 10)
    g(part, "green").ellipsoid((x, y, top + .06), (.58 * scale, .48 * scale, .43 * scale), 7, 12)


# A low, rounded, small-footprint display plinth.
rounded_box("Foundation / lower bevel", (0, 0, .24), (12.6, 11.8, .48), "stone_dark", .18, 5)
rounded_box("Foundation / warm limestone rim", (0, 0, .52), (12.48, 11.68, .27), "stone_light", .10, 4)
rounded_box("Courtyard / paving bed", (0, 0, .67), (12.12, 11.3, .12), "joint", .06, 3)
for row in range(15):
    y = -5.18 + row * .72
    for col in range(16):
        x = -5.58 + col * .74
        if row % 2:
            x += .16
        if x > 5.8:
            continue
        mat = "stone_light" if (row * 17 + col) % 11 == 0 else "stone"
        g("Courtyard paving", mat).box((x, y, .745), (.716, .695, .045))

# Main hall raised platform and front staircase.
rounded_box("Main hall platform / foot", (0, 2, .89), (7.9, 4.6, .30), "stone", .06)
rounded_box("Main hall platform / cap", (0, 2, 1.09), (7.97, 4.67, .13), "stone_light", .04)
for i in range(5):
    y = -.44 - (4 - i) * .24
    h = .07 + .065 * i
    rounded_box(f"Main hall steps / {i + 1}", (0, y, .755 + h / 2), (2.92, .29, h), "stone_light", .018, 2)

hall_floor, hall_top = 1.16, 3.82
rounded_box("Main hall / solid back wall", (0, 3.32, 2.43), (6.26, .22, 2.55), "wall", .025)
for x in (-3.02, 3.02):
    rounded_box("Main hall / side wall", (x, 1.87, 2.43), (.18, 2.86, 2.55), "wall", .025)
g("Main hall woodwork", "red").box((0, .48, 2.42), (5.95, .17, 2.52))
g("Main hall woodwork", "wood").box((0, 2, 1.19), (6.0, 3.0, .07))
for x in (-2.88, -1.73, -.57, .57, 1.73, 2.88):
    column("Main hall columns", x, -.05, hall_floor, hall_top, .135)
    column("Main hall columns", x, 3.63, hall_floor, hall_top, .135)
    dougong("Main hall brackets", x, -.05, 3.54)
    dougong("Main hall brackets", x, 3.63, 3.54)
for x in (-3.03, 3.03):
    for y in (1.08, 2.42):
        column("Main hall columns", x, y, hall_floor, hall_top, .135)
g("Main hall beams", "red").box((0, -.05, 3.43), (6.55, .22, .28))
g("Main hall beams", "gold").box((0, -.18, 3.48), (6.5, .025, .027))
g("Main hall beams", "red").box((0, 3.63, 3.43), (6.55, .22, .28))
for x in (-2.34, -1.18, 1.18, 2.34):
    lattice("Main hall screens", x, .365, 2.55, .94, 1.37)
    g("Main hall screens", "wood_light").box((x, .35, 1.61), (.93, .1, .36))
for x in (-.29, .29):
    g("Main hall doors", "wood").box((x, .345, 2.14), (.55, .12, 1.94))
    lattice("Main hall doors", x, .26, 2.60, .43, .75)
    for z in (1.53, 1.78):
        g("Main hall doors", "red_light").box((x, .267, z), (.38, .035, .16))
    g("Main hall doors", "gold").ellipsoid((x * .32, .17, 2.0), (.035, .033, .055), 6, 8)
for x in (-2.3, -1.15, 0, 1.15, 2.3):
    lattice("Main hall rear windows", x, 3.46, 2.56, .82, 1.05, True)
# Under-eave rafters remain visible from low and reverse angles.
for i in range(23):
    x = -3.6 + i * .327
    g("Main hall rafters", "wood").box((x, 1.8, 3.80), (.065, 4.1, .09))
roof("Main hall lower roof", 0, 1.8, 8.4, 5.2, 3.88, 1.38, 5.0)
rounded_box("Main hall / upper storey", (0, 1.8, 4.94), (4.82, 2.23, .90), "red", .025)
for x in (-1.8, -.9, 0, .9, 1.8):
    lattice("Upper storey screens", x, .646, 5.05, .65, .50)
    lattice("Upper storey screens", x, 2.955, 5.05, .65, .50, True)
roof("Main hall upper roof", 0, 1.8, 6.5, 3.43, 5.40, 1.23, 3.75, .23)
g("Roof finial", "gold").lathe((0, 1.8, 6.72), [(0, .13), (.08, .19), (.16, .13),
                                                          (.25, .16), (.33, .08), (.42, .045), (.48, 0)], 20)

# Surrounding red walls with dimensional stone coping and tile caps.
for x in (-5.53, 5.53):
    rounded_box("Perimeter / side wall", (x, 0, 1.26), (.20, 9.95, 1.03), "red", .025)
    g("Perimeter coping", "stone_light").box((x, 0, .88), (.31, 10.0, .22))
    g("Perimeter coping", "stone_light").box((x, 0, 1.80), (.33, 10.05, .09))
    for j in range(46):
        y = -4.9 + j * .218
        g("Perimeter tiles", "teal").tube([(x - .25, y, 1.89), (x, y, 1.97), (x + .25, y, 1.89)], .045, 6)
rounded_box("Perimeter / rear wall", (0, 4.92, 1.26), (11.05, .20, 1.03), "red", .025)
g("Perimeter coping", "stone_light").box((0, 4.92, 1.80), (11.2, .33, .09))
for j in range(52):
    x = -5.5 + j * .216
    g("Perimeter tiles", "teal").tube([(x, 4.67, 1.89), (x, 4.92, 1.97), (x, 5.17, 1.89)], .045, 6)
for sx in (-1, 1):
    rounded_box("Perimeter / front wall", (sx * 3.87, -4.8, 1.26), (3.32, .23, 1.03), "red", .025)
    g("Perimeter coping", "stone_light").box((sx * 3.87, -4.8, 1.80), (3.45, .36, .09))
    for j in range(16):
        x = sx * 3.87 - 1.65 + j * .22
        g("Perimeter tiles", "teal").tube([(x, -5.04, 1.9), (x, -4.8, 1.98), (x, -4.56, 1.9)], .045, 6)

# Open entrance gate: the space under the roof is real, with side door leaves.
rounded_box("Gate / stone threshold", (0, -4.55, .84), (3.65, 1.70, .22), "stone_light", .045)
for x in (-1.46, 1.46):
    for y in (-5.04, -4.08):
        column("Gate columns", x, y, .95, 2.73, .125)
        dougong("Gate brackets", x, y, 2.52, True)
g("Gate beams", "red").box((0, -5.02, 2.50), (3.35, .20, .26))
g("Gate beams", "red").box((0, -4.06, 2.50), (3.35, .20, .26))
for x in (-1.26, 1.26):
    g("Gate open doors", "wood").box((x, -4.54, 1.66), (.12, .86, 1.40))
    for j in range(4):
        for z in (1.30, 1.66, 2.02):
            g("Gate door studs", "gold").ellipsoid((x - math.copysign(.075, x), -4.85 + j * .21, z), (.025, .026, .026), 5, 8)
roof("Gate roof", 0, -4.52, 4.25, 2.30, 2.77, .91, 2.30, .22)
for i in range(4):
    y = -5.55 - .17 * i
    h = .65 - i * .15
    rounded_box(f"Gate steps / {i}", (0, y, h / 2), (2.5, .24, h), "stone_light", .025, 2)

# Small bell and drum pavilions at either side of the court.
for side in (-1, 1):
    cx, cy = side * 4.35, -1.92
    part = "Bell pavilion" if side == -1 else "Drum pavilion"
    rounded_box(f"{part} / platform", (cx, cy, .88), (2.05, 2.10, .27), "stone_light", .05)
    for dx in (-.72, .72):
        for dy in (-.72, .72):
            column(part, cx + dx, cy + dy, 1.03, 2.40, .085)
            dougong(part, cx + dx, cy + dy, 2.20, True)
    for dy in (-.73, .73):
        g(part, "red").box((cx, cy + dy, 2.28), (1.78, .13, .15))
    roof(f"{part} roof", cx, cy, 2.48, 2.35, 2.43, .70, .90, .24)
    if side == -1:
        g(part, "bronze").lathe((cx, cy, 1.24), [(0, .39), (.09, .42), (.13, .36),
                                                        (.55, .29), (.70, .12), (.80, .09)], 24)
        g(part, "gold").tube([(cx, cy, 2.02), (cx, cy, 2.30)], .035, 7)
    else:
        g(part, "wood").box((cx, cy, 1.25), (.85, .64, .40))
        g(part, "red").lathe((cx, cy, 1.39), [(0, .31), (.13, .39), (.37, .39), (.50, .31)], 24)
        g(part, "cream").lathe((cx, cy, 1.89), [(0, .32), (.04, .32)], 24)

# Courtyard censer on its own limestone pedestal.
rounded_box("Censer / pedestal", (0, -2.43, .84), (1.42, 1.18, .18), "stone_light", .07)
for theta in (math.pi / 2, math.pi / 2 + TAU / 3, math.pi / 2 + 2 * TAU / 3):
    pts = [(.32 * math.cos(theta), -2.43 + .32 * math.sin(theta), 1.24),
           (.28 * math.cos(theta), -2.43 + .28 * math.sin(theta), 1.05),
           (.38 * math.cos(theta), -2.43 + .38 * math.sin(theta), .94)]
    g("Censer bronze", "bronze").tube(pts, .065, 9)
g("Censer bronze", "bronze").lathe((0, -2.43, 1.10), [(0, .23), (.10, .39), (.32, .48),
                                                                (.47, .43), (.50, .49), (.56, .49), (.58, .40)], 32)
g("Censer bronze", "bronze_dark").lathe((0, -2.43, 1.64), [(0, .398), (.015, .398)], 32)
for side in (-1, 1):
    path = [(side * (.44 + .17 * math.sin(math.pi * t)), -2.43, 1.30 + .39 * t) for t in np.linspace(0, 1, 12)]
    g("Censer bronze", "gold").tube(path, .038, 8)
for dx in (-.12, 0, .12):
    g("Censer incense", "wood_light").tube([(dx, -2.43, 1.62), (dx, -2.43, 2.06 + .05 * (dx == 0))], .012, 6)
    g("Censer incense", "gold").ellipsoid((dx, -2.43, 2.065 + .05 * (dx == 0)), (.017, .017, .024), 5, 8)

# Stone lanterns and carved balustrades beside the main approach.
for side in (-1, 1):
    x, y = side * 2.23, -1.09
    g("Stone lanterns", "stone_light").lathe((x, y, .77), [(0, .26), (.14, .26), (.19, .15),
                                                                        (.67, .10), (.72, .24)], 8)
    g("Stone lanterns", "wood").box((x, y, 1.67), (.31, .31, .35))
    for dx in (-.19, .19):
        for dy in (-.19, .19):
            g("Stone lanterns", "stone_light").box((x + dx, y + dy, 1.68), (.07, .07, .39))
    g("Stone lanterns", "stone_light").lathe((x, y, 1.86), [(0, .36), (.09, .38), (.27, .12), (.32, .06)], 4)
    g("Stone lanterns", "stone_light").ellipsoid((x, y, 2.22), (.075, .075, .10), 6, 8)
    for j in range(5):
        yy = .12 + j * .90
        xx = side * 3.70
        g("Main hall balustrade", "stone_light").box((xx, yy, 1.48), (.13, .13, .65))
        g("Main hall balustrade", "stone_light").ellipsoid((xx, yy, 1.86), (.12, .12, .12), 6, 8)
        if j < 4:
            for zz in (1.36, 1.67):
                g("Main hall balustrade", "stone_light").box((xx, yy + .45, zz), (.10, .87, .09))

# A few restrained, sculpted miniature trees and garden stones.
tree("Rear left tree", -4.61, 3.94, 2.13, .94)
tree("Rear right tree", 4.61, 3.94, 2.02, .94)
tree("Front left bonsai", -4.35, -3.72, .91, .61)
tree("Front right bonsai", 4.35, -3.72, .91, .61)
for side in (-1, 1):
    for j in range(4):
        g("Garden stones", "stone_dark").ellipsoid((side * (4.80 + .18 * math.sin(j)), 2.0 + .32 * j, .87),
                                                  (.20 + j * .025, .16, .16), 5, 8, False)

# Generate compact, named meshes grouped by architectural part and material.
for builder in BUILDERS.values():
    builder.finish()

# A tiny actual extruded title plaque on the front of the plinth.
font_path = Path(r"C:\Windows\Fonts\msyhbd.ttc")
font = bpy.data.fonts.load(str(font_path)) if font_path.exists() else None


def text_object(name, body, location, size, mat, rotation):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.size, curve.align_x, curve.align_y = body, size, "CENTER", "CENTER"
    curve.extrude, curve.bevel_depth, curve.bevel_resolution = .010, .002, 2
    curve.space_character = 1.10
    if font:
        curve.font = font
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.rotation_euler = location, rotation
    obj.data.materials.append(M[mat])
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj["part"] = "Typography"
    obj["real_geometry"] = True
    return obj


rounded_box("Gate / plaque", (0, -5.145, 2.48), (1.04, .055, .33), "teal_dark", .022)
text_object("Gate / extruded temple lettering", "寺庙", (0, -5.188, 2.49), .24, "cream", (math.pi / 2, 0, 0))

ASSET_OBJECTS = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in ASSET_OBJECTS:
    obj["asset"] = "Original Temple Miniature"

# Presentation stage; deliberately excluded from the portable model.
bg = material("Presentation · blue-grey background", "#718895", .95)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.025))
ground = bpy.context.object
ground.name = "Presentation / shadow receiving ground"
ground.data.materials.append(bg)

world = bpy.context.scene.world or bpy.data.worlds.new("Studio World")
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*linear("#b7cbd1"), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = .65


def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    obj = bpy.context.object
    obj.name, obj.data.energy, obj.data.size = name, energy, size
    obj.data.color = linear(color)
    obj.rotation_euler = (Vector((0, 0, 1.7)) - obj.location).to_track_quat("-Z", "Y").to_euler()


area("Studio / large warm key", (-6, -8, 15), 1900, 8, "#fff0da")
area("Studio / cool fill", (9, -2, 9), 1050, 7, "#d9e8ff")
area("Studio / soft rim", (1, 8, 12), 1700, 6, "#fff4df")

bpy.ops.object.camera_add(location=(17, -17, 2.3 + math.sqrt(17 ** 2 + 17 ** 2)))
camera = bpy.context.object
camera.name = "Presentation / orthographic 45 degree camera"
target = Vector((0, 0, 2.3))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 20.0
bpy.context.scene.camera = camera
up = camera.rotation_euler.to_matrix() @ Vector((0, 1, 0))
title = text_object("Presentation / bright bold title", "寺庙", target + up * 7.80, 1.30, "cream", camera.rotation_euler)

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1
scene["description"] = "Original stylized temple diorama. Full three-dimensional geometry, not a reconstruction of a named historic monument."
scene["default_view"] = "Orthographic, azimuth 45 degrees, elevation 45 degrees"
scene.render.engine = "CYCLES"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUT / "temple-diorama-1080.png")
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = .35
scene.view_settings.gamma = 1

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "temple-diorama.blend"), compress=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in ASSET_OBJECTS:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "temple-diorama.glb"),
    export_format="GLB", use_selection=True, export_apply=True,
    export_materials="EXPORT", export_extras=True,
    export_cameras=False, export_lights=False,
)

# Evaluate modifier output as a validation record, not just the coarse source cages.
depsgraph = bpy.context.evaluated_depsgraph_get()
vertices, triangles = 0, 0
bounds = []
for obj in ASSET_OBJECTS:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    vertices += len(mesh.vertices)
    triangles += len(mesh.loop_triangles)
    bounds.extend(tuple(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box)
    evaluated.to_mesh_clear()
mins = [min(v[i] for v in bounds) for i in range(3)]
maxs = [max(v[i] for v in bounds) for i in range(3)]
report = {
    "kind": "true 3D mesh asset",
    "meshes": len(ASSET_OBJECTS),
    "vertices": vertices,
    "triangles": triangles,
    "material_count": len(M),
    "embedded_normal_textures": len(NORMALS),
    "blender_bounds": {"min": mins, "max": maxs},
    "size": [maxs[i] - mins[i] for i in range(3)],
    "default_camera": {"projection": "orthographic", "elevation_degrees": 45, "azimuth_degrees": 45},
    "parts": sorted(set(obj.get("part", "") for obj in ASSET_OBJECTS)),
    "build_seconds": round(time.time() - START, 2),
}
(OUT / "model-info.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("TEMPLE_ASSET_READY", json.dumps(report), flush=True)
if "--skip-render" not in sys.argv:
    bpy.ops.render.render(write_still=True)
print(f"Temple model saved in {OUT}; elapsed {time.time() - START:.1f}s", flush=True)
