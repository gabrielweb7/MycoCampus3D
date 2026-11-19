/**
 * MycoCampus3D — Ponte do three.js moderno (r187, ES Module) para o resto do jogo.
 *
 * O código do jogo lê `window.THREE` no topo de cada módulo. Este arquivo é o
 * PRIMEIRO import de js/main.js, então roda antes de todos os outros módulos.
 *
 * Compatibilidade visual com o r128 (antigo three.min.js):
 *  - ColorManagement desligado: cores hex continuam sendo usadas "cruas", igual ao r128.
 *  - Iluminação "legacy": o r128 multiplicava luzes diretas/ambiente por PI e usava
 *    atenuação linear pelo `distance` das PointLights. O r155+ removeu esse modo, então
 *    reaplicamos via ShaderChunk para o jogo manter exatamente o mesmo brilho.
 *  - three-mesh-bvh: raycasts acelerados por BVH (hover/mira/interação).
 */
import * as THREE_NS from './three.bundle.min.js';

const THREE = Object.assign({}, THREE_NS);

// 1) Cores como no r128 (sem conversão sRGB->linear em Color.set / setHex).
THREE.ColorManagement.enabled = false;

// 2) Iluminação legacy (equivalente a renderer.useLegacyLights = true do r150).
(function patchLegacyLights() {
  const chunk = THREE.ShaderChunk.lights_pars_begin;
  if (typeof chunk !== 'string') return;
  let src = chunk;
  const rep = (from, to) => {
    if (src.indexOf(from) === -1) {
      console.warn('[three-global] trecho de shader não encontrado:', from);
      return;
    }
    src = src.split(from).join(to);
  };

  rep('vec3 irradiance = ambientLightColor;', 'vec3 irradiance = ambientLightColor * PI;');
  rep('light.color = sunLight.color;', 'light.color = sunLight.color * PI;');
  rep('light.color = directionalLight.color;', 'light.color = directionalLight.color * PI;');
  rep('light.color = pointLight.color;', 'light.color = pointLight.color * PI;');
  rep('light.color = spotLight.color * spotAttenuation;', 'light.color = spotLight.color * spotAttenuation * PI;');
  rep(
    'vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );',
    'vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight ) * PI;'
  );

  const attStart = src.indexOf('float getDistanceAttenuation(');
  const attEnd = attStart === -1 ? -1 : src.indexOf('float getSpotAttenuation(', attStart);
  if (attStart !== -1 && attEnd !== -1) {
    src = src.slice(0, attStart) +
      'float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n' +
      '\tif ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {\n' +
      '\t\treturn pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );\n' +
      '\t}\n' +
      '\treturn 1.0;\n' +
      '}\n\n' +
      src.slice(attEnd);
  } else {
    console.warn('[three-global] getDistanceAttenuation não encontrado; mantendo atenuação física.');
  }

  THREE.ShaderChunk.lights_pars_begin = src;
})();

// 3) Raycast acelerado por BVH. Só vale para meshes que receberem
//    geometry.computeBoundsTree() (feito em scene-optimizer.js para malhas estáticas).
//    Meshes sem boundsTree caem automaticamente no raycast padrão.
THREE.BufferGeometry.prototype.computeBoundsTree = THREE_NS.computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = THREE_NS.disposeBoundsTree;
THREE.Mesh.prototype.raycast = THREE_NS.acceleratedRaycast;

// 4) Aliases removidos do three moderno, para qualquer código antigo restante.
if (THREE.sRGBEncoding === undefined) THREE.sRGBEncoding = THREE.SRGBColorSpace;
if (THREE.LinearEncoding === undefined) THREE.LinearEncoding = THREE.LinearSRGBColorSpace;

THREE.__legacyCompat = true;
window.THREE = THREE;

export default THREE;
