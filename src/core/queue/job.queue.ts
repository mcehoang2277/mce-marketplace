export type TaskHandler = (payload: any) => Promise<void>;

export interface QueueJob {
  id: string;
  type: string;
  payload: any;
  createdAt: Date;
  scheduledAt?: Date;
}

/**
 * Background Job Queue (Hàng đợi tác vụ ngầm bất đồng bộ)
 * Tách rời các tác vụ tốn thời gian ra khỏi HTTP Request-Response Lifecycle:
 * - Tự động giải ngân sau 24h nếu người thuê không khiếu nại
 * - Bắn thông báo đẩy (Push Notification) tới ứng viên phù hợp
 * - Gửi email xác nhận hóa đơn
 */
export class BackgroundJobQueue {
  private static instance: BackgroundJobQueue;
  private handlers: Map<string, TaskHandler> = new Map();
  private queue: QueueJob[] = [];
  private isProcessing: boolean = false;

  public static getInstance(): BackgroundJobQueue {
    if (!BackgroundJobQueue.instance) {
      BackgroundJobQueue.instance = new BackgroundJobQueue();
    }
    return BackgroundJobQueue.instance;
  }

  public registerHandler(type: string, handler: TaskHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Đẩy tác vụ vào hàng đợi để xử lý ngầm không block HTTP request
   */
  public enqueue(type: string, payload: any, delayMs: number = 0): string {
    const jobId = `job-task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const job: QueueJob = {
      id: jobId,
      type,
      payload,
      createdAt: new Date(),
      scheduledAt: delayMs > 0 ? new Date(Date.now() + delayMs) : undefined
    };

    if (delayMs > 0) {
      setTimeout(() => {
        this.processSingleJob(job).catch(console.error);
      }, delayMs);
    } else {
      this.queue.push(job);
      this.processNext();
    }

    return jobId;
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const job = this.queue.shift();
    if (job) {
      await this.processSingleJob(job);
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      setImmediate(() => this.processNext());
    }
  }

  private async processSingleJob(job: QueueJob) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.warn(`[Queue Warning] Không tìm thấy handler xử lý cho tác vụ: ${job.type}`);
      return;
    }

    try {
      await handler(job.payload);
      console.log(`[Queue Success] Hoàn thành tác vụ ngầm [${job.type}] ID: ${job.id}`);
    } catch (err: any) {
      console.error(`[Queue Error] Thất bại khi thực hiện tác vụ [${job.type}]:`, err.message);
    }
  }
}

export const backgroundQueue = BackgroundJobQueue.getInstance();
