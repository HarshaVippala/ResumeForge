/**
 * Base Agent class for all sub-agents
 * Created: 2025-01-10
 */

import { Worker } from 'worker_threads';
import { AgentMessage, AgentType, TaskPayload, ResultPayload, StatusPayload } from './types';
import { MessageQueue } from './message-queue';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent {
  protected worker: Worker | null = null;
  protected queue: MessageQueue;
  protected agentType: AgentType;
  protected tasks: Map<string, { 
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout?: NodeJS.Timeout;
  }> = new Map();
  protected status: 'idle' | 'busy' | 'error' = 'idle';
  protected unsubscribe?: () => void;

  constructor(
    agentType: AgentType,
    queue: MessageQueue,
    workerPath?: string
  ) {
    this.agentType = agentType;
    this.queue = queue;

    if (workerPath) {
      this.initializeWorker(workerPath);
    }

    this.subscribeToMessages();
  }

  /**
   * Initialize worker thread
   */
  protected initializeWorker(workerPath: string): void {
    this.worker = new Worker(workerPath, {
      workerData: {
        agentType: this.agentType
      }
    });

    this.worker.on('message', (message: any) => {
      this.handleWorkerMessage(message);
    });

    this.worker.on('error', (error) => {
      console.error(`Worker error in ${this.agentType}:`, error);
      this.status = 'error';
      this.sendStatus();
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${this.agentType} exited with code ${code}`);
        this.status = 'error';
      }
    });
  }

  /**
   * Subscribe to relevant messages
   */
  protected subscribeToMessages(): void {
    this.unsubscribe = this.queue.subscribe(this.agentType, (message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Handle incoming messages
   */
  protected handleMessage(message: AgentMessage): void {
    switch (message.type) {
      case 'task':
        this.processTask(message.payload as TaskPayload);
        break;
      case 'cancel':
        this.cancelTask(message.payload.taskId);
        break;
      case 'status':
        this.sendStatus();
        break;
    }
  }

  /**
   * Handle messages from worker thread
   */
  protected handleWorkerMessage(message: any): void {
    if (message.type === 'result') {
      const task = this.tasks.get(message.taskId);
      if (task) {
        if (task.timeout) {
          clearTimeout(task.timeout);
        }
        
        if (message.success) {
          task.resolve(message.data);
        } else {
          task.reject(new Error(message.error || 'Task failed'));
        }
        
        this.tasks.delete(message.taskId);
        this.status = 'idle';
        this.sendStatus();

        // Send result message to queue
        this.queue.send({
          id: uuidv4(),
          type: 'result',
          agentType: this.agentType,
          payload: message as ResultPayload,
          timestamp: Date.now(),
          correlationId: message.correlationId
        });
      }
    } else if (message.type === 'status') {
      this.status = message.status;
      this.sendStatus();
    }
  }

  /**
   * Process a task
   */
  protected async processTask(payload: TaskPayload): Promise<void> {
    if (this.status === 'busy') {
      // Queue the task or reject it
      this.queue.send({
        id: uuidv4(),
        type: 'error',
        agentType: this.agentType,
        payload: {
          taskId: payload.taskId,
          error: 'Agent is busy'
        },
        timestamp: Date.now()
      });
      return;
    }

    this.status = 'busy';
    this.sendStatus();

    // If using worker thread
    if (this.worker) {
      const promise = new Promise((resolve, reject) => {
        const timeout = payload.timeout ? setTimeout(() => {
          reject(new Error('Task timeout'));
          this.tasks.delete(payload.taskId);
          this.status = 'idle';
          this.sendStatus();
        }, payload.timeout) : undefined;

        this.tasks.set(payload.taskId, { resolve, reject, timeout });
      });

      // Send task to worker
      this.worker.postMessage({
        type: 'task',
        payload
      });

      try {
        await promise;
      } catch (error) {
        // Error already handled in promise
      }
    } else {
      // Process in main thread (override in subclass)
      try {
        const startTime = Date.now();
        const result = await this.processTaskInternal(payload);
        
        this.queue.send({
          id: uuidv4(),
          type: 'result',
          agentType: this.agentType,
          payload: {
            taskId: payload.taskId,
            success: true,
            data: result,
            duration: Date.now() - startTime
          } as ResultPayload,
          timestamp: Date.now()
        });
      } catch (error) {
        this.queue.send({
          id: uuidv4(),
          type: 'error',
          agentType: this.agentType,
          payload: {
            taskId: payload.taskId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: 0
          } as ResultPayload,
          timestamp: Date.now()
        });
      } finally {
        this.status = 'idle';
        this.sendStatus();
      }
    }
  }

  /**
   * Process task internally (override in subclass)
   */
  protected abstract processTaskInternal(payload: TaskPayload): Promise<any>;

  /**
   * Cancel a task
   */
  protected cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Task cancelled'));
      this.tasks.delete(taskId);
      
      if (this.worker) {
        this.worker.postMessage({
          type: 'cancel',
          taskId
        });
      }
    }
  }

  /**
   * Send status update
   */
  protected sendStatus(): void {
    this.queue.send({
      id: uuidv4(),
      type: 'status',
      agentType: this.agentType,
      payload: {
        agentType: this.agentType,
        status: this.status,
        tasksInQueue: this.tasks.size,
        currentTask: this.tasks.size > 0 ? Array.from(this.tasks.keys())[0] : undefined
      } as StatusPayload,
      timestamp: Date.now()
    });
  }

  /**
   * Execute a task and wait for result
   */
  async execute<T>(data: any, timeout?: number): Promise<T> {
    const taskId = uuidv4();
    const payload: TaskPayload = {
      taskId,
      priority: 1,
      timeout,
      data
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = timeout ? setTimeout(() => {
        this.tasks.delete(taskId);
        reject(new Error('Task timeout'));
      }, timeout) : undefined;

      this.tasks.set(taskId, {
        resolve: (result) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve(result);
        },
        reject: (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(error);
        }
      });

      this.processTask(payload);
    });
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    // Cancel all pending tasks
    for (const [taskId, task] of this.tasks) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Agent shutting down'));
    }
    this.tasks.clear();

    // Unsubscribe from messages
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // Terminate worker
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}