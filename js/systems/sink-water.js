import { t } from '../core/i18n.js';
import { canFillFromSink } from '../items/item-registry.js';
import { isContaminatedOrBurned, resetDisposableContainer } from '../items/lab-trash.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { addIngredientToBowl } from '../items/mixing-bowl.js';
import { markPdaVolumeChanged } from '../items/pda-mix.js';
import { updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { discardHeldLiquid } from './liquid-disposal.js';
import { queueItemStateSync } from './world-objects-sync.js';

export function getSinkCooker(ctx, item) {
  const cooker = item?.cookerRef || ctx.cookerPots?.find(pot => pot.potItem === item);
  return cooker && !cooker.lidItem?.isAttached ? cooker : null;
}

export function getSinkCookerCapacity(cooker) {
  const hasBase = cooker.hasBase || cooker.contents?.some(item => item?.mesh?.userData.isCookerBase);
  return hasBase ? Math.min(cooker.maxWaterMl ?? 15000, 4000) : (cooker.maxWaterMl ?? 15000);
}

export function getDrySinkGrains(item) {
  const grains = item?.spawnCtrl;
  return grains?.filled && grains.hydrated === false && !grains.sterilized && !grains.inoculated ? grains : null;
}

export function canUseSinkWater(ctx, item) {
  return !!(item?.bowlCtrl || getDrySinkGrains(item) || getSinkCooker(ctx, item) || canFillFromSink(item));
}

function fillWithWater(ctx, item, amount, seconds) {
  const bowl = item.bowlCtrl;
  const grains = getDrySinkGrains(item);
  const cooker = getSinkCooker(ctx, item);
  const liquid = item.mesh.userData.liquidCtrl;
  if (bowl) {
    if (bowl.mixed) return 'actions.interact.sink_bowl_mixed';
    const free = 600 - Object.values(bowl.ingredients).reduce((a, b) => a + b, 0);
    if (free <= 0) return 'actions.interact.sink_bowl_full';
    const step = amount ?? wholeMilliliters(ctx, seconds * 200);
    if (step > 0) addIngredientToBowl(item, 'water', Math.min(free, step));
  } else if (grains) {
    const next = Math.min(80, (grains.waterMl || 0) + (amount ?? wholeMilliliters(ctx, seconds * 90)));
    if (next === (grains.waterMl || 0)) return '';
    grains.waterMl = next;
    grains.hydrated = next >= 60;
    grains.updateVisual();
    if (grains.hydrated) ctx.callbacks.onToast?.(t('misc.held_loop.grains_hydrated'));
  } else if (cooker) {
    const capacity = getSinkCookerCapacity(cooker);
    if (cooker.waterMl >= capacity) return 'actions.interact.sink_empty_or_full';
    const step = amount ?? wholeMilliliters(ctx, seconds * 1000);
    if (step > 0) {
      cooker.waterMl = Math.min(capacity, cooker.waterMl + step);
      updateCookerWaterVisual(cooker);
    }
  } else if (canFillFromSink(item)) {
    if (liquid.volMl >= liquid.maxMl) return 'actions.interact.sink_empty_or_full';
    const rate = liquid.maxMl >= 4000 ? 650 : 220;
    const step = amount ?? wholeMilliliters(ctx, seconds * rate);
    if (step > 0) {
      liquid.sterilized = false;
      updateContainerVolume(item, Math.min(liquid.maxMl, liquid.volMl + step));
      if (item.pdaMediumCtrl) markPdaVolumeChanged(item);
    }
  } else {
    return 'actions.interact.sink_cannot_fill';
  }
  return '';
}

function wholeMilliliters(ctx, delta) {
  const action = ctx.sinkFilling;
  action.carryMl += delta;
  const step = Math.floor(action.carryMl);
  action.carryMl -= step;
  return step;
}

function syncWaterChange(ctx, item) {
  queueItemStateSync(ctx, item, { includePose: false });
  item._sinkVolumePending = !!ctx.pendingMovedItems?.[item.id]?.state;
  if (ctx.heldItem === item) ctx.callbacks.onHoldChange?.(item.label);
  ctx.notifyWorldAction();
}

export function useAimedSink(ctx) {
  const sink = ctx.hoveredSink;
  const item = ctx.heldItem;
  if (!sink || !item) return false;
  if (ctx.hoveredSinkAction === 'drain') return discardHeldLiquid(ctx, sink);

  if (isContaminatedOrBurned(item) && resetDisposableContainer(item)) {
    triggerSinkStream(sink, 500);
    window.MycoAudio?.playSpray?.();
    ctx.callbacks.onToast?.(t('actions.interact.sink_washed'));
    syncWaterChange(ctx, item);
    return true;
  }
  const initialDose = item.bowlCtrl ? 25 : getDrySinkGrains(item) ? 30 : getSinkCooker(ctx, item) ? 100 : 35;
  const error = fillWithWater(ctx, item, initialDose);
  if (error) {
    ctx.callbacks.onToast?.(t(error));
    return true;
  }
  ctx.sinkFilling = { sink, item, carryMl: 0 };
  triggerSinkStream(sink, 500, item.height);
  window.MycoAudio?.playSpray?.();
  syncWaterChange(ctx, item);
  return true;
}

export function stepSinkWater(ctx, dt) {
  const action = ctx.sinkFilling;
  if (!action) return;
  const { sink, item } = action;
  if (!ctx.isPrimaryDown || ctx.placementMode || ctx.heldItem !== item ||
      ctx.hoveredSink !== sink || ctx.hoveredSinkAction !== 'fill' || fillWithWater(ctx, item, undefined, dt)) {
    ctx.sinkFilling = null;
    syncWaterChange(ctx, item);
    return;
  }
  triggerSinkStream(sink, 250, item.height);
  ctx.callbacks.onHoldChange?.(item.label);
}
