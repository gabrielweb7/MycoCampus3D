/**
 * Myco Cozy — direção de arte compartilhada.
 *
 * O passe é executado uma única vez, depois de o mundo ser construído e antes
 * do merge estático. Ele não troca materiais nem cria trabalho por frame:
 * apenas harmoniza o acabamento dos materiais PBR já existentes.
 */

export const MYCO_PALETTE = Object.freeze({
  grass: 0x4f9b45,
  grassLight: 0x72bd52,
  pine: 0x16814b,
  pineLight: 0x25a95d,
  bark: 0x81502f,
  cream: 0xfff1d0,
  mushroomPink: 0xf05aa8,
  mushroomCoral: 0xff786e,
  mushroomGold: 0xf7b84b,
  mushroomViolet: 0xa56bea,
  sky: 0x48bde8,
  stone: 0x8b91a8,
  ink: 0x27324a
});

const STYLE_MARK = 'mycoCozyV1';

function harmonizeStandardMaterial(material) {
  if (!material || !material.isMeshStandardMaterial || material.userData?.[STYLE_MARK]) return false;
  material.userData = material.userData || {};
  material.userData[STYLE_MARK] = true;

  // Vidro, líquidos, telas e materiais controlados por gameplay preservam seu
  // aspecto original; o passe cuida apenas de superfícies opacas.
  if (material.transparent || material.opacity < 0.98 || material.userData.keepExactStyle) return false;

  if ((material.metalness || 0) < 0.36) {
    material.roughness = Math.max(0.56, Math.min(0.9, material.roughness ?? 0.72));
    if (material.color) {
      const hsl = { h: 0, s: 0, l: 0 };
      material.color.getHSL(hsl);
      if (hsl.s > 0.08) {
        material.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.07 + 0.018), Math.min(0.88, hsl.l * 1.025));
      }
    }
  } else {
    // Metal limpo e levemente acetinado: mantém equipamentos legíveis sem o
    // ruído e os highlights duros de uma superfície espelhada.
    material.roughness = Math.max(0.28, Math.min(0.58, material.roughness ?? 0.4));
    material.metalness = Math.min(0.82, material.metalness);
  }
  material.dithering = true;
  material.needsUpdate = true;
  return true;
}

/** Aplica a linguagem visual a toda a cena sem alocações recorrentes. */
export function applyMycoCozyStyle(scene) {
  if (!scene || typeof scene.traverse !== 'function') return { meshes: 0, materials: 0 };
  const seen = new Set();
  let meshes = 0;
  let materials = 0;
  scene.traverse((obj) => {
    if (!obj || (!obj.isMesh && !obj.isInstancedMesh) || !obj.material) return;
    meshes++;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < list.length; i++) {
      const material = list[i];
      if (!material || seen.has(material)) continue;
      seen.add(material);
      if (harmonizeStandardMaterial(material)) materials++;
    }
  });
  scene.userData = scene.userData || {};
  scene.userData.mycoCozyStyle = { meshes, materials, version: 1 };
  return scene.userData.mycoCozyStyle;
}
