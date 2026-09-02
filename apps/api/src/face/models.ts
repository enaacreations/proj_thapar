import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as faceapi from "@vladmandic/face-api";
import * as tf from "@tensorflow/tfjs-node";

/**
 * The face nets are ~7 MB of weights and take a second or so to warm up, so
 * they load once, lazily, on the first face request rather than at boot — a
 * dev server restart shouldn't pay for them until someone marks attendance.
 */

// Weights ship inside the npm package, so there is nothing to download or
// vendor: resolve them relative to the installed module.
const MODEL_DIR = join(
  dirname(createRequire(__filename).resolve("@vladmandic/face-api")),
  "..",
  "model"
);

let ready: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  ready ??= (async () => {
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    // Used by the liveness challenge, which asks for an expression the
    // resident has to actually produce. ~300 KB on top of the rest.
    await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);
  })().catch((err: unknown) => {
    // Don't cache a failed load — the next request should retry.
    ready = null;
    throw err;
  });

  return ready;
}

export { faceapi, tf };
