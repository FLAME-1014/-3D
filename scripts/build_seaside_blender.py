"""Build a small low-poly seaside hotel and export it for the web."""

from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "canton-atlas" / "web" / "blender-workflow"
OUT.mkdir(parents=True, exist_ok=True)
BLEND_PATH = OUT / "seaside-hotel.blend"
GLB_PATH = OUT / "seaside-hotel.glb"
RENDER_PATH = OUT / "seaside-hotel.png"


def material(name, color, roughness=0.8, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


MAT = {
    "sand": material("Sandstone | warm ivory", (0.76, 0.65, 0.48)),
    "white": material("Facade | chalk white", (0.88, 0.86, 0.78)),
    "terracotta": material("Terracotta | roof and screens", (0.68, 0.25, 0.13)),
    "glass": material("Glass | sea teal", (0.12, 0.42, 0.48), 0.22, 0.25),
    "dark": material("Frame | deep bronze", (0.16, 0.19, 0.18), 0.38, 0.35),
    "ground": material("Ground | coastal stone", (0.68, 0.63, 0.52)),
    "green": material("Foliage | island green", (0.19, 0.39, 0.25)),
    "trunk": material("Palm | warm wood", (0.39, 0.27, 0.16)),
    "water": material("Water | muted blue", (0.19, 0.46, 0.56), 0.35),
}


def cube(name, location, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name} Mesh"
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj["building"] = name.startswith(("Hotel |", "Lobby |", "Facade |", "Atrium |"))
    if bevel:
        mod = obj.modifiers.new("Soft stone edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj


def roof(name, location, radius, depth, mat, vertices=4, rotation=math.pi / 4):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius, radius2=0.0, depth=depth,
        location=location, rotation=(0, 0, rotation),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def palm(index, x, y, height=2.0):
    cube(f"Palm {index:02} | trunk", (x, y, height / 2), (0.16, 0.16, height), MAT["trunk"], 0.035)
    crown = Vector((x, y, height))
    for i in range(6):
        angle = i * math.tau / 6
        end = crown + Vector((math.cos(angle) * 0.9, math.sin(angle) * 0.9, 0.2))
        mid = (crown + end) / 2
        vec = end - crown
        bpy.ops.mesh.primitive_cone_add(
            vertices=5, radius1=0.12, radius2=0.0, depth=vec.length,
            location=mid,
        )
        frond = bpy.context.object
        frond.name = f"Palm {index:02} | frond {i + 1}"
        frond.rotation_mode = "QUATERNION"
        frond.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(vec.normalized())
        frond.data.materials.append(MAT["green"])


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


reset_scene()

# A broad landscaped plinth and a narrow strip of calm coastal water.
cube("Site | landscaped island", (0, 0, -0.28), (22, 18, 0.55), MAT["ground"], 0.22)
cube("Coast | water strip", (0, -10, -0.53), (30, 5, 0.14), MAT["water"])
cube("Entry | stone forecourt", (0, -5.0, 0.02), (11, 4.0, 0.18), MAT["sand"], 0.05)

# Main three-storey bar, stepped podium and overhanging roof.
cube("Hotel | podium", (0, 0, 0.48), (13, 8.4, 0.9), MAT["sand"], 0.12)
cube("Hotel | ground floor", (0, 0.2, 1.65), (11.4, 6.7, 1.65), MAT["white"], 0.05)
cube("Hotel | first floor", (0, 0.45, 3.35), (10.9, 6.2, 1.55), MAT["sand"], 0.04)
cube("Hotel | second floor", (0, 0.45, 4.95), (10.4, 5.8, 1.55), MAT["white"], 0.04)
cube("Hotel | roof slab", (0, 0.45, 5.85), (11.2, 6.6, 0.30), MAT["terracotta"], 0.06)

# Recessed glass lobby and a readable entrance portal.
cube("Lobby | glass curtain wall", (0, -3.23, 1.72), (7.1, 0.10, 1.40), MAT["glass"])
for i, x in enumerate((-0.43, 0.43), start=1):
    cube(f"Lobby | entrance door {i}", (x, -3.34, 1.65), (0.82, 0.08, 1.35), MAT["glass"])
    cube(f"Lobby | door handle {i}", (x * 0.3, -3.42, 1.65), (0.035, 0.04, 0.3), MAT["dark"])
for x in (-0.87, 0, 0.87):
    cube("Lobby | door frame", (x, -3.40, 1.65), (0.045, 0.06, 1.40), MAT["dark"])
for x in (-3.65, 3.65):
    cube("Lobby | bronze mullion", (x, -3.31, 1.72), (0.12, 0.12, 1.50), MAT["dark"])
cube("Lobby | entrance canopy", (0, -3.8, 2.55), (3.4, 1.1, 0.16), MAT["terracotta"], 0.035)
for x in (-1.45, 1.45):
    cube("Lobby | canopy column", (x, -3.95, 1.35), (0.16, 0.18, 2.45), MAT["dark"])

# Repeated independent guest-room window modules across the front facade.
for floor, z in enumerate((3.35, 4.95), start=1):
    for i, x in enumerate((-4.25, -2.55, -0.85, 0.85, 2.55, 4.25), start=1):
        cube(f"Facade | floor {floor} window {i:02}", (x, -2.70, z), (1.05, 0.10, 0.94), MAT["glass"])
        cube(f"Facade | floor {floor} sill {i:02}", (x, -2.78, z - 0.51), (1.18, 0.16, 0.12), MAT["terracotta"])
    cube(f"Facade | floor {floor} balcony rail", (0, -3.03, z - 0.21), (9.9, 0.10, 0.08), MAT["dark"])

# A glazed corner wing adds a distinct vertical accent.
cube("Atrium | east glass wing", (5.79, 0.0, 2.95), (0.12, 4.4, 4.9), MAT["glass"])
for y in (-1.9, -0.95, 0, 0.95, 1.9):
    cube("Atrium | vertical bronze fin", (5.89, y, 2.95), (0.10, 0.10, 5.0), MAT["dark"])
for z in (0.95, 2.35, 3.75, 5.15):
    cube("Atrium | bronze transom", (5.89, 0, z), (0.11, 4.5, 0.10), MAT["dark"])

# Low-poly planting beds and palms around the public forecourt.
for i, x in enumerate((-7.6, -5.8, 5.8, 7.6), start=1):
    cube(f"Landscape | planter {i}", (x, -4.4, 0.23), (1.25, 1.2, 0.45), MAT["white"], 0.08)
    roof(f"Landscape | shrub {i}", (x, -4.4, 0.75), 0.55, 0.85, MAT["green"], vertices=6)
for i, (x, y) in enumerate(((-8, -1.4), (8, -1.4), (-8, 4.2), (8, 4.2)), start=1):
    palm(i, x, y, 1.8 + (i % 2) * 0.3)

# Presentation lighting and orthographic camera for a clean isometric render.
world = bpy.context.scene.world
world.color = (0.18, 0.18, 0.18)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.68, 0.76, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

bpy.ops.object.light_add(type="AREA", location=(-8, -10, 14))
key = bpy.context.object
key.name = "Lighting | large softbox"
key.data.energy = 1800
key.data.shape = "DISK"
key.data.size = 9

bpy.ops.object.camera_add(location=(16, -21, 16))
camera = bpy.context.object
camera.name = "Camera | isometric hero"
target = Vector((0, -0.2, 2.2))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 27
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.fps = 30
scene["asset_description"] = "Seaside House: stylized three-storey hotel; one unit = one metre."
scene["architectural_dimensions_m"] = "Main building: 13 x 8.4 x 6.0; site: 22 x 18."
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(RENDER_PATH)
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

# Save the editable source, render a review image, and export only scene assets.
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_extras=True,
    export_cameras=False,
    export_lights=False,
)
print(f"Saved {BLEND_PATH}")
print(f"Exported {GLB_PATH}")
print(f"Rendered {RENDER_PATH}")
