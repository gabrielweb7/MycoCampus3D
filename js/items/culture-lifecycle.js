export const CULTURE_GAME_DAY_SECONDS = 86400;
export const CULTURE_ROOM_SHELF_LIFE_DAYS = 15;
export const CULTURE_REFRIGERATED_SHELF_LIFE_DAYS = 90;
export const SPORE_PRINT_ROOM_SHELF_LIFE_DAYS = 730;
export const SPORE_PRINT_REFRIGERATED_SHELF_LIFE_DAYS = 1460;

function resolveShelfLimits(ctrl) {
  const isSporePrint = !!(ctrl && ctrl.mode === 'spore_print');
  return isSporePrint
    ? { room: SPORE_PRINT_ROOM_SHELF_LIFE_DAYS, cold: SPORE_PRINT_REFRIGERATED_SHELF_LIFE_DAYS }
    : { room: CULTURE_ROOM_SHELF_LIFE_DAYS, cold: CULTURE_REFRIGERATED_SHELF_LIFE_DAYS };
}

export function createCultureLifecycleState(colonized) {
  return {
    inoculated: !!colonized,
    colonized: !!colonized,
    colonization: colonized ? 100 : 0,
    contaminated: false,
    ageGameDays: 0,
    shelfLifeAgeDays: 0,
    tempC: 24.5,
    refrigerated: false,
    inFridge: false,
    fridgeId: '',
    expired: false,
    lastRenderedRefrigerated: false,
    lastRenderedTempInt: 25,
    lastRenderedAgeDay: -1
  };
}

export function stepCultureTemperature(ctrl, dt, inFridge, doorOpen) {
  if (!ctrl) return false;
  if (typeof ctrl.tempC !== 'number' || !Number.isFinite(ctrl.tempC)) ctrl.tempC = 24.5;
  const targetTemp = inFridge ? (doorOpen ? 9.5 : 4.0) : 24.5;
  const rate = inFridge ? 0.65 : 0.45; // esfria e aquece gradualmente
  if (ctrl.tempC > targetTemp) {
    ctrl.tempC = Math.max(targetTemp, ctrl.tempC - rate * dt);
  } else if (ctrl.tempC < targetTemp) {
    ctrl.tempC = Math.min(targetTemp, ctrl.tempC + rate * dt);
  }
  ctrl.refrigerated = ctrl.tempC <= 10.0;
  const tempInt = Math.round(ctrl.tempC);
  if (tempInt !== ctrl.lastRenderedTempInt) {
    ctrl.lastRenderedTempInt = tempInt;
    return true;
  }
  return false;
}

export function getCultureRemainingDays(ctrl) {
  if (!ctrl) return 0;
  const { room, cold } = resolveShelfLimits(ctrl);
  const remainingRoomDays = Math.max(0, room - (ctrl.shelfLifeAgeDays || 0));
  return Math.ceil(remainingRoomDays * (ctrl.refrigerated ? (cold / room) : 1));
}

export function isCultureIncubationTemperatureSuitable(item, ctx) {
  if (!item || !item.meta) return false;
  const temperatureC = typeof item.meta.getTempC === 'function'
    ? item.meta.getTempC(item, ctx)
    : item.meta.baseTempC;
  return Number.isFinite(temperatureC) && temperatureC >= 20 && temperatureC <= 30;
}

export function stepCultureShelfLife(ctrl, dt) {
  if (!ctrl || !ctrl.colonized || ctrl.contaminated || ctrl.expired) return 0;
  const previousAgeDay = Math.floor(ctrl.ageGameDays || 0);
  const elapsedGameDays = Math.max(0, dt) / CULTURE_GAME_DAY_SECONDS;
  ctrl.ageGameDays = (ctrl.ageGameDays || 0) + elapsedGameDays;
  ctrl.shelfLifeAgeDays = (ctrl.shelfLifeAgeDays || 0) + elapsedGameDays *
    (ctrl.refrigerated ? CULTURE_ROOM_SHELF_LIFE_DAYS / CULTURE_REFRIGERATED_SHELF_LIFE_DAYS : 1);
  if (ctrl.shelfLifeAgeDays >= CULTURE_ROOM_SHELF_LIFE_DAYS) {
    ctrl.shelfLifeAgeDays = CULTURE_ROOM_SHELF_LIFE_DAYS;
    ctrl.expired = true;
    return 2;
  }
  return Math.floor(ctrl.ageGameDays) !== previousAgeDay ? 1 : 0;
}
