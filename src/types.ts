export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface WorkerCandidate {
  id: string;
  fullName: string;
  phone: string;
  location: Coordinates;
  freeSlots: TimeSlot[];
  skills: string[];
  karmaScore: number; // 0.0 - 5.0
  completionRate: number; // 0.0 - 1.0 (e.g. 0.98 = 98% completed without cancellation)
  desiredMinHourlyRateVnd: number;
  isKycVerified: boolean;
}

export interface JobRequirement {
  id: string;
  title: string;
  category: string;
  slot: TimeSlot;
  location: Coordinates;
  addressText: string;
  maxRadiusKm: number;
  hourlyRateVnd: number;
  requiredSkills: string[];
  minKarmaScore: number;
}

export interface MatchScoreBreakdown {
  candidateId: string;
  candidateName: string;
  distanceKm: number;
  travelScore: number;      // 0 - 100
  timeScore: number;        // 0 - 100
  skillScore: number;       // 0 - 100
  reputationScore: number;  // 0 - 100
  priceScore: number;       // 0 - 100
  totalMatchScore: number;  // 0 - 100
  isEligible: boolean;
  rejectionReason?: string;
}

export enum EscrowState {
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED'
}

export interface EscrowRecord {
  jobId: string;
  posterId: string;
  workerId?: string;
  grossAmountVnd: number;
  platformFeeRate: number;
  platformFeeVnd: number;
  netWorkerPayoutVnd: number;
  state: EscrowState;
  checkInAt?: Date;
  checkOutAt?: Date;
  checkInCoords?: Coordinates;
  photoProofUrl?: string;
  disputeReason?: string;
}
