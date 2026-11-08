# Shared helpers for look.py and checks.py. Runs inside Blender 5.x (bpy), headless.
# Axes: reports use glTF axes (X, Y up, Z front). Blender is Z up: glTF (X, Y, Z) = Blender (X, -Z, Y).
import json, math, os, struct, sys

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree


def argv_after_dashes():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def parse(defaults, usage):
    """`blender ... --python x.py -- FILE --key value ...`. --config FILE.json supplies defaults (keys without dashes).
    Command-line values win over the config. Repeated keys join with commas."""
    args = argv_after_dashes()
    if not args or args[0] in ('-h', '--help'):
        sys.exit(usage)
    opts, cli = dict(defaults), {}
    opts['file'] = os.path.abspath(args[0])
    i = 1
    while i < len(args):
        k = args[i]
        if not k.startswith('--'):
            sys.exit('Unexpected argument %r.\n%s' % (k, usage))
        k = k[2:].replace('-', '_')
        if i + 1 < len(args) and not args[i + 1].startswith('--'):
            v, i = args[i + 1], i + 2
        else:
            v, i = 'true', i + 1
        cli[k] = cli[k] + ',' + v if k in cli else v
    if 'config' in cli:
        with open(cli['config']) as f:
            for k, v in json.load(f).items():
                opts[k.replace('-', '_')] = v
    opts.update(cli)
    return opts


def csv(v):
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return [str(x) for x in v]
    return [s for s in str(v).split(',') if s]


def B(X, Y, Z):
    return Vector((X, -Z, Y))


def G(v):
    return (v[0], v[2], -v[1])


# ------------------------------------------------------------------ loading
def import_file(path):
    """Import a .glb/.gltf or append every object of a .blend. Returns the new top-level objects."""
    before = set(bpy.context.scene.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.glb', '.gltf'):
        try:
            bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
        except TypeError:
            bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.blend':
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
            dst.actions = list(src.actions)
        for ob in dst.objects:
            if ob is not None:
                bpy.context.scene.collection.objects.link(ob)
    else:
        sys.exit('Unsupported file: %s. Pass a .glb, .gltf or .blend.' % path)
    drop_bone_shapes()
    new = [o for o in bpy.context.scene.objects if o not in before]
    return [o for o in new if o.parent is None]


def drop_bone_shapes():
    """The glTF importer adds an 'Icosphere' as the custom bone shape. It is not part of the model."""
    shapes = set()
    for o in bpy.context.scene.objects:
        if o.type == 'ARMATURE':
            for pb in o.pose.bones:
                if pb.custom_shape:
                    shapes.add(pb.custom_shape)
    for s in shapes:
        bpy.data.objects.remove(s, do_unlink=True)


def weld(ob, dist=1e-6):
    """Merge vertices by position, as three.js EdgesGeometry does. Without it, split normals read as open edges."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(ob.data)
    bm.free()


def setup_scene(opts):
    """Load the main file and any --add files, keep --objects / --keep, apply --place. Returns the pieces."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tops = import_file(opts['file'])
    keep_main = csv(opts.get('objects'))
    if keep_main:
        missing = [n for n in keep_main if not any(t.name == n for t in tops)]
        if missing:
            sys.exit('No top-level object named %s. Top-level objects: %s' % (missing, sorted(t.name for t in tops)))
        for t in tops:
            if t.name not in keep_main:
                remove_tree(t)
    for add in csv(opts.get('add')):
        new = import_file(add)
        keep = csv(opts.get('keep'))
        for t in new:
            if keep and t.name not in keep:
                remove_tree(t)
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            weld(o)
    bpy.context.view_layer.update()
    for spec in csv_semis(opts.get('place')):
        name, vals = spec.split('=')
        x, y, z, yaw = [float(v) for v in vals.split(':')]
        ob = bpy.context.scene.objects.get(name)
        if ob is None:
            sys.exit('--place: no object named %s.' % name)
        ob[PLACE_FROM] = [v for row in ob.matrix_world for v in row]   # the world before the move; HeldProps undoes it
        ob.location = B(x, y, z)
        ob.rotation_mode = 'XYZ'
        ob.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()
    return pieces()


def csv_semis(v):
    """--place takes NAME=x:y:z:yaw, several separated by commas."""
    return csv(v)


def remove_tree(ob):
    for c in list(ob.children_recursive):
        bpy.data.objects.remove(c, do_unlink=True)
    bpy.data.objects.remove(ob, do_unlink=True)


def pieces():
    """Top-level objects with at least one mesh under them (or that are meshes)."""
    out = []
    for o in bpy.context.scene.objects:
        if o.parent is None and mesh_parts(o):
            out.append(o)
    return sorted(out, key=lambda o: o.name)


def mesh_parts(root):
    objs = [root] + list(root.children_recursive)
    return [o for o in objs if o.type == 'MESH']


def rig_of(root):
    if root.type == 'ARMATURE':
        return root
    for c in root.children_recursive:
        if c.type == 'ARMATURE':
            return c
    return None


# ------------------------------------------------------------------ animation
def set_clip(arm, clip, frame):
    act = bpy.data.actions.get(clip)
    if act is None:
        sys.exit('No action named %s. Actions: %s' % (clip, sorted(a.name for a in bpy.data.actions)))
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = act
    if getattr(ad, 'action_slot', None) is None and getattr(act, 'slots', None):
        ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))


def rest_pose(arm):
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def clip_frames(clip, fractions):
    act = bpy.data.actions[clip]
    f0, f1 = act.frame_range
    return [f0 + (f1 - f0) * float(t) for t in fractions]


# ------------------------------------------------------------------ geometry
def world_verts(ob):
    """Evaluated (deformed) vertices in Blender world space, and the polygons."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return verts, polys


def bvh_of(ob):
    """(tree, verts, polys) of the evaluated mesh, in world space. tree is None for a mesh with no faces."""
    verts, polys = world_verts(ob)
    if not polys:
        return None, verts, polys
    return BVHTree.FromPolygons(verts, polys, epsilon=0.0), verts, polys


def contact(a, b):
    """Distance between two meshes given as bvh_of() tuples: (0 and a point on the crossing) when their surfaces
    cross, else (smallest vertex-to-surface distance, midpoint of the closest points)."""
    ta, va, pa_ = a
    tb, vb, pb_ = b
    if ta is not None and tb is not None:
        hits = ta.overlap(tb)
        if hits:
            poly = pa_[hits[0][0]]
            return 0.0, sum((va[i] for i in poly), Vector()) / len(poly), len(hits)
    d1, p1, q1 = min_distance(va, tb)
    d2, p2, q2 = min_distance(vb, ta)
    d, p, q = (d1, p1, q1) if d1 <= d2 else (d2, p2, q2)
    return d, ((p + q) / 2 if p is not None else None), 0


def min_distance(verts_a, tree_b):
    """Smallest distance from any vertex of A to the surface of B, and the closest points."""
    best = (1e9, None, None)
    if tree_b is None:
        return best
    for p in verts_a:
        hit = tree_b.find_nearest(p)
        if hit[0] is not None and hit[3] < best[0]:
            best = (hit[3], p, hit[0])
    return best


def embed_depth(verts_a, tree_b, bbox_b):
    """How deep A's vertices sit inside B (0 if none). Uses B's face normals, so B should be closed."""
    lo, hi = bbox_b
    deepest, where = 0.0, None
    for p in verts_a:
        if not all(lo[i] - 1e-6 <= p[i] <= hi[i] + 1e-6 for i in range(3)):
            continue
        loc, nrm, _i, dist = tree_b.find_nearest(p)
        if loc is not None and (p - loc).dot(nrm) < 0 and dist > deepest:
            deepest, where = dist, p
    return deepest, where


def bbox(verts):
    lo = Vector((min(v[0] for v in verts), min(v[1] for v in verts), min(v[2] for v in verts)))
    hi = Vector((max(v[0] for v in verts), max(v[1] for v in verts), max(v[2] for v in verts)))
    return lo, hi


# ------------------------------------------------------------------ held props
# Blender (x, y, z) -> glTF (x, z, -y), as a matrix.
GLTF = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def glb_json(path):
    with open(path, 'rb') as f:
        data = f.read()
    if path.lower().endswith('.gltf'):
        return json.loads(data)
    n = struct.unpack('<I', data[12:16])[0]
    return json.loads(data[20:20 + n])


def node_rest_world(js, name):
    """World matrix (glTF space) of a node at rest, from its TRS chain in the glTF JSON."""
    nodes = js['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    idx = next(i for i, n in enumerate(nodes) if n.get('name') == name)
    m = Matrix.Identity(4)
    while idx is not None:
        n = nodes[idx]
        if 'matrix' in n:
            local = Matrix([n['matrix'][i::4] for i in range(4)])
        else:
            t = Matrix.Translation(n.get('translation', (0, 0, 0)))
            q = n.get('rotation', (0, 0, 0, 1))
            r = Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
            s = n.get('scale', (1, 1, 1))
            local = t @ r @ Matrix.Diagonal((s[0], s[1], s[2], 1))
        m = local @ m
        idx = parent.get(idx)
    return m


PLACE_FROM = 'look_place_from'


def placed_by(ob):
    """The move --place gave ob's top-level object: its world now times the inverse of its world before. Identity if none."""
    top = ob
    while top.parent is not None:
        top = top.parent
    if PLACE_FROM not in top:
        return Matrix.Identity(4)
    f = list(top[PLACE_FROM])
    return top.matrix_world @ Matrix([f[i * 4:i * 4 + 4] for i in range(4)]).inverted()


class HeldProps:
    """Props held in the hands, from a clip list like character-clips.json:
    [{"name": clip, "frames": [f0, f1], "props": [{"name", "bone", "showFrames", "position", "quaternion"}]}].
    Each offset is in the glTF bone node's own space, which is what three.js uses for a child of the bone.
    The props come from a second file (props.glb). They follow the hand only in the frames they show."""

    def __init__(self, arm, model_path, clips_path, props_path):
        self.arm = arm
        self.rows = {r['name']: r for r in json.load(open(clips_path))}
        js = glb_json(model_path)
        need = {p['name'] for r in self.rows.values() for p in r.get('props', [])}
        self.roots = {}
        for t in import_file(props_path):
            if t.name in need:
                self.roots[t.name] = t
            else:
                remove_tree(t)
        missing = sorted(need - set(self.roots))
        if missing:
            sys.exit('--props-file has no top-level object named %s.' % missing)
        for r in self.roots.values():
            for m in mesh_parts(r):
                weld(m)
        # node_rest_world reads the file as imported; --place may have moved the rig since. Carry that move,
        # or every prop lands off its hand by the placement offset.
        moved = placed_by(arm)
        self.K = {}
        for bone in {p['bone'] for r in self.rows.values() for p in r.get('props', [])}:
            rest = arm.matrix_world @ arm.data.bones[bone].matrix_local
            self.K[bone] = rest.inverted() @ moved @ GLTF.inverted() @ node_rest_world(js, bone)
        self.hide_all()

    def all_roots(self):
        return list(self.roots.values())

    def hide_all(self):
        for r in self.roots.values():
            for m in mesh_parts(r):
                m.hide_render = True

    def pose(self, clip, frame):
        """Place the props this clip holds at this frame. Returns the meshes that show."""
        row = self.rows.get(clip)
        shown = []
        if not row or not row.get('props'):
            return shown
        f0, f1 = bpy.data.actions[clip].frame_range
        a, b = row['frames']
        src = a + (frame - f0) / max(1e-6, f1 - f0) * (b - a)       # the frame number the clip list uses
        for p in row['props']:
            s0, s1 = p['showFrames']
            if not (s0 - 0.01 <= src <= s1 + 0.01):
                continue
            q = p['quaternion']
            L = Matrix.Translation(p['position']) @ Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
            pose = self.arm.matrix_world @ self.arm.pose.bones[p['bone']].matrix
            root = self.roots[p['name']]
            root.matrix_world = pose @ self.K[p['bone']] @ L @ GLTF
            shown += mesh_parts(root)
        bpy.context.view_layer.update()
        return shown


def bone_point(arm, name):
    pb = arm.pose.bones.get(name)
    if pb is None:
        return None
    return arm.matrix_world @ ((pb.head + pb.tail) / 2)


def guess_bones(arm, words=('hand', 'foot', 'ankle', 'toe')):
    return [b.name for b in arm.pose.bones if any(w in b.name.lower() for w in words)]
