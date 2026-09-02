import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface PhotoResult {
  uris: string[];
  /** Set when the user declined a permission — show it, don't just fail quietly. */
  problem: string | null;
}

export interface SelfieResult {
  /** Base64 JPEG for the server to check. Null when cancelled or blocked. */
  base64: string | null;
  /** Local uri of the same shot, for showing a preview. */
  uri: string | null;
  problem: string | null;
}

/** Wide enough for the face models, small enough to post over hostel wifi. */
const SELFIE_WIDTH = 1000;

/**
 * Live capture. Several flows (laundry hand-over, damage reports) need a photo
 * taken now rather than picked from the gallery, so the camera is the default.
 */
export async function capturePhoto(): Promise<PhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      uris: [],
      problem:
        "Camera access is off. Turn it on in your phone's settings to take a photo.",
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsMultipleSelection: false,
  });

  if (result.canceled) return { uris: [], problem: null };
  return { uris: result.assets.map((a) => a.uri), problem: null };
}

/**
 * A selfie for the face check, returned as base64 so the API can actually look
 * at it. The gallery is deliberately not an option here and the camera opens
 * front-facing: this photo decides whether attendance is marked or a meal is
 * recorded, so it has to be taken now, of the person holding the phone.
 *
 * The check itself happens server-side. Everything here is about getting a
 * usable shot — none of it is what stops a photo of the wrong thing.
 */
export async function captureSelfie(): Promise<SelfieResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      base64: null,
      uri: null,
      problem:
        "Camera access is off. Turn it on in your phone's settings to use the face check.",
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    quality: 0.8,
    allowsMultipleSelection: false,
  });

  if (result.canceled) return { base64: null, uri: null, problem: null };

  const shot = result.assets[0];
  if (!shot) return { base64: null, uri: null, problem: null };

  try {
    // Full-resolution phone cameras produce multi-megabyte uploads for no gain:
    // the face models work from a much smaller image.
    const context = ImageManipulator.manipulate(shot.uri).resize({
      width: SELFIE_WIDTH,
    });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      base64: true,
      compress: 0.8,
      format: SaveFormat.JPEG,
    });

    if (!saved.base64) {
      return {
        base64: null,
        uri: null,
        problem: "Couldn't prepare that photo. Try again.",
      };
    }
    return { base64: saved.base64, uri: saved.uri, problem: null };
  } catch {
    return {
      base64: null,
      uri: null,
      problem: "Couldn't prepare that photo. Try again.",
    };
  }
}

/** Fallback for when the photo already exists on the phone. */
export async function pickPhotos(limit = 4): Promise<PhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      uris: [],
      problem:
        "Photo access is off. Turn it on in your phone's settings to attach photos.",
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.6,
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });

  if (result.canceled) return { uris: [], problem: null };
  return { uris: result.assets.map((a) => a.uri), problem: null };
}
