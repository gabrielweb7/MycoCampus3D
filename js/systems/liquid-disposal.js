import { updateContainerVolume } from '../items/liquid-culture.js';
import { hasPdaContents } from '../items/item-registry.js';
import { resetDisposableContainer } from '../items/lab-trash.js';
import { updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { updateSyringeVolume } from '../items/syringe.js';
import { queueItemStateSync } from './world-objects-sync.js';
import { t } from '../core/i18n.js';

function drainableCooker(ctx, item) {
  return ctx.cookerPots?.find(pot => pot.potItem === item && !pot.lidItem?.isAttached && !(pot.psi >= 1.5));
}

export function getDrainableVolume(ctx, item) {
  if (!item?.mesh || item.isReadOnly) return 0;
  const spawn = item.spawnCtrl;
  if ((spawn?.isPP5 && !spawn.lidOpen) || (spawn?.isBag && spawn.sealed)) return 0;
  const data = item.mesh.userData;
  const bowl = item.bowlCtrl;
  if (bowl && !bowl.mixed) return bowl.ingredients.water || 0;
  if (data.syrCtrl) return data.syrCtrl.volMl || 0;
  if (data.liquidCtrl?.volMl > 0) return data.liquidCtrl.volMl;
  if (spawn && !spawn.sterilized && !spawn.inoculated) return spawn.waterMl || 0;
  return drainableCooker(ctx, item)?.waterMl || 0;
}

export function discardHeldLiquid(ctx, sink = null) {
  const item = ctx.heldItem;
  if (!(getDrainableVolume(ctx, item) > 0)) return false;
  const { liquidCtrl, syrCtrl } = item.mesh.userData;
  const bowl = item.bowlCtrl;
  if (bowl) {
    bowl.ingredients.water = 0;
    bowl.stirProgress = 0;
    updateMixingBowlLabel(item);
  } else if (syrCtrl) {
    updateSyringeVolume(item, 0);
  } else if (liquidCtrl?.volMl > 0) {
    if (hasPdaContents(item) || item.cultureCtrl) resetDisposableContainer(item);
    else updateContainerVolume(item, 0);
  } else if (item.spawnCtrl?.waterMl > 0) {
    item.spawnCtrl.waterMl = 0;
    item.spawnCtrl.hydrated = false;
    item.spawnCtrl.updateVisual?.();
  } else {
    const pot = drainableCooker(ctx, item);
    if (!pot) return false;
    pot.waterMl = 0;
    updateCookerWaterVisual(pot);
  }
  ctx.sinkFilling = null;
  ctx.pourHold = null;
  ctx.syringePumping = null;
  queueItemStateSync(ctx, item);
  window.MycoAudio?.playSpray?.();
  const point = sink?.nozzleWorld ?? ctx.playerPos;
  if (point) ctx.spawnWaterDrop?.(point.x, point.y, point.z, 0, -0.8, 0);
  ctx.callbacks?.onHoldChange?.(item.label);
  ctx.callbacks?.onToast?.(t(sink ? 'liquid.drained_sink' : 'liquid.drained_ground'));
  ctx.notifyWorldAction?.();
  return true;
}
