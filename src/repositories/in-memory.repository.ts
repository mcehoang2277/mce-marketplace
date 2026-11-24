import { ICandidateRepository, IJobRepository, IEscrowRepository } from './interfaces';
import { JobRequirement, WorkerCandidate } from '../types';
import { EscrowAccountRecord } from '../modules/escrow/escrow.service';

export class InMemoryRepository implements ICandidateRepository, IJobRepository, IEscrowRepository {
  private static instance: InMemoryRepository;

  private candidates: WorkerCandidate[] = [];
  private jobs: Map<string, JobRequirement> = new Map();
  private escrows: Map<string, EscrowAccountRecord> = new Map();
  private processedRefs: Set<string> = new Set();
  private sampleJob: JobRequirement;

  private constructor() {
    const today = new Date();
    this.candidates = [
      {
        id: 'worker-001',
        fullName: 'Nguyễn Văn An (Sinh viên)',
        phone: '0981234567',
        location: { lat: 21.0175, lng: 105.8423 },
        freeSlots: [
          {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0)
          }
        ],
        skills: ['dong_goi', 'can_than', 'xe_may'],
        karmaScore: 4.9,
        completionRate: 0.98,
        desiredMinHourlyRateVnd: 75000,
        isKycVerified: true
      },
      {
        id: 'worker-002',
        fullName: 'Trần Thị Bình (Tìm việc linh hoạt)',
        phone: '0977654321',
        location: { lat: 21.0501, lng: 105.8123 },
        freeSlots: [
          {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0)
          }
        ],
        skills: ['dong_goi'],
        karmaScore: 4.3,
        completionRate: 0.90,
        desiredMinHourlyRateVnd: 85000,
        isKycVerified: true
      },
      {
        id: 'worker-003',
        fullName: 'Lê Văn Cường (Gần nhưng bận)',
        phone: '0912345999',
        location: { lat: 21.0290, lng: 105.8550 },
        freeSlots: [
          {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0)
          }
        ],
        skills: ['dong_goi', 'can_than'],
        karmaScore: 4.8,
        completionRate: 0.95,
        desiredMinHourlyRateVnd: 70000,
        isKycVerified: true
      },
      {
        id: 'worker-004',
        fullName: 'Phạm Đức Dũng (Ở quá xa)',
        phone: '0933221100',
        location: { lat: 20.9723, lng: 105.8621 },
        freeSlots: [
          {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0)
          }
        ],
        skills: ['dong_goi', 'can_than'],
        karmaScore: 5.0,
        completionRate: 1.0,
        desiredMinHourlyRateVnd: 70000,
        isKycVerified: true
      }
    ];

    this.sampleJob = {
      id: 'JOB-HANOI-001',
      title: 'Phụ đóng gói 300 kiện hàng shopee',
      category: 'Kho vận & Đóng hàng',
      slot: {
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0)
      },
      location: { lat: 21.028511, lng: 105.854444 },
      addressText: 'Số 12 Tràng Thi, Hoàn Kiếm, Hà Nội',
      maxRadiusKm: 6.0,
      hourlyRateVnd: 80000,
      requiredSkills: ['dong_goi', 'can_than'],
      minKarmaScore: 4.0
    };
    this.jobs.set(this.sampleJob.id, this.sampleJob);
  }

  public static getInstance(): InMemoryRepository {
    if (!InMemoryRepository.instance) {
      InMemoryRepository.instance = new InMemoryRepository();
    }
    return InMemoryRepository.instance;
  }

  // --- ICandidateRepository ---
  async findAll(): Promise<WorkerCandidate[]> {
    return this.candidates;
  }

  async findCandidateById(id: string): Promise<WorkerCandidate | undefined> {
    return this.candidates.find((c) => c.id === id);
  }

  // --- IJobRepository ---
  async findJobById(id: string): Promise<JobRequirement | undefined> {
    return this.jobs.get(id);
  }

  async create(job: JobRequirement): Promise<JobRequirement> {
    this.jobs.set(job.id, job);
    return job;
  }

  getSampleJob(): JobRequirement {
    return this.sampleJob;
  }

  // --- IEscrowRepository ---
  async findByJobId(jobId: string): Promise<EscrowAccountRecord | undefined> {
    return this.escrows.get(jobId);
  }

  async save(record: EscrowAccountRecord): Promise<void> {
    this.escrows.set(record.jobId, record);
  }

  async hasProcessedReference(refCode: string): Promise<boolean> {
    return this.processedRefs.has(refCode);
  }

  async markProcessedReference(refCode: string): Promise<void> {
    this.processedRefs.add(refCode);
  }
}

export const repository = InMemoryRepository.getInstance();
