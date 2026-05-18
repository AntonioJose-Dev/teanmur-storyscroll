"""
blender_render.py
─────────────────
Blender headless script: creates TEANMUR paint can + renders 115 frames.
Run with:  blender --background --python blender_render.py

Output: public/frames/frame_0001.jpg → frame_0115.jpg  (1280×668)
"""

import bpy
import math
import os

# ─── Output path ─────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR  = os.path.join(SCRIPT_DIR, 'public', 'frames')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── Scene reset ─────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end   = 115
scene.render.fps  = 24

# ─── Render settings ─────────────────────────────────────────────────────────
scene.render.engine              = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x        = 1280
scene.render.resolution_y        = 668
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format  = 'JPEG'
scene.render.image_settings.quality      = 95
scene.render.filepath = os.path.join(OUTPUT_DIR, 'frame_')
scene.render.use_file_extension  = False

# EEVEE settings
eevee = scene.eevee
eevee.taa_render_samples  = 64
eevee.use_bloom           = True
eevee.bloom_threshold     = 0.8
eevee.bloom_intensity     = 0.05

# ─── World (pure black) ───────────────────────────────────────────────────────
world = bpy.data.worlds.new('World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.02, 0.025, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0
scene.world = world

# ─── Material factory ─────────────────────────────────────────────────────────
def make_material(name, base_color, metallic, roughness, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value    = (*base_color, 1)
    bsdf.inputs['Metallic'].default_value      = metallic
    bsdf.inputs['Roughness'].default_value     = roughness

    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

mat_body   = make_material('CanBody',  (0.04, 0.04, 0.045), 0.15, 0.82)
mat_gold   = make_material('CanGold',  (0.79, 0.63, 0.22),  1.00, 0.18)
mat_handle = make_material('Handle',   (0.10, 0.10, 0.12),  0.85, 0.55)
mat_band   = make_material('BotBand',  (0.03, 0.03, 0.035), 0.10, 0.90)
mat_lid    = make_material('LidTop',   (0.75, 0.60, 0.20),  1.00, 0.22)

# ─── Geometry helpers ─────────────────────────────────────────────────────────
def apply_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def add_cylinder(name, radius, depth, location, mat, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    apply_material(obj, mat)
    return obj

def add_torus(name, major_r, minor_r, location, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r, minor_radius=minor_r,
        major_segments=64, minor_segments=24,
        location=location)
    obj = bpy.context.active_object
    obj.name = name
    apply_material(obj, mat)
    return obj

# ─── Can geometry ─────────────────────────────────────────────────────────────
# All Y-up in Blender; camera looks from front (-Y)

body_height = 2.20
body_radius = 1.00
body_z      = 0.0      # centre of body

# Main cylinder body
body = add_cylinder('Body', body_radius, body_height,
                    (0, 0, body_z), mat_body)

# Decorative bottom band (slightly inset, dark)
band = add_cylinder('BottomBand', body_radius * 0.99, 0.38,
                    (0, 0, body_z - body_height/2 + 0.19), mat_band)

# Gold collar / lid ring
ring_z = body_z + body_height / 2
ring   = add_torus('LidRing', body_radius * 1.035, 0.09, (0, 0, ring_z), mat_gold)

# Lid disc
lid_z  = ring_z + 0.04
lid    = add_cylinder('Lid', body_radius * 1.06, 0.10, (0, 0, lid_z), mat_lid, 64)

# Tiny top cap (dark metallic rim)
top_rim = add_cylinder('TopRim', body_radius * 1.055, 0.025,
                        (0, 0, lid_z + 0.06), mat_gold, 64)

# Handle brackets (left + right)
brk_x    = body_radius * 0.70
brk_z_lo = ring_z
brk_z_hi = ring_z + 0.30

bpy.ops.mesh.primitive_cylinder_add(
    vertices=12, radius=0.055, depth=0.32,
    location=(-brk_x, 0, brk_z_lo + 0.16))
bpy.context.active_object.name = 'BracketL'
bpy.context.active_object.rotation_euler = (0, math.radians(8), 0)
apply_material(bpy.context.active_object, mat_handle)
brk_l = bpy.context.active_object

bpy.ops.mesh.primitive_cylinder_add(
    vertices=12, radius=0.055, depth=0.32,
    location=(brk_x, 0, brk_z_lo + 0.16))
bpy.context.active_object.name = 'BracketR'
bpy.context.active_object.rotation_euler = (0, math.radians(-8), 0)
apply_material(bpy.context.active_object, mat_handle)
brk_r = bpy.context.active_object

# Handle arc — curve object
curve_data = bpy.data.curves.new('HandleArc', 'CURVE')
curve_data.dimensions = '3D'
curve_data.bevel_depth  = 0.045
curve_data.bevel_resolution = 4
spline = curve_data.splines.new('BEZIER')
spline.bezier_points.add(2)   # 3 points total

pts = spline.bezier_points
# Left end
pts[0].co             = (-brk_x, 0, brk_z_hi)
pts[0].handle_left    = (-brk_x - 0.2, 0, brk_z_hi - 0.1)
pts[0].handle_right   = (-brk_x + 0.3, 0, brk_z_hi + 0.55)
# Top peak
pts[1].co             = (0, 0, ring_z + 1.10)
pts[1].handle_left    = (-0.55, 0, ring_z + 1.10)
pts[1].handle_right   = ( 0.55, 0, ring_z + 1.10)
# Right end
pts[2].co             = (brk_x, 0, brk_z_hi)
pts[2].handle_left    = (brk_x - 0.3, 0, brk_z_hi + 0.55)
pts[2].handle_right   = (brk_x + 0.2, 0, brk_z_hi - 0.1)

handle_obj = bpy.data.objects.new('Handle', curve_data)
scene.collection.objects.link(handle_obj)
apply_material(handle_obj, mat_handle)

# ─── Text — TEANMUR ───────────────────────────────────────────────────────────
def add_text(name, text, size, location, rotation, mat, extrude=0.02):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    td  = obj.data
    td.body  = text
    td.size  = size
    td.extrude = extrude
    td.align_x = 'CENTER'
    td.align_y = 'CENTER'
    apply_material(obj, mat)
    return obj

text_r   = body_radius * 1.002   # just outside surface
text_ang = 0   # front face angle (radians from -Y)

txt_main = add_text(
    'TextMain', 'TEANMUR', 0.24,
    location=(0, -text_r, body_z + 0.22),
    rotation=(math.pi/2, 0, 0),
    mat=mat_gold, extrude=0.015)

txt_sub = add_text(
    'TextSub', 'PREMIUM INDUSTRIAL PAINT', 0.085,
    location=(0, -text_r, body_z - 0.02),
    rotation=(math.pi/2, 0, 0),
    mat=mat_gold, extrude=0.008)

txt_ltr = add_text(
    'TextLtr', '20 Litros  |  Professional Grade', 0.065,
    location=(0, -text_r, body_z - 0.18),
    rotation=(math.pi/2, 0, 0),
    mat=mat_gold, extrude=0.005)

# ─── Camera ───────────────────────────────────────────────────────────────────
bpy.ops.object.camera_add(location=(0, -5.8, 0.40))
cam = bpy.context.active_object
cam.name = 'Camera'
cam.data.lens       = 85
cam.data.clip_start = 0.1
cam.data.clip_end   = 100
# Point at can centre
cam.rotation_euler = (math.radians(90), 0, 0)

scene.camera = cam

# ─── Lighting ─────────────────────────────────────────────────────────────────
def add_light(name, type_, location, energy, color=(1,1,1), size=2.5):
    bpy.ops.object.light_add(type=type_, location=location)
    lgt = bpy.context.active_object
    lgt.name = lgt.data.name = name
    lgt.data.energy = energy
    lgt.data.color  = color
    if type_ == 'AREA':
        lgt.data.size = size
    return lgt

# Key light: left-front, soft white
key = add_light('KeyLight', 'AREA', (-3.5, -3.5, 4.0), 1200,
                color=(1.0, 0.97, 0.92), size=3.0)
key.rotation_euler = (math.radians(55), 0, math.radians(-40))

# Fill light: right, warm, dim
fill = add_light('FillLight', 'AREA', (3.0, -2.5, 1.5), 280,
                 color=(1.0, 0.90, 0.75), size=4.0)
fill.rotation_euler = (math.radians(70), 0, math.radians(40))

# Rim light: behind+top, cool, separates from background
rim = add_light('RimLight', 'AREA', (0.5, 4.0, 3.5), 600,
                color=(0.85, 0.92, 1.0), size=2.0)
rim.rotation_euler = (math.radians(-40), 0, math.radians(5))

# ─── Animation (keyframes) ────────────────────────────────────────────────────
#
# lid_group  = ring + lid + top_rim + both brackets + handle
# lid moves up (Z) frames 21-40, returns frames 91-115
# handle extra offset frames 41-60, returns 91-115

LID_DZ     = 1.10   # how far lid rises (Blender units)
HANDLE_DZ  = 0.50   # extra handle rise

lid_group   = [ring, lid, top_rim, brk_l, brk_r, handle_obj]
handle_only = [handle_obj]

def insert_loc(obj, frame, location=None):
    if location:
        obj.location = location
    obj.keyframe_insert('location', frame=frame)

# Store base Z positions
base_z = { o: o.location.z for o in lid_group }

def set_lid_z(frame, lid_dz, hdl_dz):
    for obj in lid_group:
        z = base_z[obj] + lid_dz
        if obj is handle_obj:
            z += hdl_dz
        obj.location.z = z
        obj.keyframe_insert('location', frame=frame)

# Smooth interpolation helper (set handle type to AUTO_CLAMPED after)
keyframes = [
    # (frame, lid_dz, handle_extra_dz)
    (1,   0.0,     0.0),
    (20,  0.0,     0.0),
    (40,  LID_DZ,  0.0),
    (60,  LID_DZ,  HANDLE_DZ),
    (90,  LID_DZ,  HANDLE_DZ),
    (115, 0.0,     0.0),
]

for fr, ldz, hdz in keyframes:
    set_lid_z(fr, ldz, hdz)

# Smooth out all fcurves
for obj in lid_group:
    if obj.animation_data and obj.animation_data.action:
        for fc in obj.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type  = 'AUTO_CLAMPED'
                kp.handle_right_type = 'AUTO_CLAMPED'

# Light glow keyframes (frames 61-90): key light energy peaks
glow_frames = [
    (60,  1200),
    (75,  2200),
    (90,  1200),
]
for fr, eng in glow_frames:
    key.data.energy = eng
    key.data.keyframe_insert('energy', frame=fr)

# ─── Render all frames ────────────────────────────────────────────────────────
print(f'\n[TEANMUR] Rendering 115 frames → {OUTPUT_DIR}')
print('[TEANMUR] Engine: EEVEE  |  1280×668  |  JPEG 95\n')

for f in range(1, 116):
    scene.frame_set(f)
    out_path = os.path.join(OUTPUT_DIR, f'frame_{f:04d}.jpg')
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    if f % 10 == 0 or f == 1 or f == 115:
        print(f'[TEANMUR] frame {f:03d}/115 done → {out_path}')

print('\n[TEANMUR] Render complete.')
