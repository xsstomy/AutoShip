/**
 * 通用轮询工具函数
 */

/**
 * 轮询配置选项
 */
export interface PollerOptions {
  interval: number;
  maxAttempts?: number;
  timeout?: number;
  shouldStop?: (result: any) => boolean;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  onComplete?: () => void;
}

/**
 * 轮询器类
 */
export class Poller<T = any> {
  intervalId: number | null = null;
  timeoutId: number | null = null;
  attempts = 0;
  startTime = 0;
  isActive = false;
  pollFunction: () => Promise<T>;
  options: PollerOptions;

  constructor(
    pollFunction: () => Promise<T>,
    options: PollerOptions
  ) {
    this.pollFunction = pollFunction;
    this.options = options;
  }

  /**
   * 开始轮询
   */
  start(): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.isActive) {
        reject(new Error('Poller is already active'));
        return;
      }

      this.isActive = true;
      this.attempts = 0;
      this.startTime = Date.now();

      // 设置超时
      if (this.options.timeout) {
        this.timeoutId = setTimeout(() => {
          this.stop();
          this.options.onTimeout?.();
          reject(new Error('Poller timeout'));
        }, this.options.timeout);
      }

      // 执行轮询
      const executePoll = async () => {
        if (!this.isActive) return;

        try {
          this.attempts++;
          const result = await this.pollFunction();

          // 检查是否应该停止
          if (this.options.shouldStop?.(result)) {
            this.stop();
            this.options.onSuccess?.(result);
            resolve(result);
            return;
          }

          // 检查最大尝试次数
          if (this.options.maxAttempts && this.attempts >= this.options.maxAttempts) {
            this.stop();
            reject(new Error('Maximum poll attempts reached'));
            return;
          }

          // 继续下一次轮询
          if (this.isActive) {
            this.intervalId = setTimeout(executePoll, this.options.interval);
          }
        } catch (error) {
          this.options.onError?.(error as Error);

          // 继续轮询，除非是致命错误
          if (this.isActive) {
            this.intervalId = setTimeout(executePoll, this.options.interval);
          }
        }
      };

      // 立即执行第一次轮询
      executePoll();
    });
  }

  /**
   * 停止轮询
   */
  stop(): void {
    this.isActive = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.options.onComplete?.();
  }

  /**
   * 获取轮询统计信息
   */
  getStats() {
    return {
      attempts: this.attempts,
      elapsedTime: Date.now() - this.startTime,
      isActive: this.isActive,
    };
  }
}

/**
 * 创建简单的轮询器
 */
export function createPoller<T>(
  pollFunction: () => Promise<T>,
  options: PollerOptions
): Poller<T> {
  return new Poller(pollFunction, options);
}

/**
 * 便捷的轮询函数
 */
export async function poll<T>(
  pollFunction: () => Promise<T>,
  options: PollerOptions
): Promise<T> {
  const poller = new Poller(pollFunction, options);
  return poller.start();
}

/**
 * 轮询状态枚举
 */
export const PollerStatus = {
  IDLE: 'idle',
  POLLING: 'polling',
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  STOPPED: 'stopped',
} as const;

/**
 * 轮询结果类型
 */
export type PollerResult<T> = {
  data: T | null;
  status: keyof typeof PollerStatus;
  error: Error | null;
  attempts: number;
  elapsedTime: number;
};