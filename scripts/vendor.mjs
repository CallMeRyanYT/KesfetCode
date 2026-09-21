import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Keep the renderer and its loaders on the same origin as the game.
const files = [
  ['build/three.module.js', 'three.module.js'],
  ['build/three.core.js', 'three.core.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/loaders/GLTFLoader.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['examples/jsm/environments/RoomEnvironment.js', 'addons/environments/RoomEnvironment.js'],
  ['examples/jsm/geometries/RoundedBoxGeometry.js', 'addons/geometries/RoundedBoxGeometry.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
  ['examples/jsm/utils/SkeletonUtils.js', 'addons/utils/SkeletonUtils.js'],
  ['LICENSE', 'THREE-LICENSE.txt'],
];
for (const [source, destination] of files) {
  const target = resolve('dist/vendor', destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve('node_modules/three', source), target);
}
console.log('Local 3D renderer and loaders prepared.');
