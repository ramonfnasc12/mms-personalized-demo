export class InMemoryQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private handler: (item: T) => Promise<void>;

  constructor(handler: (item: T) => Promise<void>) {
    this.handler = handler;
  }

  enqueue(item: T): void {
    this.queue.push(item);
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await this.handler(item);
      } catch (error) {
        console.error('Queue processing error:', error);
        // Log and continue - don't crash the worker
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}
