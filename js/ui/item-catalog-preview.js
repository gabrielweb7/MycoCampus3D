import { setCultureFridgeDoorOpen } from '../items/culture-fridge.js';
import { updateMonotubVisual } from '../items/monotub.js';
import { setPetriLidOpen } from '../items/petri-dish.js';

function liftPart(part, height, offset) {
  const { y, z } = part.position;
  const tilt = part.rotation.x;
  return open => {
    part.position.y = y + (open ? height : 0);
    part.position.z = z + (open ? offset : 0);
    part.rotation.x = tilt + (open ? -0.38 : 0);
  };
}

// Operate only on models constructed in the catalog's private scene.
export function getCatalogPreview(item) {
  const model = item.mesh;
  let part = 'lid';
  let setOpen;
  const { monotubCtrl, caseCtrl, fridgeCtrl, growCtrl, silicaJarCtrl, dehydratorCtrl, sealerCtrl, lidItem } = item;
  if (monotubCtrl?.lidPivot) {
    setOpen = open => {
      monotubCtrl.lidOpen = open;
      monotubCtrl.lidAnimProgress = Number(open);
      updateMonotubVisual(item);
    };
  } else if (caseCtrl?.lidPivot) {
    setOpen = open => { caseCtrl.lidPivot.rotation.x = open ? -1.65 : 0; };
  } else if (model.userData.petriCtrl?.lidPivot) {
    setOpen = open => setPetriLidOpen(item, open, true);
  } else if (fridgeCtrl?.doorPivot) {
    part = 'door';
    setOpen = open => setCultureFridgeDoorOpen(item, open, true);
  } else if (growCtrl) {
    part = 'door';
    setOpen = open => item.meta.applyState(item, { grow: { doorClosed: !open } });
  } else if (silicaJarCtrl?.lidPivot) {
    setOpen = open => { silicaJarCtrl.lidPivot.rotation.x = open ? -0.95 : 0; };
  } else if (item.trashLid) {
    setOpen = open => { item.trashLid.rotation.x = open ? -1.05 : 0; };
  } else if (dehydratorCtrl?.cover) {
    setOpen = liftPart(dehydratorCtrl.cover, 0.10, -0.18);
  } else if (sealerCtrl?.lever) {
    part = 'lever';
    setOpen = open => { sealerCtrl.lever.rotation.z = open ? sealerCtrl.openAngle : 0; };
  } else if (item.mushroomBagCtrl) {
    part = 'package';
    setOpen = sealed => item.meta.applyState(item, { filled: true, sealed, grams: 10 });
  } else if (item.spawnCtrl?.openMouth) {
    part = 'package';
    const bag = item.spawnCtrl;
    bag.filled = true;
    bag.fillMesh.visible = true;
    setOpen = sealed => {
      bag.sealed = sealed;
      bag.updateVisual();
    };
  } else if (lidItem?.mesh) {
    const lid = lidItem.mesh;
    lid.position.sub(model.position);
    model.add(lid);
    setOpen = liftPart(lid, 0.18, -0.27);
  }
  setOpen?.(false);
  return { model, part, setOpen };
}
