# look.py: render every angle of a 3D model so an agent can LOOK at it. Never judges anything itself.
#
# Run (foreground):
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#     --python look.py -- MODEL.glb --out DIR [options]
#
# Writes DIR/views/*.png (one image per view), DIR/closeups/*.png, DIR/clips/*.png and DIR/index.txt (every image,
# in reading order). Sheets are written after each group and each clip, so a stopped run keeps what it finished. Each image shows the house look (white fill, ink crease and silhouette lines, floor) next to an
# x-ray (each part a translucent colour, hidden lines drawn) so overlaps inside the model show.
# Blender renders the cells; the system python3 with Pillow composites them (Blender's Python has no Pillow).
import json, math, os, shutil, subprocess, sys, tempfile

USAGE = """look.py -- MODEL(.glb|.gltf|.blend) --out DIR [options]
  --objects A,B           keep only these top-level objects
  --add FILE --keep A,B   import more objects (a chair to sit in, a counter to stand at)
  --place NAME=x:y:z:yaw  move a top-level object (glTF units, y up, yaw in degrees); repeat with commas. Held props (--clip-props) follow a placed rig
  --group-size 6          static pieces per view image (each piece gets its own cells, no occlusion)
  --groups 1,2            render only these groups (1-based); index.txt lists them all
  --azimuths 16           orbit steps (16 = every 22.5 degrees)
  --elevations 5,30,60    orbit elevations in degrees; top and bottom views are always added
  --pose CLIP             rigged: pose for the orbit (CLIP's last frame); default is the rest pose
  --clips a,b             rigged: clips to sample (default: none); split long lists over several runs
  --clip-props FILE.json  rigged: clip list with held props and their offsets from the hand (example: character-clips.json)
  --props-file FILE.glb   the file those props come from (example: props.glb)
  --frames 0,.25,.5,.75,1 fractions of each clip to sample
  --bones a,b             rigged: close-up targets (default: bones named hand, foot, ankle or toe)
  --cell 360              cell size in pixels
  --crease 25             crease angle in degrees (faces turning more than this draw a line)
  --max-closeups 30       static close-ups per run (joins, gaps, floor contacts)
  --skip orbit,closeups,clips
  --config FILE.json      defaults for any option above"""

try:
    import bpy
    from mathutils import Matrix, Vector
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import common as C
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

PALETTE = [(0.93, 0.33, 0.33), (0.27, 0.55, 0.95), (0.25, 0.75, 0.4), (0.95, 0.68, 0.15), (0.65, 0.4, 0.9),
           (0.15, 0.75, 0.78), (0.9, 0.45, 0.75), (0.55, 0.55, 0.2)]


# ============================================================================ Blender side
def emission(name, rgb, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value = (*rgb, 1)
    if alpha < 1:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.inputs[0].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
        m.surface_render_method = 'BLENDED'
        m.use_backface_culling = False
    else:
        nt.links.new(em.outputs[0], out.inputs[0])
    return m


class Renderer:
    def __init__(self, opts, tmp):
        self.tmp, self.n = tmp, 0
        sc = self.sc = bpy.context.scene
        sc.render.engine = 'BLENDER_EEVEE'
        try:
            sc.eevee.taa_render_samples = 16
        except AttributeError:
            pass
        sc.view_settings.view_transform = 'Standard'
        sc.render.film_transparent = False
        sc.world = bpy.data.worlds.new('look_world')
        sc.world.use_nodes = True
        bg = sc.world.node_tree.nodes['Background']
        bg.inputs[0].default_value = (1, 1, 1, 1)
        sc.render.use_freestyle = True
        sc.render.line_thickness_mode = 'ABSOLUTE'
        sc.render.line_thickness = 1.3
        vl = sc.view_layers[0]
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        fs.crease_angle = math.radians(180 - float(opts['crease']))
        self.ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('lines')
        if self.ls.linestyle is None:
            self.ls.linestyle = bpy.data.linestyles.new('ink')
        for k in ('select_silhouette', 'select_border', 'select_crease'):
            setattr(self.ls, k, True)
        # the floor: light grey, no lines (its own collection, excluded from the line set)
        coll = bpy.data.collections.new('look_floor')
        sc.collection.children.link(coll)
        me = bpy.data.meshes.new('floor')
        z = -0.002                     # just under y = 0: a floor exactly at 0 hides the bottom edges' lines
        me.from_pydata([(-50, -50, z), (50, -50, z), (50, 50, z), (-50, 50, z)], [], [(0, 1, 2, 3)])
        self.floor = bpy.data.objects.new('look_floor', me)
        coll.objects.link(self.floor)
        self.floor.data.materials.append(emission('floor', (0.9, 0.9, 0.91)))
        self.ls.select_by_collection = True
        self.ls.collection = coll
        self.ls.collection_negation = 'EXCLUSIVE'
        self.white = emission('house', (1, 1, 1))
        self.xray = [emission('xray%d' % i, c, 0.33) for i, c in enumerate(PALETTE)]
        cam_d = bpy.data.cameras.new('look_cam')
        cam_d.type = 'ORTHO'
        cam_d.clip_start, cam_d.clip_end = 0.01, 500
        self.cam = bpy.data.objects.new('look_cam', cam_d)
        sc.collection.objects.link(self.cam)
        sc.camera = self.cam
        self.cell = int(opts['cell'])

    def paint(self, parts, mode):
        for i, ob in enumerate(parts):
            if not ob.material_slots:
                ob.data.materials.append(None)
            for s in ob.material_slots:
                s.link = 'OBJECT'
                s.material = self.white if mode == 'house' else self.xray[i % len(self.xray)]
        self.ls.select_by_visibility = mode == 'house'
        self.ls.linestyle.color = (0, 0, 0) if mode == 'house' else (0.25, 0.25, 0.32)

    def aim(self, center, radius, az, el, scale=None):
        """az 0 = camera in front (glTF +Z), 90 = on the model's left (glTF +X). el 90 = top, -90 = bottom."""
        a, e = math.radians(az), math.radians(el)
        if abs(el) >= 89.9:
            back = C.B(0, 1 if el > 0 else -1, 0)
            up_hint = C.B(0, 0, -1) if el > 0 else C.B(0, 0, 1)
        else:
            back = C.B(math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))
            up_hint = Vector((0, 0, 1))
        back = back.normalized()
        right = up_hint.cross(back).normalized()
        up = back.cross(right).normalized()
        rot = Matrix((right, up, back)).transposed().to_4x4()
        # far back: an orthographic view does not change with distance, and a near camera at a low elevation
        # starts the lowest rays below the floor, which leaves a white band under the model
        self.cam.matrix_world = Matrix.Translation(center + back * (radius * 30 + 5)) @ rot
        self.cam.data.ortho_scale = scale or radius * 2.15

    def shot(self, visible, parts, mode, center, radius, az, el, scale=None, size=None, floor=True):
        for o in self.sc.objects:
            if o.type in ('MESH', 'CURVE', 'SURFACE', 'META', 'FONT'):
                o.hide_render = o not in visible
        self.floor.hide_render = not (floor and mode == 'house' and el > 0)
        self.floor.location.x, self.floor.location.y = center.x, center.y     # pieces may sit far from the origin
        self.paint(parts, mode)
        self.aim(center, radius, az, el, scale)
        self.sc.render.resolution_x = self.sc.render.resolution_y = size or self.cell
        self.n += 1
        fn = os.path.join(self.tmp, 'c%05d.png' % self.n)
        self.sc.render.filepath = fn
        bpy.ops.render.render(write_still=True)
        return fn


def sphere(parts):
    pts = []
    for ob in parts:
        pts += C.world_verts(ob)[0]
    lo, hi = C.bbox(pts)
    c = (lo + hi) / 2
    return c, max(0.05, max((p - c).length for p in pts))


def view_list(opts):
    n = int(opts['azimuths'])
    out = []
    for el in [float(e) for e in C.csv(opts['elevations'])]:
        for k in range(n):
            out.append(('el%02d_az%05.1f' % (el, 360.0 * k / n), 360.0 * k / n, el))
    out += [('top', 0.0, 90.0), ('bottom', 0.0, -90.0)]
    return out


def az_name(az):
    names = {0: 'front', 45: 'front-left', 90: 'left', 135: 'back-left', 180: 'back', 225: 'back-right',
             270: 'right', 315: 'front-right'}
    return names.get(int(az) if az == int(az) else -1, '')


def label(az, el):
    if el >= 89.9:
        return 'top'
    if el <= -89.9:
        return 'bottom'
    n = az_name(az)
    return 'az %.1f%s el %g' % (az, ' (%s)' % n if n else '', el)


def static_closeup_targets(piece, limit):
    """Where defects hide: gaps and joins between separate parts, and contacts with the floor."""
    parts = C.mesh_parts(piece)
    data = {p: C.bvh_of(p) for p in parts}
    gaps, joins, floor = [], [], []
    for i, a in enumerate(parts):
        for b in parts[i + 1:]:
            d, mid, _n = C.contact(data[a], data[b])
            if mid is None:
                continue
            if d <= 0.003:
                joins.append(('join %s + %s' % (a.name, b.name), mid))
            elif d <= 0.05:
                gaps.append(('gap %.3f %s + %s' % (d, a.name, b.name), mid))
    allv = [v for p in parts for v in data[p][1]]
    zmin = min(v.z for v in allv)
    lo, hi = C.bbox(allv)
    mid = (lo + hi) / 2
    low = [v for v in allv if v.z <= zmin + 0.004]
    # the outer edge of the contact is where a gap or a sink shows; the middle of a flat base shows nothing
    for sx, sy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        v = max(low, key=lambda p: (p.x - mid.x) * sx + (p.y - mid.y) * sy)
        if all((v - f[1]).length > 0.05 for f in floor):
            floor.append(('floor contact %d (lowest %.3f)' % (len(floor) + 1, zmin), v))
    picked = gaps + joins[:max(0, limit - len(gaps) - 2)] + floor[:2]
    return picked[:limit]


def flush(images, out, tmp):
    """Composite the sheets rendered so far (system python3 + Pillow), add them to index.txt, drop the cells."""
    if not images:
        return
    lay = os.path.join(tmp, 'layout.json')
    with open(lay, 'w') as fh:
        json.dump({'images': images, 'index': os.path.join(out, 'index.txt')}, fh)
    subprocess.run([shutil.which('python3') or 'python3', os.path.abspath(__file__), '--composite', lay], check=True)
    for img in images:
        for c in img['cells']:
            try:
                os.remove(c['file'])
            except OSError:
                pass
    del images[:]


def run_blender(opts):
    out = os.path.abspath(opts['out'])
    os.makedirs(out, exist_ok=True)
    skip = set(C.csv(opts.get('skip')))
    if not opts.get('groups') and 'orbit' not in skip and os.path.exists(os.path.join(out, 'index.txt')):
        os.remove(os.path.join(out, 'index.txt'))       # a full orbit run starts a fresh index; batches append
    tmp = tempfile.mkdtemp(prefix='look_')
    pieces = C.setup_scene(opts)
    rigs = [p for p in pieces if C.rig_of(p)]
    R = Renderer(opts, tmp)
    images = []
    views = view_list(opts)
    cell = R.cell

    held = None
    if rigs and opts.get('clip_props'):
        if not opts.get('props_file'):
            sys.exit('--clip-props needs --props-file (the file the held props come from).')
        held = C.HeldProps(C.rig_of(rigs[0]), opts['file'], opts['clip_props'], opts['props_file'])
    held_now = []
    if opts.get('pose') and rigs:
        for r in rigs:
            arm = C.rig_of(r)
            C.set_clip(arm, opts['pose'], C.clip_frames(opts['pose'], [1])[0])
        if held:
            held_now = held.pose(opts['pose'], C.clip_frames(opts['pose'], [1])[0])
    else:
        for r in rigs:
            C.rest_pose(C.rig_of(r))

    # subjects: a scene with a rig is one subject (rig + props together); static pieces go in groups, by size
    if rigs:
        groups = [pieces]
        together = True
    else:
        size = {p: sphere(C.mesh_parts(p))[1] for p in pieces}
        order = sorted(pieces, key=lambda p: size[p])
        n = -(-len(order) // int(opts['group_size']))             # as few groups as the size allows, evened out
        g = -(-len(order) // n)
        groups = [order[i:i + g] for i in range(0, len(order), g)]
        together = False
    only = [int(x) for x in C.csv(opts.get('groups'))]

    for gi, grp in enumerate(groups, 1):
        if only and gi not in only:
            continue
        tag = 'scene' if together else 'g%d' % gi
        units = [grp] if together else [[p] for p in grp]       # each unit is framed and rendered on its own
        frames = []
        for u in units:
            parts = [m for p in u for m in C.mesh_parts(p)] + (held_now if together else [])
            frames.append((u, parts) + sphere(parts))
        float_ok = set(C.csv(opts.get('float_ok')))     # pieces that rest on something else: a floor would hide them
        print('GROUP', tag, [p.name for p in grp])
        if 'orbit' not in skip:
            vcell = int(cell * 1.9) if together else cell          # one subject per image: draw it bigger
            for vname, az, el in views:
                cells = []
                for (u, parts, c, r) in frames:
                    nm = '+'.join(p.name for p in u)
                    fl = not any(p.name in float_ok for p in u)
                    for mode in ('house', 'xray'):
                        cells.append({'file': R.shot(parts, parts, mode, c, r, az, el, size=vcell, floor=fl),
                                      'label': '%s  %s' % (nm, mode)})
                images.append({'out': os.path.join(out, 'views', '%s_%s.png' % (tag, vname)), 'cols': 2 if together else 4,
                               'cell': vcell, 'title': '%s  view %s' % (tag, label(az, el)), 'cells': cells})
        if 'closeups' not in skip and not together:
            budget = int(opts['max_closeups'])
            for (u, parts, c, r) in frames:
                for (what, at) in static_closeup_targets(u[0], 3):
                    if budget <= 0:
                        break
                    budget -= 1
                    s = max(0.12, r * 0.45)
                    cells = []
                    for mode in ('house', 'xray'):
                        for az, el in ((45, 30), (225, 30), (315, 5), (135, -35)):
                            cells.append({'file': R.shot(parts, parts, mode, at, r, az, el, s,
                                                         floor=u[0].name not in float_ok),
                                          'label': '%s %s' % (mode, label(az, el))})
                    safe = ''.join(ch if ch.isalnum() else '_' for ch in what)[:60]
                    images.append({'out': os.path.join(out, 'closeups', '%s_%s_%s.png' % (tag, u[0].name, safe)),
                                   'cols': 4, 'cell': cell, 'title': '%s close-up: %s' % (u[0].name, what), 'cells': cells})
        flush(images, out, tmp)

    # rigged: every sampled frame of every clip, from four sides, plus close-ups of hands, feet and prop contacts
    if rigs and 'clips' not in skip and opts.get('clips'):
        rig = rigs[0]
        arm = C.rig_of(rig)
        rig_parts = C.mesh_parts(rig)
        props = [p for p in pieces if p is not rig]
        prop_parts = [m for p in props for m in C.mesh_parts(p)]
        allp = rig_parts + prop_parts
        bones = C.csv(opts.get('bones')) or C.guess_bones(arm)
        print('BONES', bones)
        for clip in C.csv(opts['clips']):
            fr = C.clip_frames(clip, C.csv(opts['frames']))
            spheres = []
            for f in fr:
                C.set_clip(arm, clip, f)
                shown = held.pose(clip, f) if held else []
                spheres.append(sphere(allp + shown))
            c = sum((s[0] for s in spheres), Vector()) / len(spheres)
            r = max((s[0] - c).length + s[1] for s in spheres)
            hscale = max(0.25, r * 0.8)        # wide enough to show the hand or foot AND what it meets
            for fi, f in enumerate(fr):
                C.set_clip(arm, clip, f)
                shown = held.pose(clip, f) if held else []
                allp = rig_parts + prop_parts + shown
                cells = []
                for mode in ('house', 'xray'):
                    for az in (0, 90, 180, 270):
                        cells.append({'file': R.shot(allp, allp, mode, c, r, az, 15),
                                      'label': '%s %s' % (mode, label(az, 15))})
                images.append({'out': os.path.join(out, 'clips', '%s_f%02d.png' % (clip, fi)), 'cols': 4, 'cell': cell,
                               'title': '%s  frame %.1f (%d of %d)' % (clip, f, fi + 1, len(fr)), 'cells': cells})
                targets = [(b, C.bone_point(arm, b)) for b in bones]
                rig_data = [C.bvh_of(m) for m in rig_parts]
                for pp in prop_parts + shown:                              # where the rig comes closest to (or into) a prop
                    pd = C.bvh_of(pp)
                    best = min((C.contact(rd, pd) for rd in rig_data), key=lambda t: t[0])
                    if best[1] is not None and best[0] < 0.05:
                        targets.append(('%s %s %.3f' % (pp.name, 'crosses' if best[0] == 0 else 'gap', best[0]), best[1]))
                cells = []
                for (bn, at) in targets[:6]:
                    if at is None:
                        continue
                    side = 90 if at.x >= c.x else 270                 # look from the side the target is on
                    q34 = 45 if side == 90 else 315
                    for mode, az, el in (('house', q34, 20), ('house', side, 5), ('xray', q34, 20), ('xray', side, -25)):
                        cells.append({'file': R.shot(allp, allp, mode, at, r, az, el, hscale),
                                      'label': '%s %s %s' % (bn, mode, label(az, el))})
                images.append({'out': os.path.join(out, 'clips', '%s_f%02d_closeup.png' % (clip, fi)), 'cols': 4,
                               'cell': int(cell * 0.8), 'title': '%s frame %.1f close-ups' % (clip, f), 'cells': cells})
            flush(images, out, tmp)
    flush(images, out, tmp)
    shutil.rmtree(tmp, ignore_errors=True)


# ============================================================================ Pillow side
def composite(lay_path):
    from PIL import Image, ImageDraw, ImageFont
    lay = json.load(open(lay_path))

    def font(size):
        for f in ('/System/Library/Fonts/Supplemental/Arial.ttf', 'arial.ttf', 'DejaVuSans.ttf'):
            try:
                return ImageFont.truetype(f, size)
            except OSError:
                pass
        return ImageFont.load_default()

    ft, fl = font(22), font(15)
    lines = []
    for img in lay['images']:
        cols, cell = img['cols'], img['cell']
        n = len(img['cells'])
        rows = (n + cols - 1) // cols
        LAB, TITLE, GAP = 20, 34, 4
        W = cols * (cell + GAP) + GAP
        H = TITLE + rows * (cell + LAB + GAP) + GAP
        sheet = Image.new('RGB', (W, H), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        d.rectangle([0, 0, W, TITLE - 4], fill=(232, 232, 236))
        d.text((8, 5), img['title'], fill=(20, 20, 20), font=ft)
        for i, c in enumerate(img['cells']):
            x = GAP + (i % cols) * (cell + GAP)
            y = TITLE + (i // cols) * (cell + LAB + GAP)
            text = c['label']
            while len(text) > 4 and d.textlength(text, font=fl) > cell - 4:   # keep the label inside its cell
                text = text[:-2]
            d.text((x + 2, y + 2), text if text == c['label'] else text + '..', fill=(70, 70, 80), font=fl)
            im = Image.open(c['file']).convert('RGB').resize((cell, cell))
            sheet.paste(im, (x, y + LAB))
            d.rectangle([x - 1, y + LAB - 1, x + cell, y + LAB + cell], outline=(185, 185, 190))
        os.makedirs(os.path.dirname(img['out']), exist_ok=True)
        sheet.save(img['out'])
        lines.append('%s\t%s' % (img['out'], img['title']))
    with open(lay['index'], 'a') as fh:
        fh.write('\n'.join(lines) + '\n')
    for ln in lines:
        print('IMAGE', ln)
    print('INDEX', lay['index'], len(lines), 'images')


DEFAULTS = {'out': 'look-out', 'group_size': 6, 'azimuths': 16, 'elevations': '5,30,60', 'frames': '0,.25,.5,.75,1',
            'cell': 360, 'crease': 25, 'max_closeups': 30}

if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--composite':
        composite(sys.argv[2])
    elif IN_BLENDER:
        run_blender(C.parse(DEFAULTS, USAGE))
    else:
        sys.exit('Run inside Blender:\n' + USAGE)
