import { buildSnowboardRig } from './vehicles/snowboard.js';
import { buildParagliderRig, buildThermalColumns } from './vehicles/paraglider.js';

export function buildFirstPersonArm(ctx) {
  var fpsArmGroup = new THREE.Group();
  var fpsSleeveMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.6 });
  var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
  var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), fpsSleeveMat);
  sleeve.position.set(0, 0, 0.18);
  var hand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
  hand.position.set(0, 0, -0.066);
  fpsArmGroup.add(sleeve, hand);
  fpsArmGroup.userData.handMat = skinMat;
  fpsArmGroup.position.set(0.32, -0.28, -0.42);
  fpsArmGroup.rotation.set(0.18, -0.14, 0.05);
  fpsArmGroup.visible = false;
  ctx.camera.add(fpsArmGroup);

  var fpsLeftArmGroup = new THREE.Group();
  var sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), fpsSleeveMat);
  sleeveL.position.set(0, 0, 0.18);
  var handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
  handL.position.set(0, 0, -0.066);
  fpsLeftArmGroup.add(sleeveL, handL);
  fpsLeftArmGroup.position.set(-0.32, -0.28, -0.42);
  fpsLeftArmGroup.rotation.set(0.18, 0.14, -0.05);
  fpsLeftArmGroup.visible = false;
  ctx.camera.add(fpsLeftArmGroup);
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
