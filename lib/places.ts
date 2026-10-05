// Display names for location codes used in the (simulated) itinerary data.
const NAMES: Record<string, string> = { BLR: "Bengaluru", DXB: "Dubai", LHR: "London" };
export const placeName = (code: string) => NAMES[code] ?? code;
