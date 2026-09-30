/** PHASE 0 — the only Page 11 browser camera call; invoked only from the explicit start button. */
export type TrafficCapture = { stream: MediaStream; recorder: MediaRecorder };

export const startSilentTrafficCapture = async (): Promise<TrafficCapture> => {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw Object.assign(new Error("Silent video capture is not supported"), { code: "UNSUPPORTED" });
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
    ? "video/webm;codecs=vp8"
    : "video/webm";
  try {
    const recorder = new MediaRecorder(stream, { mimeType });
    return { stream, recorder };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
};
