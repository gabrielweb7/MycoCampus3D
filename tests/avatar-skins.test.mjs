import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };

const { AVATAR_SKINS, getAvatarSkin, applyAvatarSkin } = await import('../js/entities/avatar-skins.js');

test('skin catalog offers three starters, ten purchases and one faculty outfit', () => {
  assert.equal(new Set(AVATAR_SKINS.map(skin => skin.id)).size, 14);
  assert.equal(AVATAR_SKINS.filter(skin => skin.price === 0 && !skin.faculty).length, 3);
  assert.equal(AVATAR_SKINS.filter(skin => skin.price > 0).length, 10);
  assert.equal(getAvatarSkin('faculty', 'student').id, 'campus');
  assert.equal(getAvatarSkin('', 'professor').id, 'faculty');
  assert.equal(getAvatarSkin('', 'admin').id, 'faculty');
  assert.equal(getAvatarSkin('lavender', 'professor').id, 'lavender');
});

test('all skin layers have real geometry and keep the independent hat when switched', () => {
  const avatar = {
    bodyMat: new THREE.MeshStandardMaterial(),
    pantsMat: new THREE.MeshStandardMaterial(),
    accentMat: new THREE.MeshStandardMaterial(),
    hairMat: new THREE.MeshStandardMaterial(),
    skinMat: new THREE.MeshStandardMaterial(),
    skinHair: new THREE.Group(),
    skinOutfit: new THREE.Group(),
    hatGroup: new THREE.Group(),
    current_hat: 'beret'
  };
  const hat = new THREE.Object3D();
  avatar.hatGroup.add(hat);
  const styles = new Set();
  for (const skin of AVATAR_SKINS) {
    const role = skin.faculty ? 'professor' : 'student';
    assert.equal(applyAvatarSkin(avatar, skin.id, role).id, skin.id);
    assert.equal(avatar.skinMat.color.getHexString(), skin.skin.slice(1));
    assert.ok(avatar.skinHair.children.length);
    assert.ok(avatar.skinOutfit.children.length);
    assert.strictEqual(avatar.hatGroup.children[0], hat);
    assert.equal(avatar.current_hat, 'beret');
    styles.add(avatar.skinOutfit.children.map(mesh => mesh.scale.toArray().join(',')).join('|'));
  }
  assert.ok(styles.size >= 8);
});
