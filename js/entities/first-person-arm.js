import { buildSnowboardRig } from './vehicles/snowboard.js';
import { buildParagliderRig, buildThermalColumns } from './vehicles/paraglider.js';

export function buildFirstPersonArm(ctx) {
  const fpsSleeveMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.72 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xe3d7bc, roughness: 0.82 });
  const sleeveGeometry = new THREE.CylinderGeometry(0.063, 0.044, 0.30, 8);
  const cuffGeometry = new THREE.CylinderGeometry(0.049, 0.045, 0.028, 8);
  const handGeometry = new THREE.SphereGeometry(1, 10, 7);

  function makeArm() {
    const group = new THREE.Group();
    const sleeve = new THREE.Mesh(sleeveGeometry, fpsSleeveMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = 0.15;
    const cuff = new THREE.Mesh(cuffGeometry, cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.005;
    const hand = new THREE.Mesh(handGeometry, skinMat);
    hand.position.z = -0.05;
    hand.scale.set(0.043, 0.039, 0.064);
    group.add(sleeve, cuff, hand);
    group.userData.handMat = skinMat;
    group.visible = false;
    return group;
  }

  const fpsArmGroup = makeArm();
  fpsArmGroup.position.set(0.32, -0.28, -0.42);
  fpsArmGroup.rotation.set(0.18, -0.14, 0.05);

  const fpsLeftArmGroup = makeArm();
  fpsLeftArmGroup.position.set(-0.32, -0.28, -0.42);
  fpsLeftArmGroup.rotation.set(0.18, 0.14, -0.05);
  ctx.camera.add(fpsArmGroup, fpsLeftArmGroup);
  ctx.scene.add(ctx.camera);

  ctx.setFpsArmRefs({
    fpsArmGroup: fpsArmGroup,
    fpsLeftArmGroup: fpsLeftArmGroup,
    fpsSleeveMat: fpsSleeveMat
  });

  buildSnowboardRig(ctx);
  buildParagliderRig(ctx);
  buildThermalColumns(ctx);
}
