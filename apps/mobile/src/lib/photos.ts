import * as ImagePicker from "expo-image-picker";

export interface PhotoResult {
  uris: string[];
  /** Set when the user declined a permission — show it, don't just fail quietly. */
  problem: string | null;
}

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
