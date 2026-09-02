import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type * as FaceApi from "@vladmandic/face-api";
import type * as Tf from "@tensorflow/tfjs-node";

/**
 * The face nets are ~7 MB of weights and take a second or so to warm up, so
 * they load once, lazily, on the first face request rather than at boot — a
 * dev server restart shouldn't pay for them until someone marks attendance.
 *
 * Heavy deps are dynamic-imported so the API can start on machines where
 * @tensorflow/tfjs-node has no prebuilt binary (e.g. Node 24 on Windows).
 */

type FaceApiModule = typeof FaceApi;
type TfModule = typeof Tf;

let faceapi: FaceApiModule | null = null;
let tf: TfModule | null = null;
let ready: Promise<void> | null = null;

async function ensureModules(): Promise<{ faceapi: FaceApiModule; tf: TfModule }> {
  if (!faceapi || !tf) {
    const [faceapiMod, tfMod] = await Promise.all([
      import("@vladmandic/face-api"),
      import("@tensorflow/tfjs-node"),
    ]);
    faceapi = faceapiMod;
    tf = tfMod;
  }
  return { faceapi, tf };
}

export function loadFaceModels(): Promise<void> {
  ready ??= (async () => {
    const { faceapi: fa, tf: tfjs } = await ensureModules();
    const MODEL_DIR = join(
      dirname(createRequire(__filename).resolve("@vladmandic/face-api")),
      "..",
      "model"
    );

    await tfjs.ready();
    await fa.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await fa.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    await fa.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    // Used by the liveness challenge, which asks for an expression the
    // resident has to actually produce. ~300 KB on top of the rest.
    await fa.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);
  })().catch((err: unknown) => {
    // Don't cache a failed load — the next request should retry.
    ready = null;
    throw err;
  });

  return ready;
}

export async function getFaceRuntime(): Promise<{
  faceapi: FaceApiModule;
  tf: TfModule;
}> {
  await loadFaceModels();
  return ensureModules();
}

export type { FaceApi as faceapi };
