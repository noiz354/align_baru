export type LocationPermissionState = "granted" | "prompt" | "denied" | "unknown";
export type LocationCaptureFailure = "denied" | "unavailable" | "timeout" | "unsupported";

export interface OneShotLocationFix {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAt: string;
}

export class LocationCaptureError extends Error {
  constructor(readonly reason: LocationCaptureFailure) {
    super(reason);
    this.name = "LocationCaptureError";
  }
}

export const readLocationPermission = async (): Promise<LocationPermissionState> => {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
};

/** Exactly one browser position request; it is called only by the Page 10 tap handler. */
export const requestOneShotPosition = (): Promise<OneShotLocationFix> => new Promise((resolve, reject) => {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    reject(new LocationCaptureError("unsupported"));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const capturedAt = new Date(position.timestamp);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000 ||
          !Number.isFinite(capturedAt.getTime())) {
        reject(new LocationCaptureError("unavailable"));
        return;
      }
      resolve({
        latitude,
        longitude,
        accuracyMeters: accuracy,
        capturedAt: capturedAt.toISOString(),
      });
    },
    (error) => {
      const reason: LocationCaptureFailure = error.code === error.PERMISSION_DENIED ? "denied"
        : error.code === error.TIMEOUT ? "timeout"
        : "unavailable";
      reject(new LocationCaptureError(reason));
    },
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
  );
});
