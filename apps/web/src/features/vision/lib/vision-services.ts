import type {
  FaceLandmarkerService,
  PoseLandmarkerService,
} from "@/types/vision";

import { createFaceLandmarkerService } from "./face-landmarker-service";
import { createPoseLandmarkerService } from "./pose-landmarker-service";

export type VisionServices = {
  faceLandmarker: FaceLandmarkerService;
  poseLandmarker: PoseLandmarkerService;
};

export type VisionServicesFactory = () => VisionServices;

export function createVisionServices(): VisionServices {
  return {
    faceLandmarker: createFaceLandmarkerService(),
    poseLandmarker: createPoseLandmarkerService(),
  };
}
