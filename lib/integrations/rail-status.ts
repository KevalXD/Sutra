export type LiveRailStatus = {
  trainNumber: string;
  trainName: string;
  status: string;
  delayMinutes: number | null;
  lastUpdatedAt: string;
  currentStationCode: string | null;
  nextStationName: string | null;
  nextStationCode: string | null;
  isLive: boolean;
  providerSource: "RailRadar";
};

export type RailStatusErrorCode =
  | "INVALID_TRAIN_NUMBER"
  | "RAIL_STATUS_NOT_CONFIGURED"
  | "RAIL_STATUS_NOT_FOUND"
  | "RAIL_STATUS_UNAUTHORIZED"
  | "RAIL_STATUS_RATE_LIMITED"
  | "RAIL_STATUS_UNAVAILABLE"
  | "RAIL_STATUS_INVALID_RESPONSE";

export class RailStatusError extends Error {
  constructor(public readonly code: RailStatusErrorCode, message: string, public readonly status: number) {
    super(message);
  }
}

export const isTrainNumber = (value: string): boolean => /^\d{5}$/.test(value);
