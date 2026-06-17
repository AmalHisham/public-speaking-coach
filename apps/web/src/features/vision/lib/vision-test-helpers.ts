import type {
  FaceLandmarkerResult,
  Matrix,
  NormalizedLandmark,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

import type {
  VisionTasksModule,
  VisionBrowserEnvironment,
  VisionVideoElement,
} from "./vision-service-utils";

export class MockVisionVideoElement implements VisionVideoElement {
  autoplay = false;
  currentTime = 0;
  muted = false;
  pauseCallCount = 0;
  playError: Error | null = null;
  playCallCount = 0;
  playResult: Promise<void> | null = null;
  playsInline = false;
  readyState = 2;
  srcObject: MediaProvider | null = null;

  pause() {
    this.pauseCallCount += 1;
  }

  async play() {
    this.playCallCount += 1;

    if (this.playResult !== null) {
      await this.playResult;

      return;
    }

    if (this.playError !== null) {
      throw this.playError;
    }
  }
}

export function createMockVisionBrowserEnvironment(options: {
  now?: number;
  videoElement?: MockVisionVideoElement;
} = {}): {
  advanceFrame: (time?: number) => void;
  environment: VisionBrowserEnvironment;
  setNow: (value: number) => void;
  videoElement: MockVisionVideoElement;
} {
  let nowValue = options.now ?? 1_000;
  let nextHandle = 1;
  const scheduledFrames = new Map<number, FrameRequestCallback>();
  const videoElement = options.videoElement ?? new MockVisionVideoElement();

  return {
    advanceFrame: (time = nowValue) => {
      const queuedFrames = [...scheduledFrames.values()];

      scheduledFrames.clear();

      for (const callback of queuedFrames) {
        callback(time);
      }
    },
    environment: {
      cancelAnimationFrame: (handle) => {
        scheduledFrames.delete(handle);
      },
      createVideoElement: () => videoElement,
      now: () => nowValue,
      requestAnimationFrame: (callback) => {
        const handle = nextHandle;

        nextHandle += 1;
        scheduledFrames.set(handle, callback);

        return handle;
      },
    },
    setNow: (value) => {
      nowValue = value;
    },
    videoElement,
  };
}

export function createMockMediaStream(options: {
  readyState?: MediaStreamTrackState;
} = {}): {
  stream: MediaStream;
  track: MediaStreamTrack;
} {
  const track = {
    readyState: options.readyState ?? "live",
    stop: () => {},
  } as unknown as MediaStreamTrack;

  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    track,
  };
}

export function createNormalizedLandmark(
  overrides: Partial<NormalizedLandmark> = {},
): NormalizedLandmark {
  return {
    visibility: 0.95,
    x: 0.1,
    y: 0.2,
    z: 0.3,
    ...overrides,
  };
}

export function createTransformationMatrix(
  overrides: Partial<Matrix> = {},
): Matrix {
  return {
    columns: 4,
    data: Array.from({ length: 16 }, (_, index) => index + 1),
    rows: 4,
    ...overrides,
  };
}

export function createMockVisionTasksModule(options: {
  createFaceLandmarker?: () => {
    close: () => void;
    detectForVideo: (
      videoElement: HTMLVideoElement,
      timestampMs: number,
    ) => FaceLandmarkerResult;
  };
  createPoseLandmarker?: () => {
    close: () => void;
    detectForVideo: (
      videoElement: HTMLVideoElement,
      timestampMs: number,
    ) => PoseLandmarkerResult;
  };
  filesetResolverError?: Error;
} = {}): VisionTasksModule {
  return {
    FaceLandmarker: {
      createFromOptions: async () => {
        if (!options.createFaceLandmarker) {
          throw new Error("Face landmarker creation was not configured.");
        }

        return options.createFaceLandmarker();
      },
    },
    FilesetResolver: {
      forVisionTasks: async () => {
        if (options.filesetResolverError) {
          throw options.filesetResolverError;
        }

        return {} as Awaited<
          ReturnType<VisionTasksModule["FilesetResolver"]["forVisionTasks"]>
        >;
      },
    },
    PoseLandmarker: {
      createFromOptions: async () => {
        if (!options.createPoseLandmarker) {
          throw new Error("Pose landmarker creation was not configured.");
        }

        return options.createPoseLandmarker();
      },
    },
  } as unknown as VisionTasksModule;
}
