import { mergeStaticGeos, registerPickable } from './item-registry.js';

export const CAMPUS_PICKUP_ID = 'campus_pickup';
export const PICKUP_DOOR_X = 1.27;
export const PICKUP_DOOR_Z = -0.11;

export function makeCampusPickup(ctx, opts) {
  const THREE = window.THREE;
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xe4ce9e, roughness: 0.57, metalness: 0.13 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xbd563b, roughness: 0.57, metalness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x293039, roughness: 0.75 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x252326, roughness: 0.98 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa1a4a3, metalness: 0.62, roughness: 0.41 });
  const upholstery = new THREE.MeshStandardMaterial({ color: 0x816349, roughness: 0.92 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x88cde9, roughness: 0.2, metalness: 0.12, transparent: true, opacity: 0.24,
    side: THREE.DoubleSide, depthWrite: false
  });
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xb9dce8, emissive: 0xb6ddff, emissiveIntensity: 0.22, roughness: 0.3 });
  const taillamp = new THREE.MeshStandardMaterial({ color: 0xb83232, emissive: 0xc13227, emissiveIntensity: 0.32 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x1e282b, emissive: 0x4cf4c2, emissiveIntensity: 0.1 });

  function box(parent, mat, x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mat !== glass;
    mesh.receiveShadow = mat !== glass;
    parent.add(mesh);
    return mesh;
  }

  function bar(parent, mat, a, b, thickness) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const middle = start.clone().lerp(end, 0.5);
    const beam = box(parent, mat, middle.x, middle.y, middle.z, thickness, start.distanceTo(end), thickness);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return beam;
  }

  function batchBodyParts(parent) {
    const byMaterial = new Map();
    for (const child of parent.children) {
      if (!child.isMesh) continue;
      if (!byMaterial.has(child.material)) byMaterial.set(child.material, []);
      byMaterial.get(child.material).push(child);
    }
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const specs = meshes.map(mesh => ({
        geo: mesh.geometry, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
        rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z
      }));
      const geometry = mergeStaticGeos(specs, { shared: false });
      if (!geometry) continue;
      const combined = new THREE.Mesh(geometry, material);
      combined.castShadow = meshes.some(mesh => mesh.castShadow);
      combined.receiveShadow = meshes.some(mesh => mesh.receiveShadow);
      parent.add(combined);
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
    }
  }

  const truckWidth = 1.94;
  box(car, dark, 0, 0.52, 0, 1.68, 0.24, 4.42);
  box(car, orange, 0, 0.58, -2.25, 2.11, 0.36, 0.28);
  box(car, orange, 0, 0.62, 2.28, 2.1, 0.28, 0.21);
  box(car, paint, 0, 0.97, -1.6, truckWidth, 0.36, 1.26);
  box(car, orange, 0, 1.162, -1.57, 1.05, 0.045, 1.2);
  box(car, paint, 0, 1.24, -1.54, 0.62, 0.12, 0.5).rotation.x = -0.075;
  box(car, dark, 0, 1.23, -1.803, 0.55, 0.062, 0.03);
  box(car, paint, 0, 0.68, -0.02, 1.84, 0.14, 1.95);
  box(car, upholstery, 0, 0.764, 0.04, 1.76, 0.045, 1.8);
  box(car, paint, 0, 2.07, -0.02, 1.86, 0.13, 1.54);
  box(car, orange, 0, 2.145, -0.02, 1.11, 0.032, 1.48);
  box(car, dark, 0, 0.87, 1.67, 1.75, 0.12, 1.26);
  box(car, orange, 0, 1.04, 0.97, 1.79, 0.31, 0.14);
  box(car, paint, 0, 1.01, 2.21, truckWidth, 0.46, 0.15);
  box(car, orange, 0, 1.25, 2.21, 1.72, 0.065, 0.17);
  box(car, metal, 0, 1.2, 2.3, 0.32, 0.045, 0.056);
  box(car, glass, 0, 1.71, -0.917, 1.73, 0.695, 0.05).rotation.x = 0.28;
  box(car, glass, 0, 1.71, 0.76, 1.69, 0.68, 0.05).rotation.x = -0.06;
  box(car, dark, 0, 1.175, -0.769, 1.76, 0.26, 0.36);
  box(car, upholstery, 0, 1.32, -0.78, 1.73, 0.042, 0.39);
  box(car, orange, 0, 1.15, -0.562, 0.49, 0.22, 0.10);
  box(car, dark, 0, 1.19, -0.503, 0.31, 0.10, 0.025);
  box(car, screen, -0.026, 1.20, -0.487, 0.18, 0.037, 0.004);
  box(car, metal, 0.112, 1.19, -0.485, 0.04, 0.042, 0.017);
  box(car, dark, 0, 0.87, 0.02, 0.25, 0.28, 0.91);
  box(car, metal, 0, 1.095, -0.03, 0.047, 0.18, 0.047).rotation.x = -0.34;
  box(car, dark, 0, 1.189, -0.067, 0.085, 0.067, 0.072);
  box(car, dark, -0.51, 1.335, -0.59, 0.42, 0.13, 0.10);
  for (const x of [-0.62, -0.50, -0.38]) box(car, screen, x, 1.34, -0.535, 0.056, 0.05, 0.01);

  const steering = new THREE.Group();
  steering.position.set(-0.51, 1.29, -0.405);
  steering.rotation.x = -0.29;
  car.add(steering);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.024, 7, 16), dark);
  steering.add(ring);
  box(steering, dark, 0, 0, 0, 0.31, 0.042, 0.031);
  box(steering, dark, 0, -0.076, 0, 0.043, 0.15, 0.031);
  box(steering, metal, 0, 0, 0.018, 0.11, 0.093, 0.038);

  const doors = {};
  const wheels = [];
  for (const side of [-1, 1]) {
    const seatX = side * 0.49;
    box(car, upholstery, seatX, 0.924, 0.11, 0.58, 0.21, 0.64);
    box(car, upholstery, seatX, 1.21, 0.42, 0.59, 0.59, 0.16).rotation.x = -0.14;
    box(car, dark, seatX, 1.59, 0.462, 0.27, 0.17, 0.135);
    box(car, dark, side * 1.01, 0.63, -0.025, 0.23, 0.13, 1.69);
    box(car, orange, side * 0.905, 1.67, 0.76, 0.12, 0.79, 0.16);
    bar(car, paint, [side * 0.902, 1.345, -1.005], [side * 0.871, 2.078, -0.798], 0.074);
    box(car, paint, side * 0.95, 1.086, 1.53, 0.17, 0.52, 1.43);
    box(car, orange, side * 0.96, 1.345, 1.54, 0.18, 0.065, 1.39);
    bar(car, metal, [side * 0.89, 1.34, 1.86], [side * 0.78, 1.96, 1.02], 0.045);
    bar(car, metal, [side * 0.78, 1.96, 1.02], [side * 0.75, 1.93, 2.08], 0.045);
    bar(car, metal, [side * 0.75, 1.93, 2.08], [side * 0.89, 1.34, 2.17], 0.045);
    const door = new THREE.Group();
    door.position.set(side * 0.942, 0, -0.885);
    car.add(door);
    doors[side < 0 ? 'driver' : 'passenger'] = door;
    box(door, paint, 0, 1.045, 0.775, 0.135, 0.55, 1.49);
    box(door, dark, side * -0.076, 1.024, 0.79, 0.039, 0.39, 1.32);
    box(door, upholstery, side * -0.111, 1.17, 0.81, 0.082, 0.08, 0.72);
    box(door, metal, side * 0.083, 1.24, 1.25, 0.038, 0.049, 0.175);
    box(door, glass, 0, 1.667, 0.81, 0.03, 0.62, 1.29);
    bar(door, paint, [0, 1.34, 0.083], [0, 1.996, 0.27], 0.056);
    bar(door, paint, [0, 1.996, 0.27], [0, 1.996, 1.456], 0.055);
    bar(door, paint, [0, 1.996, 1.456], [0, 1.33, 1.456], 0.055);
    box(door, paint, side * 0.196, 1.425, 0.24, 0.21, 0.15, 0.25);
    box(door, metal, side * 0.196, 1.425, 0.373, 0.168, 0.10, 0.015);

    for (const z of [-1.45, 1.45]) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(side * 0.99, 0.46, z);
      car.add(steerPivot);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const roll = new THREE.Group();
      steerPivot.add(roll);
      roll.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.35, 12), metal);
      rim.rotation.z = Math.PI / 2;
      roll.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.109, 0.109, 0.387, 10), dark);
      hub.rotation.z = Math.PI / 2;
      roll.add(hub);
      for (let n = 0; n < 10; n++) {
        const a = n / 10 * Math.PI * 2;
        const tread = box(roll, rubber, 0, Math.cos(a) * 0.443, Math.sin(a) * 0.443, 0.34, 0.025, 0.11);
        tread.rotation.x = a;
      }
      for (let n = 0; n < 5; n++) {
        const a = (n - 2) * 0.565;
        const flare = box(car, orange, side * 1.017, 0.46 + Math.cos(a) * 0.522,
          z + Math.sin(a) * 0.522, 0.32, 0.095, 0.32);
        flare.rotation.x = a;
      }
      wheels.push({ steerPivot, roll, front: z < 0 });
    }
    box(car, headlamp, side * 0.785, 0.985, -2.248, 0.33, 0.22, 0.078);
    box(car, taillamp, side * 0.822, 1.02, 2.308, 0.25, 0.2, 0.045);
  }

  box(car, dark, 0, 0.95, -2.27, 1.15, 0.31, 0.05);
  for (const y of [0.84, 0.95, 1.055]) {
    bar(car, metal, [-0.91, y, -2.46], [0.91, y, -2.46], 0.044);
  }
  for (const x of [-0.73, 0.73]) bar(car, metal, [x, 0.62, -2.38], [x, 1.13, -2.44], 0.055);
  for (const x of [-0.60, -0.20, 0.20, 0.60]) {
    box(car, dark, x, 2.235, -0.63, 0.23, 0.175, 0.15);
    box(car, headlamp, x, 2.235, -0.719, 0.166, 0.117, 0.035);
  }
  bar(car, metal, [-0.77, 2.17, -0.60], [0.77, 2.17, -0.60], 0.051);
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.27, 14), rubber);
  spare.position.set(0, 1.04, 2.39);
  spare.rotation.x = Math.PI / 2;
  car.add(spare);
  const spareHub = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.28, 10), metal);
  spareHub.position.copy(spare.position);
  spareHub.rotation.copy(spare.rotation);
  car.add(spareHub);
  const headlightGlow = new THREE.PointLight(0xb6ddff, 0, 14, 2);
  headlightGlow.position.set(0, 0.96, -2.9);
  car.add(headlightGlow);
  batchBodyParts(car);
  batchBodyParts(steering);
  batchBodyParts(doors.driver);
  batchBodyParts(doors.passenger);
  for (const wheel of wheels) batchBodyParts(wheel.roll);
  car.userData.isCampusPickup = true;
  const item = registerPickable(ctx, opts.id, opts.label || 'Picape Off-road', car,
    opts.x, opts.y, opts.z, opts.ry, 2.64, 2.34, { category: 'vehicle', compatibilities: { canEnterCooker: false } });
  item.campusCar = {
    doors, wheels, steering, headlamp, headlightGlow, taillamp, screen, origin: new THREE.Vector3(opts.x, opts.y, opts.z),
    targetYaw: opts.ry, speed: 0, steer: 0, wheelSpin: 0, lights: false,
    driver: '', passenger: '', owned: true, hosted: false, updated: false,
    doorUntil: { driver: 0, passenger: 0 }
  };
  (ctx.scene.userData.campusCars ||= []).push(item);
  return item;
}
