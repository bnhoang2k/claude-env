# measure_actor.py: measure a character from its model file, so pass 3 never trusts a number in a brief.
#
# Run (foreground):
#   blender --background --factory-startup --python measure_actor.py -- ACTOR.glb [--hands hand.L,hand.R] [--pose stand]
#
# Prints, in glTF units with y up and the figure's front as forward:
#   SIZE  head top above the origin (the origin is what sits on the floor), width, depth, and how far the body sticks out in front of the origin (the belly), measured
#         in the --pose clip's first frame (default: stand, else idle, else the rest pose)
#   CLIP  for every animation clip: the highest hand point, and the furthest forward a hand gets
# Compare these with every surface the figure must use. A hand that peaks under the work surface, or
# reaches less far forward than the belly, cannot touch what sits on that surface.
# It assumes the figure faces glTF +Z (Blender -Y). Pass --flip if it faces the other way.
import sys

try:
    import bpy
except ImportError:
    print('run this inside Blender: blender --background --python measure_actor.py -- ACTOR.glb [--hands hand.L,hand.R] [--pose stand]')
    sys.exit(3)

args = sys.argv[sys.argv.index('--') + 1:]
path = args[0]
hands = args[args.index('--hands') + 1].split(',') if '--hands' in args else ['hand.L', 'hand.R']
sign = -1.0 if '--flip' in args else 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
sc = bpy.context.scene
arms = [o for o in sc.objects if o.type == 'ARMATURE']
arm = arms[0] if arms else None
if arm is not None:
    if arm.animation_data is None:
        arm.animation_data_create()
    want = args[args.index('--pose') + 1] if '--pose' in args else None
    names = [n for n in (want, 'stand', 'idle') if n]
    pose = next((bpy.data.actions[n] for n in names if n in bpy.data.actions), None)
    if pose is None:
        arm.animation_data.action = None
        arm.data.pose_position = 'REST'
    else:
        arm.animation_data.action = pose
        sc.frame_set(int(pose.frame_range[0]))
    print('POSE', pose.name if pose else 'rest')
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

lo, hi = [1e9] * 3, [-1e9] * 3
for o in sc.objects:
    if o.type != 'MESH' or o.name.lower().startswith('icosphere'):
        continue
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    for v in me.vertices:
        p = ev.matrix_world @ v.co
        for i in range(3):
            lo[i], hi[i] = min(lo[i], p[i]), max(hi[i], p[i])
    ev.to_mesh_clear()
fwd = -lo[1] if sign > 0 else hi[1]
print('SIZE head top %.3f above origin (feet at %.3f, mesh %.3f tall)  width %.3f  depth %.3f  belly %.3f in front'
      % (hi[2], lo[2], hi[2] - lo[2], hi[0] - lo[0], hi[1] - lo[1], fwd))

if arm is None:
    print('CLIP none: no armature, so no hand reach. Judge reach from the static pose.')
    sys.exit(0)
arm.data.pose_position = 'POSE'
for act in bpy.data.actions:
    arm.animation_data.action = act
    f0, f1 = (int(x) for x in act.frame_range)
    top, reach = -1e9, -1e9
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        for b in hands:
            pb = arm.pose.bones.get(b)
            if pb is None:
                continue
            p = arm.matrix_world @ pb.head
            top, reach = max(top, p.z), max(reach, -sign * p.y)
    if top > -1e9:
        print('CLIP %-14s hand top %.3f above origin  hand reach %.3f forward' % (act.name, top, reach))
    else:
        print('CLIP %-14s no bone named %s' % (act.name, ','.join(hands)))
