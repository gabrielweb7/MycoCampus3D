/**
 * Animação 3D fofa de mão fazendo carinho + corações subindo para pets e vaquinhas.
 */
const THREE = window.THREE;
const activeAnimations = [];
let sharedHandGeo = null;
let sharedSkinMat = null;
let sharedHeartMat = null;

function createHandGroup() {
  const g = new THREE.Group();
  if (!sharedHandGeo) sharedHandGeo = new THREE.BoxGeometry(1, 1, 1);
  if (!sharedSkinMat) sharedSkinMat = new THREE.MeshStandardMaterial({ color: 0xf7cbb2, roughness: 0.72 });
  if (!sharedHeartMat) sharedHeartMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  // Palma curvada + 4 dedinhos + polegar
  const palm = new THREE.Mesh(sharedHandGeo, sharedSkinMat);
  palm.scale.set(0.22, 0.07, 0.22);
  g.add(palm);

  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(sharedHandGeo, sharedSkinMat);
    f.scale.set(0.045, 0.055, 0.14);
    f.position.set(-0.075 + i * 0.05, -0.02, 0.14);
    f.rotation.x = 0.35;
    g.add(f);
  }
  const thumb = new THREE.Mesh(sharedHandGeo, sharedSkinMat);
  thumb.scale.set(0.05, 0.05, 0.11);
  thumb.position.set(-0.13, -0.02, 0.04);
  thumb.rotation.y = 0.45;
  thumb.rotation.x = 0.25;
  g.add(thumb);

  // 2 coraçõezinhos flutuando acima da mão
  const hearts = [];
  for (let h = 0; h < 2; h++) {
    const heart = new THREE.Group();
    const l = new THREE.Mesh(sharedHandGeo, sharedHeartMat);
    l.scale.set(0.05, 0.05, 0.025);
    l.position.set(-0.02, 0.015, 0);
    const r = new THREE.Mesh(sharedHandGeo, sharedHeartMat);
    r.scale.set(0.05, 0.05, 0.025);
    r.position.set(0.02, 0.015, 0);
    const b = new THREE.Mesh(sharedHandGeo, sharedHeartMat);
    b.scale.set(0.055, 0.055, 0.025);
    b.rotation.z = Math.PI / 4;
    b.position.set(0, -0.005, 0);
    heart.add(l, r, b);
    heart.position.set(h === 0 ? -0.14 : 0.14, 0.18 + h * 0.08, 0);
    g.add(heart);
    hearts.push(heart);
  }

  g.userData.hearts = hearts;
  return g;
}

export function triggerPettingAnimation(scene, targetGroup, heightOffset = 0.95) {
  if (!THREE || !scene || !targetGroup) return;
  const hand = createHandGroup();
  scene.add(hand);
  activeAnimations.push({
    hand,
    targetGroup,
    heightOffset,
    elapsed: 0,
    duration: 1.65
  });
}

export function stepPettingHands(dt) {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.elapsed += dt;
    if (anim.elapsed >= anim.duration || !anim.targetGroup || !anim.targetGroup.parent) {
      if (anim.hand.parent) anim.hand.parent.remove(anim.hand);
      activeAnimations.splice(i, 1);
      continue;
    }
    const p = anim.elapsed / anim.duration;
    const tp = anim.targetGroup.position;
    const stroke = Math.sin(anim.elapsed * 9.5) * 0.075;
    const bounce = Math.abs(Math.cos(anim.elapsed * 9.5)) * 0.035;
    anim.hand.position.set(tp.x, tp.y + anim.heightOffset + bounce, tp.z + stroke);
    anim.hand.rotation.y = anim.targetGroup.rotation.y;
    anim.hand.rotation.x = Math.sin(anim.elapsed * 9.5) * 0.14;
    const fadeScale = p > 0.8 ? Math.max(0.01, (1 - p) * 5) : 1;
    anim.hand.scale.setScalar(fadeScale);

    const hearts = anim.hand.userData.hearts;
    if (hearts) {
      for (let hi = 0; hi < hearts.length; hi++) {
        hearts[hi].position.y = 0.16 + hi * 0.08 + p * 0.38;
        hearts[hi].rotation.y = anim.elapsed * 2.5;
      }
    }
  }
}
