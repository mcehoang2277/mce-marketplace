// Legacy Adapter - Re-exports from unified MatchingService
import { MatchingService } from '../modules/matching/matching.service';
import { Coordinates } from '../types';
import { GeoUtils } from '../core/utils/geo.utils';

export class MatchingEngine {
  public static calculateHaversineDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
    return GeoUtils.calculateDistanceKm(coord1, coord2);
  }

  public static isTimeSlotCovered = MatchingService.isTimeSlotCovered.bind(MatchingService);
  public static fastFilter = MatchingService.fastFilter.bind(MatchingService);
  public static evaluateCandidate = MatchingService.evaluateCandidate.bind(MatchingService);
  public static rankCandidates = MatchingService.rankCandidates.bind(MatchingService);
}
