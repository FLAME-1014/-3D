"""Build an original, editable portrait study for the WebGL portfolio.

This asset is an ORIGINAL DEMO CHARACTER. No photograph was supplied and it is
not a reconstruction or likeness of a real person.

Run:
  blender --background --factory-startup --python-exit-code 1 \
    --python scripts/build_portfolio_character.py

An optional ``-- --output path`` selects the asset directory.
The mesh faces Blender -Y; the glTF exporter converts that to glTF +Z.
"""

from pathlib import Path
import argparse
import json
import math
import sys
import time

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument(
    "--output",
    default=str(ROOT / "canton-atlas" / "web" / "portrait-portfolio" / "assets"),
)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
OUT = Path(args.output).resolve()
OUT.mkdir(parents=True, exist_ok=True)
START = time.time()
TAU = math.tau

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.meshes):
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in list(bpy.data.materials):
    if block.users == 0:
        bpy.data.materials.remove(block)

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
bpy.context.preferences.filepaths.save_version = 0
scene["asset_status"] = "Original demonstration character; no portrait supplied."
scene["reference"] = "none"


def linear(hex_value):
    channels = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in channels)


def material(name, color, roughness=.5, metallic=0, alpha=1):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*linear(color), alpha)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = result.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        result.surface_render_method = "DITHERED"
    return result


M = {
    "skin": material("Skin_WarmTerracotta", "#BC8065", .48),
    "ear": material("Skin_EarRecess", "#9D5D48", .6),
    "lip": material("Face_Lips", "#975B49", .56),
    "crease": material("Face_SoftCreases", "#714638", .65),
    "eye": material("Eyes_WarmIvory", "#F1EBDD", .24),
    "iris": material("Eyes_Hazel", "#725639", .23),
    "pupil": material("Eyes_Pupil", "#171E1B", .2),
    "catchlight": material("Eyes_Catchlight", "#FFFCED", .12),
    "hair": material("Hair_Chestnut", "#30251F", .62),
    "hair_highlight": material("Hair_SculptedHighlights", "#3E2E23", .66),
    "frame": material("Glasses_Charcoal", "#1C2523", .3),
    "metal": material("Details_BrushedBrass", "#B99459", .31, .65),
    "lens": material("Glasses_ClearLenses", "#B7D2C6", .12, alpha=.055),
    "jacket": material("Clothing_Jacket", "#E4DDC9", .79),
    "lapel": material("Clothing_Lapel", "#EAE4D4", .8),
    "seam": material("Clothing_Seams", "#C8BDA4", .86),
    "shirt": material("Clothing_ForestKnit", "#274C40", .88),
    "knit": material("Clothing_KnitRibbing", "#33594B", .91),
    "button": material("Clothing_HornButtons", "#5A4B39", .4),
}
skin_bsdf = M["skin"].node_tree.nodes.get("Principled BSDF")
skin_bsdf.inputs["Subsurface Weight"].default_value = .055
skin_bsdf.inputs["Subsurface Radius"].default_value = (1.0, .38, .18)


def mesh_object(name, vertices, faces, mat, smooth=True, subdiv=0):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = smooth
    if subdiv:
        modifier = obj.modifiers.new("Editable surface smoothing", "SUBSURF")
        modifier.levels = subdiv
        modifier.render_levels = subdiv
    obj["part"] = name
    obj["editable"] = True
    return obj


def ellipsoid(name, center, radii, mat, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    obj["part"] = name
    obj["editable"] = True
    return obj


def catmull(points, subdivisions=8):
    pts = [Vector(p) for p in points]
    result = []
    for i in range(len(pts) - 1):
        p0, p1 = pts[max(0, i - 1)], pts[i]
        p2, p3 = pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for j in range(subdivisions):
            t = j / subdivisions
            result.append(
                .5 * ((2 * p1) + (-p0 + p2) * t
                      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                      + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
            )
    result.append(pts[-1])
    return result


def tube(name, points, radius, mat, sides=10, closed=False, caps=True):
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    previous_normal = None
    for i, point in enumerate(points):
        before = points[(i - 1) % len(points)] if closed or i > 0 else point
        after = points[(i + 1) % len(points)] if closed or i + 1 < len(points) else point
        tangent = (after - before).normalized()
        helper = Vector((0, 1, 0))
        if abs(tangent.dot(helper)) > .96:
            helper = Vector((1, 0, 0))
        normal = tangent.cross(helper).normalized()
        if previous_normal is not None and normal.dot(previous_normal) < 0:
            normal.negate()
        previous_normal = normal
        binormal = tangent.cross(normal).normalized()
        rr = radius[i] if isinstance(radius, list) else radius
        if isinstance(rr, tuple):
            width, depth = rr
        else:
            width, depth = rr, rr
        for j in range(sides):
            angle = TAU * j / sides
            vertices.append(tuple(point + normal * math.cos(angle) * width + binormal * math.sin(angle) * depth))
    for i in range(len(points) if closed else len(points) - 1):
        nxt = (i + 1) % len(points)
        for j in range(sides):
            k = (j + 1) % sides
            faces.append((i * sides + j, i * sides + k, nxt * sides + k, nxt * sides + j))
    if caps and not closed:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    return mesh_object(name, vertices, faces, mat)


def line(name, points, radius, mat, subdivisions=8):
    return tube(name, catmull(points, subdivisions), radius, mat)


def polygon_solid(name, points, mat, thickness=.018, bevel=.015):
    vertices = list(points) + [(x, y + thickness, z) for x, y, z in points]
    n = len(points)
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    result = mesh_object(name, vertices, faces, mat)
    mod = result.modifiers.new("Soft tailored edges", "BEVEL")
    mod.width, mod.segments = bevel, 3
    norm = result.modifiers.new("Weighted cloth normals", "WEIGHTED_NORMAL")
    norm.keep_sharp = True
    return result


def ring_body(name, profile, mat, opening=None, sides=72, subdiv=2):
    vertices, faces = [], []
    for i, (z, rx, front, back) in enumerate(profile):
        gap = opening[i] if opening else 0
        for j in range(sides + (1 if opening else 0)):
            phi = gap + (TAU - gap * 2) * j / sides
            x = rx * math.sin(phi)
            y = (-front if math.cos(phi) >= 0 else -back) * math.cos(phi) + .025
            vertices.append((x, y, z))
    count = sides + (1 if opening else 0)
    for i in range(len(profile) - 1):
        for j in range(sides):
            k = (j + 1) % count
            faces.append((i * count + j, i * count + k, (i + 1) * count + k, (i + 1) * count + j))
    if not opening:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(profile) - 1) * sides + j for j in range(sides)))
    result = mesh_object(name, vertices, faces, mat, subdiv=subdiv)
    if opening:
        modifier = result.modifiers.new("Real cloth thickness", "SOLIDIFY")
        modifier.thickness = .022
    return result


# The head is a continuous, purpose-shaped oval mesh. It is not a stock sphere.
head_profile = [
    (1.805, .105, .135, .14),
    (1.825, .195, .215, .20),
    (1.875, .290, .285, .255),
    (1.960, .365, .329, .300),
    (2.080, .421, .360, .345),
    (2.220, .472, .381, .369),
    (2.345, .483, .372, .380),
    (2.455, .476, .363, .385),
    (2.565, .478, .367, .386),
    (2.700, .475, .369, .382),
    (2.825, .452, .343, .365),
    (2.940, .395, .295, .318),
    (3.020, .294, .216, .238),
    (3.065, .150, .107, .119),
    (3.078, .035, .025, .028),
]
head = ring_body("Head_SculptedOval", head_profile, M["skin"], sides=80, subdiv=1)
head["description"] = "Editable quad rings shaped for cheeks, jaw, forehead and chin."

neck_profile = [
    (1.480, .235, .188, .19), (1.500, .235, .188, .19),
    (1.670, .214, .177, .18), (1.850, .209, .163, .174),
    (1.970, .230, .167, .190), (1.985, .230, .167, .190),
]
ring_body("Neck", neck_profile, M["skin"], sides=48, subdiv=1)

# Folded-arm silhouette, with a shirt visible through the open jacket.
body_profile = [
    (0.000, .475, .255, .230),
    (.035, .485, .264, .239),
    (.160, .490, .268, .245),
    (.430, .509, .288, .253),
    (.790, .540, .304, .270),
    (1.150, .585, .307, .276),
    (1.390, .650, .284, .260),
    (1.520, .586, .232, .218),
    (1.600, .366, .194, .190),
    (1.630, .245, .182, .181),
]
ring_body("Shirt_Torso", body_profile, M["shirt"], sides=64, subdiv=1)
jacket_profile = [(z, rx + .031, front + .035, back + .032) for z, rx, front, back in body_profile]
jacket_opening = [.24, .24, .25, .27, .30, .40, .50, .53, .57, .58]
ring_body("Jacket_OpenTailoredBody", jacket_profile, M["jacket"], opening=jacket_opening, subdiv=1)

# Crew neckline, knit ribs, and the jacket's continuous hem.
crew_points = [(.245 * math.sin(TAU * i / 80), .025 - .188 * math.cos(TAU * i / 80), 1.625) for i in range(80)]
tube("Shirt_CrewNeckRib", crew_points, (.025, .022), M["knit"], closed=True)
for i in range(24):
    phi = -1.3 + i * 2.6 / 23
    x, y = .245 * math.sin(phi), .025 - .190 * math.cos(phi)
    line(f"Shirt_NeckRib_{i:02d}", [(x, y - .006, 1.606), (x, y - .008, 1.641)], .0024, M["shirt"], 2)
hem_points = [(.513 * math.sin(.24 + (TAU - .48) * i / 80), .025 - (.299 if math.cos(.24 + (TAU - .48) * i / 80) >= 0 else .274) * math.cos(.24 + (TAU - .48) * i / 80), .055) for i in range(81)]
tube("Jacket_BottomHem", hem_points, .005, M["seam"])

lapel_points = [
    (-.175, -.195, 1.675),
    (-.365, -.205, 1.560),
    (-.425, -.270, 1.414),
    (-.319, -.322, 1.376),
    (-.375, -.330, 1.280),
    (-.142, -.339, .965),
    (-.111, -.339, 1.150),
    (-.214, -.274, 1.495),
]
for side, suffix in [(1, "L"), (-1, "R")]:
    points = [(x * side, y - .025, z) for x, y, z in lapel_points]
    polygon_solid(f"Jacket_NotchedLapel_{suffix}", points, M["lapel"], .024, .014)
    line(f"Jacket_LapelStitch_{suffix}", [
        (-.174 * side, -.236, 1.632),
        (-.323 * side, -.265, 1.513),
        (-.364 * side, -.309, 1.430),
    ], .0024, M["seam"])
    line(f"Jacket_FrontSeam_{suffix}", [
        (-.140 * side, -.333, .100),
        (-.150 * side, -.347, .500),
        (-.173 * side, -.357, .915),
    ], .0034, M["seam"])

# A single welt pocket and understated enamel/brass lapel pin.
polygon_solid("Jacket_ChestWeltPocket", [
    (-.510, -.256, 1.172), (-.294, -.323, 1.186),
    (-.290, -.329, 1.145), (-.506, -.266, 1.133),
], M["lapel"], .015, .007)
pin = ellipsoid("Jacket_LapelPin_Brass", (-.321, -.360, 1.370), (.032, .009, .032), M["metal"], 32, 16)
ellipsoid("Jacket_LapelPin_Enamel", (-.321, -.369, 1.370), (.022, .004, .022), M["shirt"], 28, 14)
for z in [.310, .760]:
    ellipsoid(f"Jacket_HornButton_{z}", (.176, -.350, z), (.030, .012, .030), M["button"], 24, 14)
    for dx in [-.007, .007]:
        ellipsoid(f"Jacket_ButtonStitch_{z}_{dx}", (.176 + dx, -.364, z), (.0025, .002, .009), M["seam"], 12, 8)


def sleeve(name, anchors, end_radius=.125):
    points = catmull(anchors, 9)
    radii = []
    for i in range(len(points)):
        t = i / (len(points) - 1)
        width = .215 * (1 - t) + end_radius * t
        # Mild natural fullness at the elbow rather than sausage segments.
        width += .025 * math.sin(math.pi * t) ** 4
        radii.append((width, width * .86))
    obj = tube(name, points, radii, M["jacket"], sides=24)
    subs = obj.modifiers.new("Tailored sleeve smoothing", "SUBSURF")
    subs.levels = subs.render_levels = 1
    return points


left_sleeve = sleeve("Jacket_Sleeve_L", [
    (-.420, .040, 1.400), (-.710, .045, 1.255),
    (-.827, .015, .955), (-.813, -.075, .740),
    (-.618, -.298, .730), (-.258, -.417, .820),
    (.422, -.220, .985),
])
right_sleeve = sleeve("Jacket_Sleeve_R", [
    (.420, .040, 1.400), (.705, .054, 1.255),
    (.821, .025, .940), (.822, -.075, .667),
    (.601, -.335, .535), (.236, -.465, .501),
    (-.421, -.310, .603),
])


def cuff(name, end, previous, radius):
    end, previous = Vector(end), Vector(previous)
    direction = (end - previous).normalized()
    points = [end - direction * .045, end - direction * .015, end + direction * .006]
    tube(name, points, [(radius, radius * .86)] * 3, M["lapel"], sides=24)
    tube(name + "_Stitch", [end - direction * .030, end - direction * .026], [(radius + .002, radius * .86 + .002)] * 2, M["seam"], sides=24)
    return end, direction


l_end, l_dir = cuff("Jacket_Cuff_L", left_sleeve[-1], left_sleeve[-3], .129)
r_end, r_dir = cuff("Jacket_Cuff_R", right_sleeve[-1], right_sleeve[-3], .129)


def resting_hand(name, wrist, direction, mirror=False):
    """An editable palm and four gently resting fingers, not a mitten."""
    wrist, direction = Vector(wrist), Vector(direction)
    palm_center = wrist + direction * .115 + Vector((0, -.012, 0))
    palm = ellipsoid(name + "_Palm", palm_center, (.142, .073, .092), M["skin"], 40, 24)
    # Both palms lie across the opposite sleeve, approximately horizontally.
    palm.rotation_euler.y = -.22 if direction.x > 0 else .12
    sx = 1 if direction.x > 0 else -1
    for i in range(4):
        z_offset = (.060 - i * .037)
        length = [.120, .142, .136, .105][i]
        start = palm_center + Vector((sx * .075, -.012 - i * .004, z_offset))
        points = [
            start,
            start + Vector((sx * length * .55, -.006, -.010)),
            start + Vector((sx * length, .009, -.025)),
        ]
        radii = [.023, .022, .017, .010]
        sampled = catmull(points, 6)
        tube(name + f"_Finger_{i + 1}", sampled,
             [.022 * (1 - .43 * j / (len(sampled) - 1)) for j in range(len(sampled))],
             M["skin"], sides=12)
        nail = ellipsoid(name + f"_Nail_{i + 1}", points[-1] + Vector((-sx * .016, -.014, .006)), (.017, .004, .011), M["lip"], 20, 12)
    thumb_start = palm_center + Vector((-sx * .016, -.037, -.060))
    line(name + "_Thumb", [
        thumb_start, thumb_start + Vector((sx * .077, -.037, -.025)),
        thumb_start + Vector((sx * .128, -.012, -.009)),
    ], .031, M["skin"])
    return palm


resting_hand("Hand_L", l_end, l_dir)
resting_hand("Hand_R", r_end, r_dir, mirror=True)

# Quiet, individually editable seams reinforce the folded arms.
line("Jacket_ElbowFold_L_01", [(-.939, -.050, .815), (-.911, -.135, .769), (-.868, -.215, .758)], .0035, M["seam"])
line("Jacket_ElbowFold_L_02", [(-.942, .015, .868), (-.918, -.075, .829), (-.873, -.170, .814)], .0030, M["seam"])
line("Jacket_ElbowFold_R_01", [(.928, -.087, .694), (.900, -.177, .648), (.843, -.245, .627)], .0035, M["seam"])

# Ears, softly folded helix, and concha inset.
for side, suffix in [(-1, "L"), (1, "R")]:
    ear = ellipsoid(f"Ear_{suffix}", (side * .474, .026, 2.357), (.092, .075, .157), M["skin"])
    ear.rotation_euler.y = side * -.09
    ellipsoid(f"Ear_Concha_{suffix}", (side * .511, -.039, 2.365), (.041, .016, .086), M["ear"], 32, 20)
    outline = []
    for i in range(44):
        t = TAU * i / 44
        outline.append((side * (.506 + .040 * math.cos(t)), -.051, 2.367 + .105 * math.sin(t)))
    tube(f"Ear_Helix_{suffix}", outline, .012, M["skin"], sides=8, closed=True)
    line(f"Ear_Antihelix_{suffix}", [
        (side * .501, -.062, 2.305), (side * .487, -.064, 2.356),
        (side * .508, -.061, 2.414),
    ], .011, M["skin"])

# A tapered nose bridge and tip are one smooth editable mesh.
nose_profile = [
    (2.565, .035, -.341, .027),
    (2.525, .046, -.345, .056),
    (2.455, .052, -.345, .109),
    (2.370, .066, -.347, .156),
    (2.306, .091, -.345, .184),
    (2.274, .101, -.345, .164),
    (2.248, .082, -.345, .116),
    (2.233, .047, -.345, .071),
]
nose_vertices, nose_faces = [], []
nose_sides = 36
for z, width, base, depth in nose_profile:
    for j in range(nose_sides):
        theta = TAU * j / nose_sides
        nose_vertices.append((width * math.sin(theta), base - depth * math.cos(theta), z))
for i in range(len(nose_profile) - 1):
    for j in range(nose_sides):
        k = (j + 1) % nose_sides
        nose_faces.append((i * nose_sides + j, i * nose_sides + k, (i + 1) * nose_sides + k, (i + 1) * nose_sides + j))
nose_faces.append(tuple(reversed(range(nose_sides))))
nose_faces.append(tuple((len(nose_profile) - 1) * nose_sides + j for j in range(nose_sides)))
mesh_object("Face_NoseBridgeAndTip", nose_vertices, [tuple(reversed(face)) for face in nose_faces], M["skin"], subdiv=2)
for side in [-1, 1]:
    ellipsoid(f"Face_Nostril_{side}", (side * .058, -.438, 2.247), (.017, .012, .009), M["crease"], 24, 14)


def almond_eye(side, suffix):
    cx, cz = side * .213, 2.448
    verts, faces = [(cx, -.424, cz)], []
    count, rings = 56, 6
    for ring in range(1, rings + 1):
        rad = ring / rings
        for i in range(count):
            angle = TAU * i / count
            dx = .127 * math.cos(angle)
            dz = (.059 if math.sin(angle) >= 0 else .044) * math.sin(angle) * abs(math.sin(angle)) ** .2
            verts.append((cx + dx * rad, -.424 + .031 * rad * rad, cz + dz * rad + .009 * side * dx / .127))
    for i in range(count):
        faces.append((0, 1 + i, 1 + (i + 1) % count))
    for ring in range(rings - 1):
        start, nxt = 1 + ring * count, 1 + (ring + 1) * count
        for i in range(count):
            k = (i + 1) % count
            faces.append((start + i, nxt + i, nxt + k, start + k))
    mesh_object(f"Eye_Sclera_{suffix}", verts, faces, M["eye"])
    ellipsoid(f"Eye_Iris_{suffix}", (cx - side * .007, -.427, cz + .004), (.037, .008, .038), M["iris"], 40, 20)
    ellipsoid(f"Eye_Pupil_{suffix}", (cx - side * .007, -.435, cz + .004), (.019, .005, .023), M["pupil"], 32, 20)
    ellipsoid(f"Eye_Catchlight_{suffix}", (cx - side * .007 - .010, -.441, cz + .017), (.007, .003, .007), M["catchlight"], 20, 12)
    upper, lower = [], []
    for i in range(29):
        t = math.pi * i / 28
        dx = .127 * math.cos(t)
        upper.append((cx + dx, -.399, cz + .059 * math.sin(t) ** 1.2 + .009 * side * dx / .127))
        lower.append((cx + dx, -.399, cz - .044 * math.sin(t) ** 1.2 + .009 * side * dx / .127))
    tube(f"Eye_UpperLid_{suffix}", upper, .010, M["skin"], 10)
    tube(f"Eye_LowerLid_{suffix}", lower, .008, M["skin"], 10)
    line(f"Eyebrow_{suffix}", [
        (side * .094, -.362, 2.596),
        (side * .172, -.378, 2.620 + (.007 if side == -1 else 0)),
        (side * .274, -.348, 2.613),
        (side * .343, -.303, 2.583),
    ], .020, M["hair"])


almond_eye(-1, "L")
almond_eye(1, "R")

# Slight asymmetric smile. The lip volumes remain separate editable meshes.
line("Face_MouthCrease", [
    (-.132, -.324, 2.131), (-.083, -.357, 2.115), (-.028, -.374, 2.111),
    (.027, -.375, 2.113), (.080, -.360, 2.123), (.134, -.328, 2.144),
], .0065, M["crease"])
line("Face_UpperLip", [
    (-.119, -.331, 2.135), (-.066, -.366, 2.130),
    (-.024, -.378, 2.137), (.000, -.383, 2.130),
    (.025, -.380, 2.138), (.070, -.366, 2.139), (.121, -.338, 2.147),
], .007, M["lip"])
line("Face_LowerLip", [
    (-.112, -.334, 2.122), (-.062, -.367, 2.106),
    (.000, -.381, 2.100), (.063, -.369, 2.114), (.121, -.337, 2.136),
], .008, M["lip"])

# Circular acetate spectacles and proper temples/hinges.
for side, suffix in [(-1, "L"), (1, "R")]:
    cx, cz = side * .218, 2.463
    points = []
    for i in range(96):
        angle = TAU * i / 96
        x = cx + .176 * math.cos(angle)
        y = -.470 + .041 * abs(x / .394) ** 2
        z = cz + .164 * math.sin(angle)
        points.append((x, y, z))
    tube(f"Glasses_RoundRim_{suffix}", points, .014, M["frame"], sides=10, closed=True)
    # Very light transparent lenses, integrated in GLB with no external textures.
    center = (cx, -.468 + .041 * abs(cx / .394) ** 2, cz)
    lens_vertices = [center] + [(x, y + .003, z) for x, y, z in points]
    lens_faces = [(0, 1 + i, 1 + (i + 1) % len(points)) for i in range(len(points))]
    mesh_object(f"Glasses_Lens_{suffix}", lens_vertices, lens_faces, M["lens"])
    line(f"Glasses_Temple_{suffix}", [
        (side * .388, -.429, 2.478),
        (side * .480, -.303, 2.470),
        (side * .515, -.030, 2.453),
        (side * .520, .085, 2.405),
    ], .012, M["frame"])
    ellipsoid(f"Glasses_Hinge_{suffix}", (side * .392, -.431, 2.478), (.025, .016, .012), M["metal"], 24, 12)
line("Glasses_Bridge", [
    (-.044, -.468, 2.480), (-.024, -.488, 2.501),
    (.000, -.493, 2.507), (.024, -.488, 2.501), (.044, -.468, 2.480),
], .011, M["frame"])
for side in [-1, 1]:
    ellipsoid(f"Glasses_NosePad_{side}", (side * .052, -.446, 2.436), (.013, .009, .023), M["metal"], 20, 12)

# A continuous short-hair shell with a shaped hairline and sculpted comb ridges.
def hair_surface(phi, u, ridge=True):
    front = max(0, math.cos(phi))
    side = abs(math.sin(phi))
    hairline = 2.455 + .408 * front ** 2 + .056 * side
    # An uneven side part and a subtle widow's peak prevent a helmet silhouette.
    hairline += .045 * math.sin(phi + .4) * front ** 5
    radial = math.cos(u * math.pi / 2)
    crest = math.sin(u * math.pi / 2)
    x = .520 * math.sin(phi) * radial - .055 * crest ** 3
    y = .040 - .421 * math.cos(phi) * radial + .030 * crest ** 2
    z = hairline + (3.205 - hairline) * crest
    if ridge:
        wave = math.cos(phi * 17 + 3.1 * u + .5 * math.sin(phi * 2))
        amp = .008 * math.sin(math.pi * u) ** .7
        z += amp * wave
        x += amp * wave * math.sin(phi) * .6
        y -= amp * wave * math.cos(phi) * .6
    return Vector((x, y, z))


hair_vertices, hair_faces = [], []
hair_segments, hair_rings = 112, 34
for ring in range(hair_rings):
    u = ring / (hair_rings - 1) * .998
    for j in range(hair_segments):
        hair_vertices.append(tuple(hair_surface(TAU * j / hair_segments, u)))
for ring in range(hair_rings - 1):
    for j in range(hair_segments):
        k = (j + 1) % hair_segments
        hair_faces.append((ring * hair_segments + j, ring * hair_segments + k,
                           (ring + 1) * hair_segments + k, (ring + 1) * hair_segments + j))
hair_faces.append(tuple((hair_rings - 1) * hair_segments + j for j in range(hair_segments)))
hair = mesh_object("Hair_ContinuousSculptedCap", hair_vertices, hair_faces, M["hair"])
mod = hair.modifiers.new("Hairline thickness", "SOLIDIFY")
mod.thickness = .017
for side, suffix in [(-1, "L"), (1, "R")]:
    polygon_solid(f"Hair_Sideburn_{suffix}", [
        (side * .472, -.059, 2.621), (side * .496, .023, 2.587),
        (side * .489, .027, 2.450), (side * .467, -.036, 2.480),
    ], M["hair"], .025, .012)

# Flatter tapered locks follow the shell, making the hair an editable sculpture.
for i in range(13):
    phi_start = -1.18 + i * .162
    points = []
    radii = []
    for j in range(24):
        t = j / 23
        u = .035 + t * (.83 if i < 9 else .63)
        phi = phi_start + .47 * math.sin(t * math.pi / 2)
        p = hair_surface(phi, u)
        p.z += .013
        p.y -= .010 * (1 - t)
        points.append(p)
        width = (.025 + .010 * math.sin(i * .7) ** 2) * math.sin(math.pi * (.10 + .86 * t)) ** .5
        radii.append((width, .010 * math.sin(math.pi * (.10 + .86 * t)) ** .7))
    tube(f"Hair_CombedLock_{i + 1:02d}", points, radii, M["hair_highlight"] if i % 3 == 0 else M["hair"], sides=8)
part_points = []
for j in range(30):
    t = j / 29
    p = hair_surface(.52 + .43 * t, .01 + .72 * t)
    p.z += .010
    part_points.append(p)
tube("Hair_SidePart", part_points, .006, M["hair_highlight"], sides=8)

# Organize the project into logical, editable collections.
collections = {}
for key in ["01 · Face & skin", "02 · Hair", "03 · Eyewear", "04 · Clothing", "05 · Hands", "06 · Studio"]:
    col = bpy.data.collections.new(key)
    scene.collection.children.link(col)
    collections[key] = col
for obj in list(scene.objects):
    if obj.type != "MESH":
        continue
    if obj.name.startswith(("Hair_", "Eyebrow")):
        key = "02 · Hair"
    elif obj.name.startswith("Glasses_"):
        key = "03 · Eyewear"
    elif obj.name.startswith(("Jacket_", "Shirt_")):
        key = "04 · Clothing"
    elif obj.name.startswith("Hand_"):
        key = "05 · Hands"
    else:
        key = "01 · Face & skin"
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collections[key].objects.link(obj)


def track(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, location, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
    obj = bpy.data.objects.new(name, data)
    collections["06 · Studio"].objects.link(obj)
    obj.location = location
    track(obj, (0, 0, 1.7))
    return obj


area("Studio_KeySoftbox", (-3.7, -4.2, 6.2), 700, (1.0, .89, .75), 4.2)
area("Studio_FillSoftbox", (3.4, -2.2, 3.9), 450, (.80, .88, 1.0), 3.8)
area("Studio_HairRim", (1.1, 3.3, 5.5), 900, (1.0, .93, .80), 3.0)
area("Studio_FrontBounce", (0, -4.3, 1.1), 90, (1, .95, .86), 3.0)
camera_data = bpy.data.cameras.new("Portrait_Camera")
camera = bpy.data.objects.new("Portrait_Camera", camera_data)
collections["06 · Studio"].objects.link(camera)
camera.location = (3.8, -9.8, 4.2)
track(camera, (0, -.015, 1.62))
camera_data.type = "ORTHO"
camera_data.ortho_scale = 3.65
camera_data.lens = 65
scene.camera = camera
scene.world.color = (.25, .25, .25)
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.30, .35, .32, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .32
scene.render.engine = "CYCLES"
scene.cycles.samples = 72
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.filepath = str(OUT / "character-poster.png")
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -.12
scene.render.image_settings.compression = 30

# Persist modelling-level geometry and modifiers in .blend. Only evaluated
# meshes and PBR materials go into the self-contained web asset.
bpy.ops.object.select_all(action="DESELECT")
mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = head
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "character.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "character.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
)
bpy.ops.render.render(write_still=True)

depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated_vertices = []
triangles = 0
for obj in mesh_objects:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    triangles += len(mesh.loop_triangles)
    evaluated_vertices += [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    evaluated.to_mesh_clear()
minimum = [min(v[i] for v in evaluated_vertices) for i in range(3)]
maximum = [max(v[i] for v in evaluated_vertices) for i in range(3)]
info = {
    "name": "Portrait No. 01 — The thoughtful maker",
    "status": "original-demo",
    "reference": "none",
    "likenessClaim": False,
    "description": "Original stylized half-body character. No portrait was supplied; this asset is not a likeness reconstruction.",
    "workflow": "Blender Python → editable .blend → self-contained PBR .glb → Three.js",
    "generator": "scripts/build_portfolio_character.py",
    "assets": {
        "blend": "character.blend",
        "glb": "character.glb",
        "poster": "character-poster.png",
    },
    "axes": {"blenderUp": "+Z", "blenderFront": "-Y", "gltfUp": "+Y", "gltfFront": "+Z"},
    "origin": "Torso center, feet/bust base at z=0",
    "dimensionsBlender": [round(maximum[i] - minimum[i], 5) for i in range(3)],
    "boundsBlender": {"min": [round(x, 5) for x in minimum], "max": [round(x, 5) for x in maximum]},
    "meshCount": len(mesh_objects),
    "triangleCount": triangles,
    "materialNames": sorted({mat.name for obj in mesh_objects for mat in obj.data.materials}),
    "recolorMaterial": "Clothing_Jacket",
    "recommendedCameraGltf": {"position": [3.8, 4.2, 9.8], "target": [0, 1.62, 0.015], "orthographicHeight": 3.65},
    "poster": {"width": 1200, "height": 1500, "transparent": True},
    "files": {
        name: {"bytes": (OUT / name).stat().st_size}
        for name in ["character.blend", "character.glb", "character-poster.png"]
    },
    "generatedInSeconds": round(time.time() - START, 2),
}
(OUT / "model-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(info, ensure_ascii=True, indent=2))
