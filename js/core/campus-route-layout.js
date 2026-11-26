export const FOREST_ENTRY = Object.freeze({ x: -28, y: 0, z: -46, yaw: -Math.PI / 5 });
export const MOUNTAIN_ENTRY = Object.freeze({ x: 0, z: -158, yaw: Math.PI });

// The plaza, bridge, avenues and village street provide the existing links
// between these sections. Only the missing links and painted crossings are added.
export const CAMPUS_ROUTES = [
  { id: 'plaza-west', surface: 'paving', width: 0.62, points: [[0, 10.5], [-9, 10.5], [-10.5, 7.7], [-10.5, 0.4], [-10.5, -7]] },
  { id: 'plaza-east', surface: 'paving', width: 0.62, points: [[0, 10.5], [9, 10.5], [10.5, 7.7], [10.5, -0.2], [10.5, -7]] },
  { id: 'lab-door', surface: 'paving', width: 0.62, points: [[-10.5, -7], [-13.63, -7]] },
  { id: 'storage-door', surface: 'paving', width: 0.62, points: [[-10.5, 7.7], [-13.63, 8]] },
  { id: 'dryer-door', surface: 'paving', width: 0.62, points: [[10.5, -7], [13.63, -7]] },
  { id: 'greenhouse-door', surface: 'paving', width: 0.62, points: [[10.5, 7.7], [13.63, 8]] },
  { id: 'north-stairs-west', surface: 'paving', width: 0.64, points: [[-10.5, -7], [-7.5, -8.9], [-4, -10.4], [0, -11.48]] },
  { id: 'north-stairs-east', surface: 'paving', width: 0.64, points: [[10.5, -7], [7.5, -8.9], [4, -10.4], [0, -11.48]] },
  { id: 'plaza-lake', surface: 'paving', width: 0.72, points: [[0, 10.5], [0, 20.6]] },
  { id: 'plaza-south-west', surface: 'paving', width: 0.68, points: [[0, 16], [-10, 16], [-16.8, 17], [-17.5, 22]] },
  { id: 'plaza-south-east', surface: 'paving', width: 0.68, points: [[0, 16], [10, 16], [19, 16], [24.5, 17], [24.5, 22]] },
  { id: 'west-plaza-exit', surface: 'paving', width: 0.62, points: [[-10.5, 0.4], [-28, 0.4]] },
  { id: 'sports-connector', width: 1.85, points: [[-28, 0.4], [-31.6, 0.4], [-32, -5], [-32, -12], [-35, -15]] },
  { id: 'basketball-connector', width: 1.7, points: [[-31.6, 0.4], [-34, 3.5], [-39, 6]] },
  { id: 'forest-access', width: 1.95, points: [[-32, -12], [-31.2, -25], [-30.5, -38], [-28, -46]] },
  { id: 'forest-loop', width: 2.15, closed: true,
    points: [[-28, -46], [-23.2, -51.7], [-16.7, -52.6], [-12, -56.8], [-16.4, -63.3], [-24.5, -63], [-31.6, -56.5]] },
  { id: 'mountain-trail', width: 1.7,
    points: [[-16.4, -63.3], [-18, -70], [-10, -76], [-6, -86], [-13, -98], [-5, -110], [3, -118],
      [12, -132], [17, -143], [11, -153], [0, -158]] },
  { id: 'east-plaza-exit', surface: 'paving', width: 0.75, points: [[10.5, -0.2], [28, -0.2]] },
  { id: 'cinema-connector', width: 1.85, points: [[34, -0.2], [39, 0.25], [45.6, -1], [48, -4.05]] },
  { id: 'ecology-connector', width: 1.85, points: [[34, 27.5], [36.7, 30.4], [38, 34.45], [43.6, 34.85], [46, 33.05]] },
  { id: 'garden-connector', surface: 'paving', width: 0.68, points: [[24.5, 22], [23.1, 21], [20, 20.35]] },
  { id: 'east-footpath', width: 1.46, points: [[24.5, 22], [25.25, 27.5], [25.4, 30.7], [25, 34.5]] },
  { id: 'east-crossing-link', width: 1.4, points: [[25.25, 27.5], [27.05, 27.5]] },
  { id: 'drive-thru-connector', width: 1.7, points: [[28.3, 35.8], [25, 34.5], [22.4, 34.6], [20.97, 35.2]] },
  { id: 'lake-south-exit', width: 2.2, points: [[0, 35.4], [0, 35.93]] },
  { id: 'village-connector', width: 2, points: [[-17.5, 22], [-17.6, 26.7], [-17.4, 32], [-15.3, 35.85], [-13, 36.05]] },
  { id: 'village-sidewalk', surface: 'paving', width: 0.72, points: [[0, 43.54], [-13, 43.54]] }
];

export const CAMPUS_CROSSINGS = [
  { x: 30.5, z: -0.2, eastWest: true },
  { x: 30.5, z: 27.5, eastWest: true },
  { x: -13, z: 39.5, eastWest: false },
  { x: 0, z: 39.5, eastWest: false }
];
