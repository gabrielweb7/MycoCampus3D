/**
 * Trilhas Guiadas de Autonomia + Calculadora Real de Receitas + Diagnóstico Pedagógico (MycoCampus3D)
 */
import { t } from './i18n.js';

export const CULTIVATION_TRACKS = [
  {
    id: 'pf_tek_pp5',
    get title() { return t('content.track.pf_tek_pp5.title'); },
    get level() { return t('content.track.pf_tek_pp5.level'); },
    get speciesHint() { return t('content.track.pf_tek_pp5.species_hint'); },
    get summary() { return t('content.track.pf_tek_pp5.summary'); },
    get gameVsReal() { return t('content.track.pf_tek_pp5.game_vs_real'); },
    get steps() {
      return [
        t('content.track.pf_tek_pp5.s1'),
        t('content.track.pf_tek_pp5.s2'),
        t('content.track.pf_tek_pp5.s3'),
        t('content.track.pf_tek_pp5.s4'),
        t('content.track.pf_tek_pp5.s5')
      ];
    }
  },
  {
    id: 'grains_monotub',
    get title() { return t('content.track.grains_monotub.title'); },
    get level() { return t('content.track.grains_monotub.level'); },
    get speciesHint() { return t('content.track.grains_monotub.species_hint'); },
    get summary() { return t('content.track.grains_monotub.summary'); },
    get gameVsReal() { return t('content.track.grains_monotub.game_vs_real'); },
    get steps() {
      return [
        t('content.track.grains_monotub.s1'),
        t('content.track.grains_monotub.s2'),
        t('content.track.grains_monotub.s3'),
        t('content.track.grains_monotub.s4'),
        t('content.track.grains_monotub.s5')
      ];
    }
  },
  {
    id: 'agar_clone_slant',
    get title() { return t('content.track.agar_clone_slant.title'); },
    get level() { return t('content.track.agar_clone_slant.level'); },
    get speciesHint() { return t('content.track.agar_clone_slant.species_hint'); },
    get summary() { return t('content.track.agar_clone_slant.summary'); },
    get gameVsReal() { return t('content.track.agar_clone_slant.game_vs_real'); },
    get steps() {
      return [
        t('content.track.agar_clone_slant.s1'),
        t('content.track.agar_clone_slant.s2'),
        t('content.track.agar_clone_slant.s3'),
        t('content.track.agar_clone_slant.s4')
      ];
    }
  },
  {
    id: 'gourmet_sawdust_lc',
    get title() { return t('content.track.gourmet_sawdust_lc.title'); },
    get level() { return t('content.track.gourmet_sawdust_lc.level'); },
    get speciesHint() { return t('content.track.gourmet_sawdust_lc.species_hint'); },
    get summary() { return t('content.track.gourmet_sawdust_lc.summary'); },
    get gameVsReal() { return t('content.track.gourmet_sawdust_lc.game_vs_real'); },
    get steps() {
      return [
        t('content.track.gourmet_sawdust_lc.s1'),
        t('content.track.gourmet_sawdust_lc.s2'),
        t('content.track.gourmet_sawdust_lc.s3'),
        t('content.track.gourmet_sawdust_lc.s4')
      ];
    }
  }
];

export function calculateRealWorldRecipe(kind, rawAmount) {
  const amt = Math.max(1, Number(rawAmount) || 500);
  if (kind === 'pda') {
    const waterMl = amt;
    const scale = waterMl / 1000;
    const totalPowderG = Math.round(scale * 40 * 10) / 10;
    const potatoG = Math.round(scale * 4 * 10) / 10;
    const dextroseG = Math.round(scale * 20 * 10) / 10;
    const agarG = Math.round(scale * 16 * 10) / 10;
    const plates = Math.max(1, Math.floor(waterMl / 20));
    return {
      title: t('content.recipe.pda.title', { waterMl }),
      items: [
        t('content.recipe.pda.i1', { waterMl }),
        t('content.recipe.pda.i2', { totalPowderG }),
        t('content.recipe.pda.i3', { potatoG, dextroseG, agarG })
      ],
      note: t('content.recipe.pda.note', { plates })
    };
  }
  if (kind === 'lc') {
    const waterMl = amt;
    const nutrientG = Math.round(waterMl * 0.04 * 10) / 10;
    return {
      title: t('content.recipe.lc.title', { waterMl }),
      items: [
        t('content.recipe.lc.i1', { waterMl }),
        t('content.recipe.lc.i2', { nutrientG }),
        t('content.recipe.lc.i3')
      ],
      note: t('content.recipe.lc.note')
    };
  }
  if (kind === 'cvg') {
    const cocoDryG = amt;
    const vermG = cocoDryG;
    const gypsumG = Math.round(cocoDryG * 0.08);
    const boilingWaterMl = Math.round(cocoDryG * 4.8);
    const boilingWaterL = (boilingWaterMl / 1000).toFixed(1);
    return {
      title: t('content.recipe.cvg.title', { cocoDryG }),
      items: [
        t('content.recipe.cvg.i1', { cocoDryG }),
        t('content.recipe.cvg.i2', { vermG }),
        t('content.recipe.cvg.i3', { gypsumG }),
        t('content.recipe.cvg.i4', { boilingWaterMl, boilingWaterL })
      ],
      note: t('content.recipe.cvg.note')
    };
  }
  const spawnGrams = amt;
  const bulkGrams = spawnGrams * 2;
  const monotubs = Math.max(1, Math.round((spawnGrams + bulkGrams) / 2200 * 10) / 10);
  return {
    title: t('content.recipe.spawn_bulk.title', { spawnGrams }),
    items: [
      t('content.recipe.spawn_bulk.i1', { spawnGrams }),
      t('content.recipe.spawn_bulk.i2', { bulkGrams }),
      t('content.recipe.spawn_bulk.i3', { monotubs })
    ],
    note: t('content.recipe.spawn_bulk.note')
  };
}

export function diagnoseItemPedagogy(item) {
  if (!item) return null;
  const sp = item.spawnCtrl;
  const pc = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  const cc = item.cultureCtrl || (item.mesh && item.mesh.userData && item.mesh.userData.cultureCtrl);
  const mc = item.monotubCtrl;

  const contaminated = [sp, pc, cc, mc].find((ctrl) => ctrl?.contaminated) ||
    (pc?.mode === 'contam' ? pc : null);
  const contamKind = contaminated?.contamKind;

  if (contaminated) {
    const knownKinds = ['trichoderma', 'cobweb', 'wet_spot', 'penicillium', 'aspergillus', 'lipstick'];
    const kindKey = knownKinds.includes(contamKind) ? contamKind : 'default';
    return {
      level: 'danger',
      status: t(`content.diag.contam.${kindKey}.status`),
      cause: t(`content.diag.contam.${kindKey}.cause`),
      realWorldTip: t(`content.diag.contam.${kindKey}.tip`)
    };
  }

  if ((sp && sp.burned) || (item.pdaMediumCtrl && item.pdaMediumCtrl.burned)) {
    return {
      level: 'danger',
      status: t('content.diag.burned.status'),
      cause: t('content.diag.burned.cause'),
      realWorldTip: t('content.diag.burned.tip')
    };
  }
  if (sp && sp.pasteurizedOnly && !sp.sterilized) {
    return {
      level: 'warn',
      status: t('content.diag.pasteurized.status'),
      cause: t('content.diag.pasteurized.cause'),
      realWorldTip: t('content.diag.pasteurized.tip')
    };
  }
  if (sp && sp.filled && sp.hydrated === false && (sp.waterMl || 0) < 30 &&
      (sp.substrateKind === 'corn' || sp.substrateKind === 'grain' || sp.substrateKind === 'wheat' || sp.substrateKind === 'sorghum')) {
    return {
      level: 'warn',
      status: t('content.diag.dry_grain.status'),
      cause: t('content.diag.dry_grain.cause'),
      realWorldTip: t('content.diag.dry_grain.tip')
    };
  }
  if (cc && item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl && item.mesh.userData.liquidCtrl.volMl > 0 && cc.hasNutrient === false && !cc.inoculated) {
    return {
      level: 'warn',
      status: t('content.diag.pure_water.status'),
      cause: t('content.diag.pure_water.cause'),
      realWorldTip: t('content.diag.pure_water.tip')
    };
  }
  if (sp && sp.expired || pc && pc.expired || cc && cc.expired) {
    return {
      level: 'warn',
      status: t('content.diag.expired.status'),
      cause: t('content.diag.expired.cause'),
      realWorldTip: t('content.diag.expired.tip')
    };
  }
  return null;
}
