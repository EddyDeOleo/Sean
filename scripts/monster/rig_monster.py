"""Rig the monster model and bake its animation clips (run inside Blender in background mode).

    blender -b --python scripts/monster/rig_monster.py -- <input.glb> <output.glb>

The input must be an uncompressed GLB (Blender does not read EXT_meshopt_compression). The output is
uncompressed too; compress it afterwards with `gltf-transform meshopt` (see build_monster_assets.ps1).

What it does:
1. Imports the decimated mesh, applies the import transforms, and measures its bounding box.
2. Builds a humanoid skeleton scaled to that box (hips, spine, chest, neck, head, both arms, both legs).
3. Binds the mesh with Blender's automatic (heat) weights.
4. Bakes five actions: idle, walk, run, jumpscare, recovery. Angles are in radians.
5. Exports a GLB with the skin and the actions, in glTF Y-up convention.

Facing: the model's front is -X in Blender space (glTF -X). Forward swing of a limb is a positive rotation about the
lateral axis (+Y); forward lean of the torso is a negative rotation about +Y.
"""
import math
import sys

import bpy
from mathutils import Quaternion, Vector

FPS = 30
IDLE_FRAMES = 120  # 4.0 s
WALK_FRAMES = 30  # 1.0 s stride
RUN_FRAMES = 18  # 0.6 s stride
JUMP_FRAMES = 60  # 2.0 s attack
RECOVERY_FRAMES = 30  # 1.0 s return

SMOOTH_ITERATIONS = 6
LATERAL = Vector((0.0, 1.0, 0.0))
VERTICAL_TWIST = Vector((0.0, 0.0, 1.0))
DEPTH = Vector((1.0, 0.0, 0.0))


def argv_after_dashes():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_mesh(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"expected exactly one mesh object, found {len(meshes)}")
    mesh = meshes[0]
    # Remove the empty parents the importer may add, keeping the mesh's world transform.
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    return mesh


def bounds(mesh):
    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def build_skeleton(mesh):
    (xmin, xmax), (ymin, ymax), (zmin, zmax) = bounds(mesh)
    height = zmax - zmin
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2

    def at(fz, dy=0.0, dx=0.0):
        # fz: fraction of the height from the floor. dy: lateral offset as a fraction of the height. dx: forward (-X) offset.
        return Vector((cx + dx * height, cy + dy * height, zmin + fz * height))

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "MonsterRig"
    arm = arm_obj.data
    arm.name = "MonsterArmature"
    eb = arm.edit_bones
    eb.remove(eb[0])

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
        return b

    # The hips bone spans the pelvis, so the lower torso follows the pelvis and not the legs.
    bone("hips", at(0.40), at(0.56), None)
    bone("spine", at(0.56), at(0.66), "hips")
    bone("chest", at(0.66), at(0.80), "spine")
    bone("neck", at(0.80), at(0.86), "chest")
    bone("head", at(0.86), at(1.00), "neck")
    for side, sign in (("L", 1.0), ("R", -1.0)):
        bone(f"thigh.{side}", at(0.50, 0.05 * sign), at(0.27, 0.055 * sign), "hips")
        bone(f"shin.{side}", at(0.27, 0.055 * sign), at(0.035, 0.05 * sign), f"thigh.{side}")
        bone(f"foot.{side}", at(0.035, 0.05 * sign), at(0.0, 0.05 * sign, 0.07), f"shin.{side}")
        bone(f"shoulder.{side}", at(0.80, 0.04 * sign), at(0.80, 0.11 * sign), "chest")
        bone(f"upper_arm.{side}", at(0.80, 0.11 * sign), at(0.60, 0.14 * sign), f"shoulder.{side}")
        bone(f"forearm.{side}", at(0.60, 0.14 * sign), at(0.42, 0.15 * sign), f"upper_arm.{side}")
        bone(f"hand.{side}", at(0.42, 0.15 * sign), at(0.34, 0.15 * sign), f"forearm.{side}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj, height


def segment_distance(p, a, b):
    ab = b - a
    length_sq = ab.length_squared
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, (p - a).dot(ab) / length_sq))
    return (p - (a + ab * t)).length


def candidate_bones(rel_z, rel_y):
    """The bones a vertex may be weighted to, from its body region. rel_z: height fraction. rel_y: lateral offset fraction."""
    side = "L" if rel_y >= 0 else "R"
    if rel_z < 0.5:
        names = [f"thigh.{side}", f"shin.{side}", f"foot.{side}"]
        if rel_z > 0.36:
            names.append("hips")
        return names
    if abs(rel_y) > 0.085 and 0.36 < rel_z < 0.86:
        return [f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}", f"shoulder.{side}"]
    names = ["hips", "spine", "chest", "neck", "head"]
    if abs(rel_y) > 0.04:
        names.append(f"shoulder.{side}")
    return names


def bind_proximity_weights(mesh, arm_obj, height):
    """Skin weights: region first, then distance to the bone segment inside the region, then smoothing over the mesh.

    Blender's heat weighting failed for some bones on this mesh, so it is not used. A plain distance weighting let torso
    vertices follow the legs, and the mesh tore when the legs moved. The region rule keeps each vertex on the bones of its
    own body part, and the smoothing blends the weights across each joint so no triangle spans two unrelated weights.
    """
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_NAME")
    bones = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm_obj.data.bones}
    groups = {name: mesh.vertex_groups.get(name) or mesh.vertex_groups.new(name=name) for name in bones}
    verts = mesh.data.vertices
    z0 = min(v.co.z for v in verts)
    cy = (min(v.co.y for v in verts) + max(v.co.y for v in verts)) / 2
    falloff = (0.012 * height) ** 2
    weights = []
    for v in verts:
        p = v.co
        rel_z = (p.z - z0) / height
        rel_y = (p.y - cy) / height
        scored = {}
        for name in candidate_bones(rel_z, rel_y):
            head, tail = bones[name]
            d = segment_distance(p, head, tail)
            scored[name] = 1.0 / (d * d + falloff) ** 2
        total = sum(scored.values())
        weights.append({k: w / total for k, w in scored.items()})
    # Neighbour smoothing over the mesh's edges.
    neighbours = [[] for _ in verts]
    for e in mesh.data.edges:
        a, b = e.vertices
        neighbours[a].append(b)
        neighbours[b].append(a)
    for _ in range(SMOOTH_ITERATIONS):
        updated = []
        for i, w in enumerate(weights):
            nb = neighbours[i]
            if not nb:
                updated.append(w)
                continue
            mix = {}
            for k, val in w.items():
                mix[k] = mix.get(k, 0.0) + 0.5 * val
            share = 0.5 / len(nb)
            for j in nb:
                for k, val in weights[j].items():
                    mix[k] = mix.get(k, 0.0) + share * val
            updated.append(mix)
        weights = updated
    for i, w in enumerate(weights):
        top = sorted(w.items(), key=lambda kv: kv[1], reverse=True)[:4]
        total = sum(val for _, val in top)
        for name, val in top:
            groups[name].add([i], val / total, "REPLACE")
    print("WEIGHTS_BOUND", len(verts), "vertices across", len(bones), "bones; smoothing", SMOOTH_ITERATIONS)

def add_axis_rotation(pb, axis_world, angle):
    """Compose a rotation about a world-space axis, expressed in the bone's own rest frame, onto the bone's current pose."""
    rest = pb.bone.matrix_local.to_3x3()
    axis_local = (rest.inverted() @ axis_world).normalized()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(axis_local, angle)


def rest_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = Vector((0, 0, 0))


def hips_translate(arm_obj, dz_fraction, height):
    pb = arm_obj.pose.bones["hips"]
    rest = pb.bone.matrix_local.to_3x3()
    pb.location = rest.inverted() @ Vector((0.0, 0.0, dz_fraction * height))


def ease_in_out(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def pose_idle(p):
    """Slow, uneven breathing and small head and shoulder movements. p is the phase in radians (0 to 2 pi)."""
    breath = math.sin(p)
    return {
        "spine": -(0.02 + 0.02 * breath),
        "chest": -0.015 * math.sin(p + 0.4),
        "neck": -(0.05 + 0.04 * math.sin(2 * p + 1.0)),
        "head_yaw": 0.12 * math.sin(0.5 * p + 0.7) + 0.03 * math.sin(3 * p),
        "head_tilt": 0.08 * math.sin(3 * p + 2.0),
        "shoulder": 0.05 * math.sin(p + 0.5),
        "elbow": -0.12 - 0.04 * breath,
        "thigh": 0.02 * math.sin(p),
        "knee": -(0.04 + 0.03 * math.sin(0.5 * p)),
        "hips_dz": 0.004 * breath,
        "hips_tilt": 0.02 * math.sin(2 * p),
    }


def pose_walk(p):
    """A stride. The legs swing about the lateral axis, the knee bends in the forward swing, the arms counter-swing."""
    s, c = math.sin(p), math.cos(p)
    return {
        "thigh_L": 0.42 * s,
        "thigh_R": -0.42 * s,
        "knee_L": -0.08 - 0.6 * max(0.0, c) ** 2,
        "knee_R": -0.08 - 0.6 * max(0.0, -c) ** 2,
        "shoulder_L": -0.32 * s,
        "shoulder_R": 0.32 * s,
        "elbow": -0.28,
        "spine": -0.05,
        "chest_twist": 0.05 * s,
        "neck": -0.04,
        "head_yaw": -0.05 * s,
        "hips_dz": 0.012 * math.cos(2 * p),
        "hips_tilt": 0.03 * s,
    }


def pose_run(p):
    """A fast stride with a forward lean, bent arms swinging hard, and a head held low and forward."""
    s, c = math.sin(p), math.cos(p)
    return {
        "thigh_L": 0.8 * s,
        "thigh_R": -0.8 * s,
        "knee_L": -0.12 - 1.3 * max(0.0, c) ** 2,
        "knee_R": -0.12 - 1.3 * max(0.0, -c) ** 2,
        "shoulder_L": -0.8 * s,
        "shoulder_R": 0.8 * s,
        "elbow": -1.2,
        "spine": -0.35,
        "chest": -0.1,
        "chest_twist": 0.12 * s,
        "neck": -0.25,
        "head_yaw": 0.05 * s,
        "hips_dz": 0.03 * math.cos(2 * p),
        "hips_tilt": 0.05 * s,
    }


# Key poses of the attack, in order. Each is a dict of the same keys. Values between keys are blended with ease-in-out.
ATTACK_KEYS = [
    (0.00, {}),  # rest
    (0.18, {"hips_dz": -0.06, "spine": 0.2, "chest": 0.1, "neck": 0.35, "shoulder_L": -0.7, "shoulder_R": -0.7,
            "elbow": -0.4, "thigh_L": -0.3, "thigh_R": 0.2, "knee_L": -0.6, "knee_R": -0.6}),  # anticipation
    (0.36, {"hips_dz": 0.02, "spine": -0.9, "chest": -0.35, "neck": -0.9, "shoulder_L": 1.9, "shoulder_R": 1.9,
            "elbow": -0.1, "thigh_L": 0.7, "thigh_R": -0.5, "knee_L": -0.1, "knee_R": -1.0, "head_yaw": 0.0}),  # lunge
    (0.50, {"hips_dz": 0.0, "spine": -0.75, "chest": -0.3, "neck": -0.6, "shoulder_L": 2.0, "shoulder_R": 2.0,
            "elbow": -0.2, "thigh_L": 0.55, "thigh_R": -0.35, "knee_L": -0.1, "knee_R": -0.7, "head_yaw": 0.0}),  # strike
    (0.80, {"hips_dz": 0.0, "spine": -0.75, "chest": -0.3, "neck": -0.6, "shoulder_L": 2.0, "shoulder_R": 2.0,
            "elbow": -0.2, "thigh_L": 0.55, "thigh_R": -0.35, "knee_L": -0.1, "knee_R": -0.7, "head_yaw": 0.0}),  # hold
    (1.00, {"hips_dz": 0.0, "spine": -0.75, "chest": -0.3, "neck": -0.6, "shoulder_L": 2.0, "shoulder_R": 2.0,
            "elbow": -0.2, "thigh_L": 0.55, "thigh_R": -0.35, "knee_L": -0.1, "knee_R": -0.7, "head_yaw": 0.0}),  # end
]


def blend_keys(keys, t):
    """Blend between key poses at time t in [0, 1] using the key times in `keys`."""
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            u = ease_in_out((t - t0) / (t1 - t0))
            names = set(a) | set(b)
            return {n: lerp(a.get(n, 0.0), b.get(n, 0.0), u) for n in names}
    return dict(keys[-1][1])


def pose_jumpscare(t):
    return blend_keys(ATTACK_KEYS, t)


def pose_recovery(t, end_pose):
    """From the attack's end pose back to rest, easing out."""
    u = 1 - (1 - t) ** 3
    names = set(end_pose)
    return {n: lerp(end_pose.get(n, 0.0), 0.0, u) for n in names}


def apply_pose(arm_obj, values, height):
    rest_pose(arm_obj)
    pb = arm_obj.pose.bones
    v = lambda k: values.get(k, 0.0)  # noqa: E731
    add_axis_rotation(pb["spine"], LATERAL, -v("spine"))
    add_axis_rotation(pb["chest"], LATERAL, -v("chest"))
    add_axis_rotation(pb["chest"], VERTICAL_TWIST, v("chest_twist"))
    add_axis_rotation(pb["neck"], LATERAL, -v("neck"))
    add_axis_rotation(pb["neck"], VERTICAL_TWIST, v("head_yaw"))
    add_axis_rotation(pb["head"], DEPTH, v("head_tilt"))
    add_axis_rotation(pb["hips"], DEPTH, v("hips_tilt"))
    hips_translate(arm_obj, v("hips_dz"), height)
    for side in ("L", "R"):
        sign = 1.0 if side == "L" else -1.0
        thigh = v(f"thigh_{side}") if f"thigh_{side}" in values else v("thigh") * sign
        knee = v(f"knee_{side}") if f"knee_{side}" in values else v("knee")
        shoulder = v(f"shoulder_{side}") if f"shoulder_{side}" in values else v("shoulder") * sign
        add_axis_rotation(pb[f"thigh.{side}"], LATERAL, thigh)
        add_axis_rotation(pb[f"shin.{side}"], LATERAL, knee)
        # The clavicle stays at rest: rotating it would move the whole arm a second time. The arm rotates at the shoulder.
        add_axis_rotation(pb[f"upper_arm.{side}"], LATERAL, shoulder)
        add_axis_rotation(pb[f"forearm.{side}"], LATERAL, v("elbow"))

def key_frame(arm_obj, frame):
    for pb in arm_obj.pose.bones:
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        if pb.name == "hips":
            pb.keyframe_insert(data_path="location", frame=frame)


def bake(arm_obj, height, name, frames, pose_at, loop):
    arm_obj.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm_obj.animation_data.action = action
    for f in range(frames):
        t = f / frames if loop else f / (frames - 1)
        values = pose_at(t)
        apply_pose(arm_obj, values, height)
        key_frame(arm_obj, f + 1)
    if loop:
        action.frame_range = (1, frames)
    arm_obj.animation_data.action = None
    rest_pose(arm_obj)
    return action


def bake_all(arm_obj, height):
    bake(arm_obj, height, "idle", IDLE_FRAMES, lambda t: pose_idle(2 * math.pi * t), loop=True)
    bake(arm_obj, height, "walk", WALK_FRAMES, lambda t: pose_walk(2 * math.pi * t), loop=True)
    bake(arm_obj, height, "run", RUN_FRAMES, lambda t: pose_run(2 * math.pi * t), loop=True)
    bake(arm_obj, height, "jumpscare", JUMP_FRAMES, pose_jumpscare, loop=False)
    end = pose_jumpscare(1.0)
    bake(arm_obj, height, "recovery", RECOVERY_FRAMES, lambda t: pose_recovery(t, end), loop=False)
    rest_pose(arm_obj)


def export(dst, mesh, arm_obj):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_apply=False,
        export_image_format="AUTO",
    )


def main():
    src, dst = argv_after_dashes()[:2]
    clear_scene()
    mesh = import_mesh(src)
    arm_obj, height = build_skeleton(mesh)
    bind_proximity_weights(mesh, arm_obj, height)
    bake_all(arm_obj, height)
    export(dst, mesh, arm_obj)
    groups = sorted({g.name for g in mesh.vertex_groups})
    print("BONES_BOUND", groups)
    print("ACTIONS", [a.name for a in bpy.data.actions])
    print("EXPORTED", dst)


if __name__ == "__main__":
    main()
