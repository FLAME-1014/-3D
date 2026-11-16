"""Reconstruct the browser's exact tower geometry as editable Blender meshes.

Run through `node scripts/build-eiffel-assets.mjs`; no external packages required.
Source is Y-up, Blender is Z-up, and the GLB exporter restores Y-up.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
data = json.loads(Path(args.input).read_text(encoding="utf-8"))
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1
scene["description"] = "Procedural architectural interpretation of the Eiffel Tower, Paris. Approximate dimensions."
scene["source_sha256"] = data["sourceSha256"]
scene["units"] = "meters"
scene["nominal_height_m"] = data["nominalHeight"]
scene["source"] = data["source"]

materials = []
for entry in data["materials"]:
    mat = bpy.data.materials.new(entry["name"])
    mat.use_nodes = True
    mat.diffuse_color = (*entry["color"], entry["alpha"])
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = mat.diffuse_color
    principled.inputs["Metallic"].default_value = entry["metallic"]
    principled.inputs["Roughness"].default_value = entry["roughness"]
    principled.inputs["Alpha"].default_value = entry["alpha"]
    principled.inputs["Emission Color"].default_value = (*entry["emissive"], 1)
    principled.inputs["Emission Strength"].default_value = entry["emissiveIntensity"]
    if entry["alpha"] < 1:
        mat.surface_render_method = "DITHERED"
    if entry["unlit"]:
        tree = mat.node_tree
        tree.nodes.clear()
        output = tree.nodes.new("ShaderNodeOutputMaterial")
        emission = tree.nodes.new("ShaderNodeEmission")
        emission.inputs["Color"].default_value = (*entry["color"], 1)
        transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
        mix = tree.nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = entry["alpha"]
        tree.links.new(transparent.outputs[0], mix.inputs[1])
        tree.links.new(emission.outputs[0], mix.inputs[2])
        tree.links.new(mix.outputs[0], output.inputs["Surface"])
    materials.append(mat)

tower_collection = bpy.data.collections.new("Eiffel Tower · 330 m")
scene.collection.children.link(tower_collection)
stage_collections = []
stage_objects = []
for stage in data["stages"]:
    collection = bpy.data.collections.new(f'{stage["index"] + 1:02d} · {stage["title"]}')
    tower_collection.children.link(collection)
    parent = bpy.data.objects.new(stage["name"], None)
    collection.objects.link(parent)
    parent["construction_stage"] = stage["index"] + 1
    parent["title"] = stage["title"]
    stage_collections.append(collection)
    stage_objects.append(parent)

tower_objects = list(stage_objects)
vertex_count = 0
for index, batch in enumerate(data["batches"]):
    geometry = data["geometries"][batch["geometry"]]
    local_positions = [Vector(geometry["positions"][i:i + 3]) for i in range(0, len(geometry["positions"]), 3)]
    local_normals = [Vector(geometry["normals"][i:i + 3]) for i in range(0, len(geometry["normals"] or []), 3)]
    vertices, normals, faces = [], [], []
    for values in batch["transforms"]:
        matrix = Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()
        normal_matrix = matrix.to_3x3().inverted_safe().transposed()
        base = len(vertices)
        for position in local_positions:
            transformed = matrix @ position
            vertices.append((transformed.x, -transformed.z, transformed.y))
        for normal in local_normals:
            transformed = (normal_matrix @ normal).normalized()
            normals.append((transformed.x, -transformed.z, transformed.y))
        indices = geometry["indices"]
        for i in range(0, len(indices), 3):
            faces.append(tuple(base + value for value in indices[i:i + 3]))
    mesh = bpy.data.meshes.new(f'Ironwork {index + 1:02d}')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(materials[batch["material"]])
    mesh.update()
    if normals:
        for face in mesh.polygons:
            face.use_smooth = True
        mesh.normals_split_custom_set_from_vertices(normals)
    obj = bpy.data.objects.new(f'{batch["name"]} · {index + 1:02d}', mesh)
    stage_collections[batch["stage"]].objects.link(obj)
    obj.parent = stage_objects[batch["stage"]]
    obj["source_instances"] = len(batch["transforms"])
    obj["construction_stage"] = batch["stage"] + 1
    tower_objects.append(obj)
    vertex_count += len(vertices)

presentation = bpy.data.collections.new("Presentation · cameras and lights")
scene.collection.children.link(presentation)

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("Architectural camera")
camera = bpy.data.objects.new("Architectural camera", camera_data)
presentation.objects.link(camera)
camera.location = (370, -530, 260)
camera_data.lens = 49
camera_data.clip_end = 2500
point_at(camera, (0, 0, 162))
scene.camera = camera
for name, location, energy, size in [
    ("Warm key", (160, -200, 340), 2200000, 230),
    ("Soft fill", (-210, -20, 200), 1200000, 180),
]:
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    presentation.objects.link(light)
    light.location = location
    point_at(light, (0, 0, 140))
sun_data = bpy.data.lights.new("Paris afternoon sun", "SUN")
sun_data.energy = 2.5
sun_data.angle = math.radians(7)
sun = bpy.data.objects.new("Paris afternoon sun", sun_data)
presentation.objects.link(sun)
sun.rotation_euler = (math.radians(30), math.radians(-20), math.radians(-25))
scene.world.color = (0.12, 0.15, 0.19)
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.render.resolution_x = 1200
scene.render.resolution_y = 1600
scene.render.resolution_percentage = 100

# Only the actual tower enters the portable GLB; the blend retains its studio.
bpy.ops.object.select_all(action="DESELECT")
for obj in tower_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = tower_objects[-1]
bpy.ops.export_scene.gltf(
    filepath=str(out / "eiffel-tower.glb"), export_format="GLB",
    use_selection=True, export_yup=True, export_cameras=False,
    export_lights=False, export_extras=True, export_materials="EXPORT",
    export_animations=False,
)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.clip_end = 3000
            area.spaces.active.region_3d.view_distance = 550
            area.spaces.active.region_3d.view_location = (0, 0, 160)
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=str(out / "eiffel-tower.blend"))
# Exercise Blender's own file reader, including its native compressed format.
bpy.ops.wm.open_mainfile(filepath=str(out / "eiffel-tower.blend"))
readback_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
readback_stages = [obj for obj in bpy.context.scene.objects if obj.type == "EMPTY" and "construction_stage" in obj]
assert len(readback_meshes) == len(data["batches"]), "Saved Blender meshes did not reopen"
assert len(readback_stages) == 6, "Saved Blender construction stages did not reopen"
assert bpy.context.scene.camera is not None, "Saved Blender camera did not reopen"
info = {
    "title": data["title"],
    "description": "Procedural architectural interpretation; approximate Eiffel Tower dimensions and detailing.",
    "source": data["source"],
    "sourceSha256": data["sourceSha256"],
    "units": "meters",
    "nominalHeightMeters": data["nominalHeight"],
    "nominalBaseWidthMeters": data["nominalBaseWidth"],
    "glbUpAxis": "Y",
    "blenderUpAxis": "Z",
    "boundsYUp": data["bounds"],
    "constructionStages": data["stages"],
    "materialCount": len(materials),
    "meshBatches": len(data["batches"]),
    "sourceInstances": data["instances"],
    "verticesBeforeExport": vertex_count,
    "triangles": data["triangles"],
    "glbBytes": (out / "eiffel-tower.glb").stat().st_size,
    "blendBytes": (out / "eiffel-tower.blend").stat().st_size,
    "blenderVersion": bpy.app.version_string,
    "blendReadback": {"passed": True, "meshes": len(readback_meshes), "stages": len(readback_stages), "camera": True},
    "exportIncludes": "Tower geometry, six stage groups, PBR materials; studio camera and lights are saved only in the .blend.",
}
(out / "model-info.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
print(json.dumps(info, indent=2))
