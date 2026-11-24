import { JobRequirement, WorkerCandidate } from '../types';
import { EscrowAccountRecord } from '../modules/escrow/escrow.service';

export interface ICandidateRepository {
  findAll(): Promise<WorkerCandidate[]>;
  findById(id: string): Promise<WorkerCandidate | undefined>;
}

export interface IJobRepository {
  findById(id: string): Promise<JobRequirement | undefined>;
  create(job: JobRequirement): Promise<JobRequirement>;
  getSampleJob(): JobRequirement;
}

export interface IEscrowRepository {
  findByJobId(jobId: string): Promise<EscrowAccountRecord | undefined>;
  save(record: EscrowAccountRecord): Promise<void>;
  hasProcessedReference(refCode: string): Promise<boolean>;
  markProcessedReference(refCode: string): Promise<void>;
}
