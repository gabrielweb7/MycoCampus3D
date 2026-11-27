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
  sky: 0x8bb9c8,
  stone: 0x8b91a8,
  ink: 0x27324a,
  plaster: 0xefe6d7,
  linen: 0xded6c6,
  floor: 0xa69d8f,
  petrol: 0x526d69,
  sage: 0x85a698,
  benchSteel: 0x708780,
  lilac: 0xac96b5,
  woodHoney: 0xc89a6d,
  terracotta: 0xbc806c,
  leaf: 0x54845b,
  leafLight: 0x7f9e63,
  daylight: 0xfff3df,
  daylightFill: 0xf3f0e5,
  bounce: 0x9a927e,
  roomLight: 0xfff4e3
});

const STYLE_MARK = 'mycoCozyV2';

function harmonizeStandardMaterial(material) {
  if (!material || !material.isMeshStandardMaterial || material.userData?.[STYLE_MARK]) return false;
  material.userData = material.userData || {};
  material.userData[STYLE_MARK] = true;

  // Vidro, líquidos, telas e materiais controlados por gameplay preservam seu
  // aspecto original; o passe cuida apenas de superfícies opacas.
  if (material.transparent || material.opacity < 0.98 || material.userData.keepExactStyle) return false;

  if ((material.metalness || 0) < 0.36) {
    material.roughness = Math.max(0.56, Math.min(0.9, material.roughness ?? 0.72));
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
  scene.userData.mycoCozyStyle = { meshes, materials, version: 2 };
  return scene.userData.mycoCozyStyle;
}
