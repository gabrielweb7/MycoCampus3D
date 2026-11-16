export const CULTURE_GAME_DAY_SECONDS = 10;
export const CULTURE_ROOM_SHELF_LIFE_DAYS = 30;
export const CULTURE_REFRIGERATED_SHELF_LIFE_DAYS = 60;

export function createCultureLifecycleState(colonized) {
  return {
    colonized: !!colonized,
    contaminated: false,
    ageGameDays: 0,
    shelfLifeAgeDays: 0,
    refrigerated: false,
    inFridge: false,
    fridgeId: '',
    expired: false,
    lastRenderedRefrigerated: false,
    lastRenderedAgeDay: -1
  };
}

export function getCultureRemainingDays(ctrl) {
  if (!ctrl) return 0;
  const remainingRoomDays = Math.max(0, CULTURE_ROOM_SHELF_LIFE_DAYS - (ctrl.shelfLifeAgeDays || 0));
  return Math.ceil(remainingRoomDays * (ctrl.refrigerated
    ? CULTURE_REFRIGERATED_SHELF_LIFE_DAYS / CULTURE_ROOM_SHELF_LIFE_DAYS
    : 1));
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
