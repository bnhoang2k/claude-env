# checks.py: automatic checks for a 3D model. One `ok` or `FAIL` line per check, `note` lines for facts to judge
# by eye. Exits 1 on any FAIL. These checks SUPPORT looking at the model (look.py); they never replace it.
#
# Run (foreground). B is the Blender path on the `ok Blender` line of preflight.py:
#   "$B" --background --factory-startup \
#     --python checks.py -- MODEL.glb [options]
import json, math, os, sys

USAGE = """checks.py -- MODEL(.glb|.gltf|.blend) [options]
  --objects A,B --add FILE --keep A,B --place NAME=x:y:z:yaw   (same as look.py)
  --floor-tol 0.005       lowest point of each piece must be within this of y = 0
  --float-ok A,B          pieces that rest on something else (devices on a counter, table-top slices)
  --gap-tol 0.003         a part farther than this from every other part, and off the floor, is floating
  --near-tol 0.03         two parts closer than this but not touching are reported as a near miss
  --embed-tol 0.02        parts of one piece may sink into each other this deep (a leg into a seat)
  --overlap-ok A+B,C+D    part pairs allowed to cross deeper; separate pieces must never cross
  --open-ok A,B           pieces or meshes allowed open edges (seam sides of a sliced table top)
  --tris 2000             triangle budget per piece
  --slots Fill,Shade,Ink  allowed material slot names
  --origin-tol 0.02       footprint centre must be this close to the origin
  --origin-skip A,B       pieces whose origin is elsewhere on purpose
  --front-marker A        a part that must sit on the +Z (front) side of its piece (eyes, a screen)
  --expect sizes.json     {"Piece": {"w": 0.62, "d": 0.42, "h": 0.72}} measured from the mesh, glTF units
  --size-tol 0.01
  --clips a,b --frames 0,.25,.5,.75,1   rigged: clips and the fractions to sample (default: every action)
  --feet a,b              foot bones (default: bones named foot, ankle or toe)
  --standing a,b          clips where planted feet must not slide
  --loops a,b             clips that loop: first (or loopFrom) and last frame must match
  --clip-props FILE.json  clip list (example: character-clips.json); its loopFrom sets where a loop starts
  --slide-tol 0.02 --pop-tol 0.01 --foot-tol 0.01
  --reach a,b             bones whose height and forward reach are noted per clip (default: bones named hand)
  --prop A                a placed object the rig must not pass into (a chair, a counter)
  --hinge bone:axis:min:max   allowed local rotation in degrees (axis x, y or z), e.g. knee.L:x:0:150
  --compare OLD.glb       node, mesh, material and clip names and clip lengths must match the old export
  --config FILE.json      defaults for any option above"""

try:
    import bpy, bmesh
except ImportError:
    print('run this inside Blender: blender --background --python checks.py -- MODEL.glb [options]')
    sys.exit(3)
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

FAILS = [0]


def ok(cond, msg):
    if not cond:
        FAILS[0] += 1
    print(('ok   ' if cond else 'FAIL ') + msg, flush=True)


def note(msg):
    print('note ' + msg, flush=True)


def f3(v):
    return '%.3f' % v


# ---------------------------------------------------------------- static checks
def check_floor(piece, verts, opts):
    low = min(v.z for v in verts)
    tol = float(opts['floor_tol'])
    if piece.name in C.csv(opts.get('float_ok')):
        note('floor %s: lowest %s (allowed off the floor)' % (piece.name, f3(low)))
        return
    ok(abs(low) <= tol, 'floor %s: lowest point %s (tol %s)%s' % (
        piece.name, f3(low), tol, '' if abs(low) <= tol else (' FLOATS' if low > 0 else ' SINKS into the floor')))


def check_parts(piece, opts):
    """Separate parts: floating (no path to the floor), near misses, and how deep they cross."""
    parts = C.mesh_parts(piece)
    if len(parts) < 2:
        return
    data = {p: C.bvh_of(p) for p in parts}
    low = min(v.z for p in parts for v in data[p][1])
    allowed = set(tuple(sorted(s.split('+'))) for s in C.csv(opts.get('overlap_ok')))
    gap_tol, near_tol, embed_tol = float(opts['gap_tol']), float(opts['near_tol']), float(opts['embed_tol'])
    links = {p: set() for p in parts}
    for i, a in enumerate(parts):
        for b in parts[i + 1:]:
            d, at, n = C.contact(data[a], data[b])
            pair = '%s + %s' % (a.name, b.name)
            if d <= gap_tol:
                links[a].add(b)
                links[b].add(a)
            elif d <= near_tol:
                ok(False, 'near miss %s: %s apart (touching parts meet; separate parts sit clear)' % (pair, f3(d)))
            if n:
                da = C.embed_depth(data[a][1], data[b][0], C.bbox(data[b][1]))[0] if data[b][0] else 0
                db = C.embed_depth(data[b][1], data[a][0], C.bbox(data[a][1]))[0] if data[a][0] else 0
                deep = max(da, db)
                fine = deep <= embed_tol or tuple(sorted((a.name, b.name))) in allowed
                if deep < 0.001:
                    ok(True, 'touch %s: faces meet flush (look for z-fighting where both faces show)' % pair)
                else:
                    ok(fine, 'cross %s: one sinks into the other, deepest %s (tol %s)' % (pair, f3(deep), embed_tol))
    grounded = {p for p in parts if min(v.z for v in data[p][1]) <= low + float(opts['floor_tol'])}
    seen, todo = set(grounded), list(grounded)
    while todo:
        for q in links[todo.pop()]:
            if q not in seen:
                seen.add(q)
                todo.append(q)
    for p in parts:
        if p not in seen:
            ok(False, 'floating part %s/%s: touches nothing that reaches the floor' % (piece.name, p.name))
    if all(p in seen for p in parts):
        ok(True, 'parts %s: all %d parts connect down to the floor' % (piece.name, len(parts)))


def check_pieces_apart(pcs):
    """Separate pieces (a character and its chair, two placed pieces) must never cross."""
    data = {p: [C.bvh_of(m) for m in C.mesh_parts(p)] for p in pcs}
    bad = False
    for i, a in enumerate(pcs):
        for b in pcs[i + 1:]:
            if C.rig_of(a) or C.rig_of(b):
                continue                                  # rig vs prop is checked per frame
            if any(C.contact(x, y)[0] == 0 for x in data[a] for y in data[b]):
                ok(False, 'apart %s + %s: separate pieces cross' % (a.name, b.name))
                bad = True
    if not bad:
        ok(True, 'apart: no two separate static pieces cross')


def check_topology(ob, piece, opts):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.edges.ensure_lookup_table()
    nonman = sum(1 for e in bm.edges if len(e.link_faces) > 2)
    border = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    wire = sum(1 for e in bm.edges if not e.link_faces)
    loose = sum(1 for v in bm.verts if not v.link_edges)
    flat = sum(1 for f in bm.faces if f.calc_area() < 1e-9)
    flip = sum(1 for e in bm.edges if len(e.link_faces) == 2 and not e.is_contiguous)
    name = ob.name
    bad = ['%d %s' % (n, what) for n, what in ((nonman, 'edges shared by 3+ faces'), (loose, 'loose vertices'),
           (wire, 'loose edges'), (flat, 'zero-area faces'), (flip, 'edges where neighbour faces wind opposite ways'))
           if n]
    if border:
        if name in C.csv(opts.get('open_ok')) or piece.name in C.csv(opts.get('open_ok')):
            note('topology %s: %d open edges (allowed)' % (name, border))
        else:
            bad.append('%d open edges (hole, open back or missing bottom)' % border)
    elif not bad:
        vol = bm.calc_volume(signed=True)
        if vol <= 0:
            bad.append('closed but INSIDE OUT (signed volume %.5f)' % vol)
    ok(not bad, 'topology %s: %s' % (name, '; '.join(bad) if bad else 'clean (closed, normals outward)' if not border else 'clean apart from allowed open edges'))
    bm.free()


def check_budget_and_slots(piece, opts):
    parts = C.mesh_parts(piece)
    tris = sum(len(p.vertices) - 2 for m in parts for p in m.data.polygons)
    if opts.get('tris'):
        ok(tris <= int(opts['tris']), 'tris %s: %d (budget %s)' % (piece.name, tris, opts['tris']))
    allowed = C.csv(opts.get('slots'))
    for m in parts:
        names = [s.material.name if s.material else None for s in m.material_slots]
        if not names:
            ok(False, 'slots %s: no material' % m.name)
        elif allowed:
            bad = [n for n in names if n not in allowed]
            ok(not bad, 'slots %s: %s%s' % (m.name, names, ' not in %s' % allowed if bad else ''))


def check_origin(piece, verts, opts):
    """Returns the piece's local bounds either way: the size check needs them even when the origin is skipped."""
    inv = piece.matrix_world.inverted()
    loc = [inv @ v for v in verts]
    lo, hi = C.bbox(loc)
    if piece.name in C.csv(opts.get('origin_skip')):
        return lo, hi
    cx, cz = (lo.x + hi.x) / 2, -(lo.y + hi.y) / 2           # Blender local -> glTF X, Z
    tol = float(opts['origin_tol'])
    ok(abs(cx) <= tol and abs(cz) <= tol, 'origin %s: footprint centre at X %s, Z %s from the origin (tol %s)' % (
        piece.name, f3(cx), f3(cz), tol))
    return lo, hi


def check_front(piece, opts):
    for name in C.csv(opts.get('front_marker')):
        m = next((p for p in C.mesh_parts(piece) if p.name == name or p.name.split('.')[0] == name), None)
        if m is None:
            continue
        inv = piece.matrix_world.inverted()
        allv = [inv @ v for p in C.mesh_parts(piece) for v in C.world_verts(p)[0]]
        mv = [inv @ v for v in C.world_verts(m)[0]]
        cz = -(sum(v.y for v in allv) / len(allv))
        mz = -(sum(v.y for v in mv) / len(mv))
        ok(mz > cz, 'front %s: %s sits at Z %s vs the piece centre %s (front is +Z)' % (piece.name, name, f3(mz), f3(cz)))


def check_expect(piece, lohi, opts):
    if not opts.get('expect') or lohi is None:
        return
    exp = json.load(open(opts['expect'])).get(piece.name)
    if not exp:
        return
    lo, hi = lohi
    got = {'w': hi.x - lo.x, 'd': hi.y - lo.y, 'h': hi.z}
    tol = float(opts['size_tol'])
    for k, v in exp.items():
        if k in got:
            ok(abs(got[k] - v) <= tol, 'size %s %s: %s, expected %s' % (piece.name, k, f3(got[k]), v))


# ---------------------------------------------------------------- rigged checks
def foot_sets(arm, mesh, bones):
    """Vertex indices that follow each foot bone (weight >= 0.5)."""
    out = {}
    for b in bones:
        g = mesh.vertex_groups.get(b)
        if g is None:
            continue
        idx = []
        for v in mesh.data.vertices:
            for ge in v.groups:
                if ge.group == g.index and ge.weight >= 0.5:
                    idx.append(v.index)
        if idx:
            out[b] = idx
    return out


def check_rig(rig, props, opts):
    arm = C.rig_of(rig)
    meshes = C.mesh_parts(rig)
    body = max(meshes, key=lambda m: len(m.data.vertices))
    feet = C.csv(opts.get('feet')) or C.guess_bones(arm, ('foot', 'ankle', 'toe'))
    fsets = foot_sets(arm, body, feet)
    note('rig %s: body mesh %s, feet %s' % (arm.name, body.name, {k: len(v) for k, v in fsets.items()}))
    clips = C.csv(opts.get('clips')) or sorted(a.name for a in bpy.data.actions)
    fracs = C.csv(opts['frames'])
    standing, loops = C.csv(opts.get('standing')), C.csv(opts.get('loops'))
    ftol, stol, ptol = float(opts['foot_tol']), float(opts['slide_tol']), float(opts['pop_tol'])
    prop_data = [(m, C.bvh_of(m)) for p in props for m in C.mesh_parts(p)]
    hinges = []
    for h in C.csv(opts.get('hinge')):
        b, ax, lo, hi = h.split(':')
        hinges.append((b, 'xyz'.index(ax.lower()), float(lo), float(hi)))
    others = [m for m in meshes if m is not body]
    rows = {r['name']: r for r in json.load(open(opts['clip_props']))} if opts.get('clip_props') else {}
    reach = C.csv(opts.get('reach')) or C.guess_bones(arm, ('hand',))
    for clip in clips:
        reached = {b: [] for b in reach}
        fr = C.clip_frames(clip, fracs)
        prev, low_all, first_v = {}, [], None
        hseen = {h[0]: [] for h in hinges}
        collapsed = {o.name: [] for o in others}
        for f in fr:
            C.set_clip(arm, clip, f)
            verts = C.world_verts(body)[0]
            if first_v is None:
                first_v = verts
            last_v = verts
            low = min(v.z for v in verts)
            low_all.append(low)
            if low < -ftol:
                ok(False, 'clip %s f%.1f: mesh %s below the floor' % (clip, f, f3(-low)))
            for b, idx in fsets.items():
                pts = [verts[i] for i in idx]
                lowest = min(pts, key=lambda v: v.z)
                if b in prev and clip in standing and lowest.z <= ftol and prev[b].z <= ftol:
                    slide = math.hypot(lowest.x - prev[b].x, lowest.y - prev[b].y)
                    ok(slide <= stol, 'slide %s %s f%.1f: planted foot moved %s (tol %s)' % (clip, b, f, f3(slide), stol))
                prev[b] = lowest
            for (m, pdat) in prop_data:
                bd = C.bvh_of(body)
                d, at, n = C.contact(bd, pdat)
                if n:
                    depth = C.embed_depth(bd[1], pdat[0], C.bbox(pdat[1]))[0] if pdat[0] else 0
                    ok(False, 'prop %s f%.1f: body passes into %s, deepest vertex %s inside' % (clip, f, m.name, f3(depth)))
            for b in reach:
                at = C.bone_point(arm, b)
                if at is not None:
                    g = C.G(arm.matrix_world.inverted() @ at)         # rig-local, glTF axes: y up, z front
                    reached[b].append((g[1], g[2]))
            for (b, ax, lo, hi) in hinges:
                pb = arm.pose.bones.get(b)
                if pb is not None:
                    hseen[b].append(math.degrees(pb.matrix_basis.to_euler()[ax]))
            for o in others:
                v = C.world_verts(o)[0]
                lo3, hi3 = C.bbox(v)
                if (hi3 - lo3).length < 1e-4:
                    collapsed[o.name].append('%.1f' % f)
        note('clip %s: lowest mesh point per frame %s' % (clip, [f3(x) for x in low_all]))
        for b, vals in reached.items():
            if vals:
                note('reach %s %s: height %s..%s, forward %s..%s (rig-local; compare with the surface it works at)' % (
                    clip, b, f3(min(v[0] for v in vals)), f3(max(v[0] for v in vals)),
                    f3(min(v[1] for v in vals)), f3(max(v[1] for v in vals))))
        for name, frs in collapsed.items():
            if frs:
                note('clip %s: %s hidden (scaled to nothing) at frames %s of %d sampled' % (clip, name, frs, len(fr)))
        if clip in standing:
            ok(max(abs(x) for x in low_all) <= ftol * 3,
               'grounded %s: lowest point stays on the floor in every frame (max off %s)' % (
                   clip, f3(max(abs(x) for x in low_all))))
        if clip in loops:
            row = rows.get(clip, {})
            start = 0.0
            if 'loopFrom' in row:
                a, b = row['frames']
                start = (row['loopFrom'] - a) / float(b - a)
            C.set_clip(arm, clip, C.clip_frames(clip, [start])[0])
            first_v = C.world_verts(body)[0]
            C.set_clip(arm, clip, C.clip_frames(clip, [1])[0])
            last_v = C.world_verts(body)[0]
            pop = max((a - b).length for a, b in zip(first_v, last_v))
            ok(pop <= ptol, 'loop %s: %s and last frame differ by %s (tol %s)' % (
                clip, 'loopFrom %s' % row['loopFrom'] if 'loopFrom' in row else 'first', f3(pop), ptol))
        for (b, ax, lo, hi) in hinges:
            vals = hseen[b]
            if vals:
                inside = all(lo - 0.5 <= v <= hi + 0.5 for v in vals)
                ok(inside, 'hinge %s %s: %s..%s degrees (allowed %s..%s)' % (
                    clip, b, '%.0f' % min(vals), '%.0f' % max(vals), lo, hi))
    if prop_data:
        note('prop checks ran against %s' % [m.name for m, _ in prop_data])


# ---------------------------------------------------------------- export compare
def anim_lengths(j):
    out = {}
    for a in j.get('animations', []):
        t = 0.0
        for s in a['samplers']:
            t = max(t, max(j['accessors'][s['input']].get('max', [0])))
        out[a.get('name')] = round(t, 4)
    return out


def check_compare(new, old):
    a, b = C.glb_json(old), C.glb_json(new)
    for key in ('nodes', 'meshes', 'materials'):
        na, nb = sorted(x.get('name', '') for x in a.get(key, [])), sorted(x.get('name', '') for x in b.get(key, []))
        ok(na == nb, 'export %s: %s' % (key, 'same names' if na == nb else 'old-only %s, new-only %s' % (
            sorted(set(na) - set(nb)), sorted(set(nb) - set(na)))))
    la, lb = anim_lengths(a), anim_lengths(b)
    ok(la == lb, 'export clips: %s' % ('same names and lengths' if la == lb else 'old %s, new %s' % (la, lb)))
    ea, eb = sorted(a.get('extensionsUsed', [])), sorted(b.get('extensionsUsed', []))
    ok(ea == eb, 'export extensions: %s vs %s' % (ea, eb))


DEFAULTS = {'floor_tol': 0.005, 'gap_tol': 0.003, 'near_tol': 0.03, 'embed_tol': 0.02, 'origin_tol': 0.02,
            'size_tol': 0.01, 'frames': '0,.25,.5,.75,1', 'slide_tol': 0.02, 'pop_tol': 0.01, 'foot_tol': 0.01}


def main():
    opts = C.parse(DEFAULTS, USAGE)
    if opts.get('compare'):
        check_compare(opts['file'], opts['compare'])
    pcs = C.setup_scene(opts)
    rigs = [p for p in pcs if C.rig_of(p)]
    for r in rigs:
        C.rest_pose(C.rig_of(r))
    print('PIECES', [p.name for p in pcs])
    for p in pcs:
        parts = C.mesh_parts(p)
        verts = [v for m in parts for v in C.world_verts(m)[0]]
        check_floor(p, verts, opts)
        lohi = check_origin(p, verts, opts)
        check_expect(p, lohi, opts)
        check_front(p, opts)
        check_budget_and_slots(p, opts)
        check_parts(p, opts)
        for m in parts:
            check_topology(m, p, opts)
    if len(pcs) > 1:
        check_pieces_apart(pcs)
    props = [p for p in pcs if p.name in C.csv(opts.get('prop'))]
    for r in rigs:
        check_rig(r, props, opts)
    print('FAILURES %d' % FAILS[0] if FAILS[0] else 'ALL OK')
    sys.exit(1 if FAILS[0] else 0)


main()
