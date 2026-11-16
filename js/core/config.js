/**
 * MycoCampus3D — Configuracao Centralizada do Jogo
 * Ajuste fisica, velocidades, camera, laboratorio e estufa em um unico lugar.
 */
export const GAME_CONFIG = Object.freeze({
  player: {
    eyeHeight: 1.62,
    seatedEyeHeight: 1.50,
    snowboardEyeHeight: 1.42,
    radius: 0.38,
    walkSpeed: 4.6,
    sprintSpeed: 7.5,
    jumpVelocity: 6.2,
    snowboardJumpVelocity: 7.2,
    paragliderJumpVelocity: 9.2,
    gravity: 16.5,
    coyoteTimeMs: 150,
    jumpBufferMs: 150,
    worldBound: 1000,
    spaceBound: 32000
  },
  vehicles: {
    snowboardMaxSpeed: 26.0,
    paragliderFastSpeed: 15.0,
    paragliderCruiseSpeed: 11.2,
    paragliderBrakeSpeed: 4.2,
    thermalLiftVelocity: 8.5,
    spaceCruiseSpeed: 125,
    spaceBoostSpeed: 260,
    spaceVerticalSpeed: 90
  },
  atmosphere: {
    stratosphere: 12000,
    mesosphere: 50000,
    thermosphere: 85000,
    spaceTransitionAltitude: 75000,
    spaceAltitude: 100000,
    spaceAltitudeLimit: 120000,
    solarSystemHeight: 100000
  },
  camera: {
    fov: 62,
    near: 0.1,
    farDesktop: 1800,
    farTouch: 1100,
    touchShadowSize: 768,
    desktopShadowSize: 1536
  },
  lab: {
    autoclaveTargetTempC: 121,
    autoclaveTargetPsi: 15.0,
    autoclaveLockPsi: 1.5,
    autoclaveOverheatSec: 16.0,
    sanitizationDurationMs: 90000,
    syringePumpDurationSec: 2.0,
    scaleRefreshMs: 150
  },
  greenhouse: {
    humidityDecayPerSec: 0.12,
    minGrowthHumidity: 60,
    growthRateMultiplier: 1.6
  },
  interaction: {
    maxPickupDist: 4.5,
    maxLaserDist: 35.0,
    dropSyncGraceMs: 15000
  }
});
