import skinData from '../../assets/avatar-skins.json' with { type: 'json' };
import { makeChamferedGeometry } from '../items/lab-prop-shapes.js';

export const AVATAR_SKINS = Object.freeze(skinData);
const catalog = new Map(AVATAR_SKINS.map(skin => [skin.id, skin]));
const THREE = window.THREE;
let swatchGeometries;

export function getAvatarSkin(id, role) {
  const skin = catalog.get(id);
  const faculty = role === 'professor' || role === 'admin';
  if (skin && (!skin.faculty || faculty)) return skin;
  return catalog.get(faculty ? 'faculty' : 'campus');
}

function getSwatchGeometries() {
  if (swatchGeometries) return swatchGeometries;
  swatchGeometries = {
    panel: makeChamferedGeometry(1, 1, 1, 0.15),
    tuft: new THREE.IcosahedronGeometry(0.6, 0),
    frames: new THREE.TorusGeometry(0.5, 0.075, 4, 10)
  };
  for (const geometry of Object.values(swatchGeometries)) geometry.userData.shared = true;
  return swatchGeometries;
}

export function applyAvatarSkin(avatar, skinId, role) {
  const skin = getAvatarSkin(skinId, role);
  if (avatar.current_skin === skin.id) return skin;
  avatar.current_skin = skin.id;
  const { panel, tuft, frames } = getSwatchGeometries();
  const { hairMat, accentMat, pantsMat, skinMat, bodyMat, skinHair, skinOutfit } = avatar;
  bodyMat.color.set(skin.top);
  pantsMat.color.set(skin.pants);
  skinMat.color.set(skin.skin);
  hairMat.color.set(skin.hair);
  accentMat.color.set(skin.accent);
  skinHair.clear();
  skinOutfit.clear();

  function piece(parent, geometry, material, x, y, z, w, h, d, roll = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.rotation.z = roll;
    parent.add(mesh);
  }

  piece(skinHair, panel, hairMat, 0, 0.222, 0.035, 0.37, 0.17, 0.31);
  if (skin.cut === 'curls') {
    for (const [x, y, z] of [[-0.15, 0.22, -0.055], [0.15, 0.22, -0.055], [-0.09, 0.29, -0.08], [0.08, 0.29, -0.08], [0, 0.303, 0.072]]) {
      piece(skinHair, tuft, hairMat, x, y, z, 0.18, 0.17, 0.18);
    }
  } else if (skin.cut !== 'crop') {
    const long = skin.cut === 'waves' || skin.cut === 'bob';
    for (const side of [-1, 1]) {
      piece(skinHair, panel, hairMat, side * 0.163, long ? 0.132 : 0.196, 0.058, 0.082, long ? 0.21 : 0.11, 0.265, side * 0.12);
    }
    piece(skinHair, tuft, hairMat, -0.078, 0.257, -0.128, 0.19, 0.13, 0.19, -0.36);
    piece(skinHair, tuft, hairMat, 0.064, 0.265, -0.107, 0.21, 0.13, 0.19, -0.28);
  }
  if (skin.glasses) {
    for (const x of [-0.084, 0.084]) piece(skinHair, frames, accentMat, x, 0.105, -0.188, 0.111, 0.104, 0.11);
    piece(skinHair, panel, accentMat, 0, 0.109, -0.191, 0.057, 0.016, 0.017);
  }

  if (skin.outfit === 'apron') {
    piece(skinOutfit, panel, accentMat, 0, -0.056, -0.139, 0.249, 0.34, 0.035);
    for (const x of [-0.082, 0.082]) piece(skinOutfit, panel, accentMat, x, 0.153, -0.139, 0.034, 0.15, 0.028);
  } else if (skin.outfit === 'overalls') {
    piece(skinOutfit, panel, accentMat, 0, -0.055, -0.145, 0.26, 0.22, 0.036);
    for (const x of [-0.102, 0.102]) piece(skinOutfit, panel, accentMat, x, 0.104, -0.141, 0.048, 0.23, 0.024);
    piece(skinOutfit, panel, pantsMat, 0, -0.022, -0.17, 0.110, 0.078, 0.022);
  } else if (skin.outfit === 'scarf') {
    piece(skinOutfit, panel, accentMat, 0, 0.194, -0.041, 0.31, 0.085, 0.25);
    piece(skinOutfit, panel, accentMat, 0.062, 0.083, -0.155, 0.076, 0.19, 0.033, -0.07);
  } else if (skin.outfit === 'hoodie') {
    piece(skinOutfit, panel, bodyMat, 0, 0.187, 0.118, 0.31, 0.14, 0.103);
    for (const x of [-0.053, 0.053]) piece(skinOutfit, panel, accentMat, x, 0.139, -0.139, 0.024, 0.118, 0.018);
    piece(skinOutfit, panel, bodyMat, 0, -0.104, -0.158, 0.252, 0.103, 0.045);
  } else if (skin.outfit === 'satchel') {
    piece(skinOutfit, panel, accentMat, 0, 0.015, -0.145, 0.049, 0.46, 0.022, -0.57);
    piece(skinOutfit, panel, accentMat, -0.124, -0.15, -0.164, 0.15, 0.123, 0.065);
  } else if (skin.outfit === 'sweater') {
    piece(skinOutfit, panel, bodyMat, 0, 0.229, -0.013, 0.198, 0.047, 0.171);
    piece(skinOutfit, panel, accentMat, 0, -0.035, -0.143, 0.372, 0.058, 0.022);
    piece(skinOutfit, panel, accentMat, 0, -0.147, -0.143, 0.372, 0.040, 0.022);
  } else if (skin.outfit === 'track') {
    for (const x of [-0.153, 0.153]) piece(skinOutfit, panel, accentMat, x, 0.01, -0.136, 0.045, 0.40, 0.018);
  } else {
    for (const side of [-1, 1]) {
      piece(skinOutfit, panel, accentMat, side * 0.086, 0.067, -0.144, 0.105, skin.outfit === 'coat' ? 0.30 : 0.19, 0.028, side * 0.15);
      const outerwear = skin.outfit === 'utility' || skin.outfit === 'vest';
      piece(skinOutfit, panel, outerwear ? accentMat : pantsMat, side * 0.108, -0.104, -0.144, 0.095, 0.078, 0.037);
      if (skin.outfit === 'utility') {
        piece(skinOutfit, panel, accentMat, side * 0.144, 0.052, -0.163, 0.097, 0.109, 0.041);
      }
    }
  }
  return skin;
}
