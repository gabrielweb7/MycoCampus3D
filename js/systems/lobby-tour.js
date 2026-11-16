/**
 * Tour Cinematografico do Lobby (MycoCampus3D)
 * Controla a camera orbital automatica enquanto o jogador esta na tela inicial.
 */

const THREE = window.THREE;
const _camPos = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export function stepLobbyTour(camera, controls, tourTime, dt) {
  const nextTourTime = tourTime + dt;
  const cycle = nextTourTime % 36;

  if (cycle < 12) {
    // Vista panoramica da praca, fonte do cogumelo e ponte da Torre do Relogio
    const t0 = cycle / 12;
    _camPos.set(-14 + t0 * 28, 16.0 - Math.sin(t0 * Math.PI) * 3.0, 26 - t0 * 4);
    _lookAt.set(0, 3.5, -12);
  } else if (cycle < 24) {
    // Sobrevoo pelo Lago em 8 e Complexo Esportivo
    const t1 = (cycle - 12) / 12;
    _camPos.set(16 - t1 * 48, 22.0, 36 - t1 * 28);
    _lookAt.set(-22, 1.5, 4);
  } else {
    // Retorno pelo Student Center, Praca Leste e Montanhas
    const t2 = (cycle - 24) / 12;
    _camPos.set(52 - t2 * 64, 24.0, 28 - Math.sin(t2 * Math.PI) * 18);
    _lookAt.set(8, 2.5, -6);
  }

  camera.position.lerp(_camPos, Math.min(1, dt * 1.4));
  controls.target.lerp(_lookAt, Math.min(1, dt * 1.8));
  controls.update();
  return nextTourTime;
}
