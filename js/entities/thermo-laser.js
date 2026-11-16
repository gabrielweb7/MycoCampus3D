var thermoCanvas = null;
var thermoCtx = null;
var thermoTex = null;
var lastDrawnTempStr = '';
var lastDrawnMode = '';

export function drawThermoScreen(tempVal, modeStr, force) {
  if (!thermoCtx || !thermoTex) return;
  var tStr = (typeof tempVal === 'number' ? tempVal.toFixed(1) : '24.0') + '°C';
  var mStr = modeStr || 'SCAN';
  if (!force && tStr === lastDrawnTempStr && mStr === lastDrawnMode) return;
  lastDrawnTempStr = tStr;
  lastDrawnMode = mStr;
  var ctx = thermoCtx;
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 120);

  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(mStr, 10, 22);

  ctx.textAlign = 'right';
  ctx.fillText('⚡ 🔋', 118, 22);

  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tStr, 64, 68);

  ctx.font = 'bold 11px monospace';
  ctx.fillText('ε=0.95  MAX 380°', 64, 98);
  ctx.font = '9px monospace';
  ctx.fillText('INFRARED TEMP', 64, 114);

  thermoTex.needsUpdate = true;
}

export function initThermoDisplay() {
  if (thermoTex) return thermoTex;
  thermoCanvas = document.createElement('canvas');
  thermoCanvas.width = 128;
  thermoCanvas.height = 128;
  thermoCtx = thermoCanvas.getContext('2d');
  thermoTex = new THREE.CanvasTexture(thermoCanvas);
  drawThermoScreen(24.0, 'HOLD');
  return thermoTex;
}

export function createThermoLaserFx(ctx) {
  var lineGeo = new THREE.BufferGeometry();
  var linePos = new Float32Array(6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  var thermoLaserLine = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.88, linewidth: 2, depthWrite: false })
  );
  thermoLaserLine.visible = false;
  ctx.scene.add(thermoLaserLine);

  var dotGeo = new THREE.CircleGeometry(0.016, 16);
  var dotMat = new THREE.MeshBasicMaterial({
    color: 0xff1133,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  var thermoLaserDot = new THREE.Mesh(dotGeo, dotMat);
  thermoLaserDot.visible = false;
  ctx.scene.add(thermoLaserDot);

  ctx.setThermoLaserRefs({
    thermoLaserLine: thermoLaserLine,
    thermoLaserDot: thermoLaserDot,
    thermoTex: thermoTex
  });
}
