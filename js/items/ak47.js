import { mergeStaticGeos, registerPickable } from './item-registry.js';

export const AK47_PREFAB = 'ak47';
export const AK47_MUZZLE = [0, 0.272, -0.595];
export const AK47_EJECTION_PORT = [0.036, 0.279, -0.035];

export function makeAk47(ctx, opts) {
  const THREE = window.THREE;
  const rifle = new THREE.Group();
  const materials = {
    blued: new THREE.MeshStandardMaterial({ color: 0x283038, metalness: 0.62, roughness: 0.36 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x575e64, metalness: 0.67, roughness: 0.39 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a4830, roughness: 0.61 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x673321, roughness: 0.68 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.65 })
  };
  const pieces = Object.fromEntries(Object.keys(materials).map(key => [key, []]));
  const box = (key, x, y, z, w, h, d, rx = 0) => {
    pieces[key].push({ geo: new THREE.BoxGeometry(w, h, d), x, y, z, rx });
  };
  const tube = (key, x, y, z, r, length, alongX = false) => {
    pieces[key].push({
      geo: new THREE.CylinderGeometry(r, r, length, 10), x, y, z,
      rx: alongX ? 0 : Math.PI / 2, rz: alongX ? Math.PI / 2 : 0
    });
  };
  // Extrude the silhouette evenly on either side of the centerline.
  const panel = (key, width, outline, bevel = 0.003) => {
    const contour = new THREE.Shape();
    outline.forEach(([z, y], index) => {
      if (index === 0) contour.moveTo(-z, y);
      else contour.lineTo(-z, y);
    });
    contour.closePath();
    const geo = new THREE.ExtrudeGeometry(contour, {
      depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel,
      bevelSize: bevel, bevelSegments: 1, steps: 1
    });
    pieces[key].push({ geo, x: -width / 2 + bevel, ry: Math.PI / 2 });
  };

  // Receiver, raised cover, and the two rails of the folding stock.
  panel('blued', 0.069, [[0.174, 0.237], [0.146, 0.203], [-0.193, 0.203], [-0.21, 0.265], [0.174, 0.267]]);
  panel('steel', 0.061, [[0.171, 0.265], [-0.196, 0.265], [-0.182, 0.298], [0.13, 0.3], [0.171, 0.283]]);
  panel('steel', 0.033, [[0.166, 0.253], [0.377, 0.246], [0.377, 0.231], [0.166, 0.236]]);
  panel('steel', 0.027, [[0.171, 0.227], [0.378, 0.161], [0.378, 0.18], [0.18, 0.243]]);
  box('blued', 0, 0.203, 0.386, 0.052, 0.099, 0.018, 0.04);
  box('black', 0, 0.203, 0.397, 0.054, 0.102, 0.008, 0.04);

  // Amber handguard and grip, with dark bands and shallow inlaid grooves.
  panel('wood', 0.071, [[-0.202, 0.267], [-0.219, 0.224], [-0.361, 0.224], [-0.392, 0.252], [-0.388, 0.296], [-0.214, 0.296]], 0.007);
  panel('darkWood', 0.05, [[-0.226, 0.298], [-0.363, 0.298], [-0.351, 0.32], [-0.245, 0.32]], 0.004);
  panel('wood', 0.039, [[0.082, 0.214], [0.137, 0.202], [0.185, 0.086], [0.136, 0.07], [0.1, 0.144]], 0.004);
  box('blued', 0, 0.262, -0.389, 0.066, 0.072, 0.016);

  // The curved magazine is a single beveled profile with ribs mirrored on both faces.
  panel('blued', 0.052, [[-0.079, 0.216], [-0.169, 0.216], [-0.177, 0.155], [-0.202, 0.095],
    [-0.25, 0.031], [-0.199, 0.005], [-0.153, 0.068], [-0.109, 0.145]], 0.005);
  panel('steel', 0.055, [[-0.25, 0.031], [-0.199, 0.005], [-0.193, 0.016], [-0.241, 0.044]]);
  panel('steel', 0.055, [[-0.117, 0.176], [-0.13, 0.118], [-0.159, 0.059], [-0.18, 0.032],
    [-0.187, 0.037], [-0.167, 0.064], [-0.14, 0.119], [-0.126, 0.174]], 0.001);
  panel('steel', 0.055, [[-0.147, 0.183], [-0.161, 0.12], [-0.189, 0.067], [-0.21, 0.046],
    [-0.218, 0.051], [-0.197, 0.073], [-0.169, 0.125], [-0.156, 0.183]], 0.001);

  panel('steel', 0.022, [[0.089, 0.216], [0.082, 0.165], [0.065, 0.151], [-0.024, 0.151],
    [-0.055, 0.174], [-0.058, 0.215], [-0.046, 0.215], [-0.042, 0.18], [-0.02, 0.161], [0.063, 0.161], [0.077, 0.216]]);
  panel('steel', 0.012, [[0.016, 0.219], [0, 0.2], [0.008, 0.174], [0.021, 0.172], [0.017, 0.188], [0.029, 0.21]], 0.001);

  tube('blued', 0, 0.272, -0.464, 0.013, 0.22);
  tube('steel', 0, 0.303, -0.411, 0.014, 0.075);
  tube('steel', 0, 0.272, -0.565, 0.019, 0.051);
  tube('black', 0, 0.272, -0.591, 0.011, 0.002);
  panel('blued', 0.022, [[-0.466, 0.27], [-0.508, 0.27], [-0.506, 0.333], [-0.492, 0.333], [-0.483, 0.289]]);
  panel('steel', 0.038, [[-0.153, 0.294], [-0.205, 0.294], [-0.191, 0.32], [-0.169, 0.32]]);
  for (const side of [-1, 1]) {
    box('steel', side * 0.014, 0.337, -0.5, 0.007, 0.023, 0.017);
    box('darkWood', side * 0.035, 0.265, -0.301, 0.003, 0.006, 0.121);
    box('darkWood', side * 0.035, 0.251, -0.306, 0.003, 0.004, 0.113);
    for (const z of [0.137, 0.105, -0.127, -0.175]) {
      tube('steel', side * 0.034, 0.244, z, 0.006, 0.007, true);
    }
  }
  box('black', 0.031, 0.278, -0.03, 0.005, 0.023, 0.112);
  panel('black', 0.005, [[-0.494, 0.332], [-0.504, 0.332], [-0.5, 0.346]], 0.001);

  for (const [key, specs] of Object.entries(pieces)) {
    const merged = mergeStaticGeos(specs, { shared: false });
    if (merged) {
      rifle.add(new THREE.Mesh(merged, materials[key]));
      specs.forEach(({ geo }) => geo.dispose());
    } else {
      for (const { geo, x, y, z, rx, ry, rz } of specs) {
        const mesh = new THREE.Mesh(geo, materials[key]);
        mesh.position.set(x ?? 0, y ?? 0, z ?? 0);
        mesh.rotation.set(rx ?? 0, ry ?? 0, rz ?? 0);
        rifle.add(mesh);
      }
    }
  }
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.044), materials.steel);
  bolt.name = 'ak47-bolt';
  bolt.position.set(0.035, 0.278, -0.049);
  rifle.add(bolt);
  rifle.traverse(child => { if (child.isMesh) child.castShadow = true; });
  rifle.userData.isAk47 = true;
  rifle.userData.firstPersonGrip = { x: 0.021, y: 0.145, z: 0.137 };
  rifle.userData.firstPersonSupportGrip = { x: -0.026, y: 0.235, z: -0.266 };
  return registerPickable(ctx, opts.id, opts.label || 'AK-47', rifle, opts.x, opts.y, opts.z, opts.ry, 0.5, 0.35, {
    category: 'weapon', weightGrams: 3100, compatibilities: { canEnterCooker: false }
  });
}
