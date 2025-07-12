/**
 * Message Queue for inter-agent communication
 * Created: 2025-01-10
 */

import { EventEmitter } from 'events';
import { AgentMessage, AgentType } from './types';

export class MessageQueue extends EventEmitter {
  private queues: Map<AgentType, AgentMessage[]> = new Map();
  private subscribers: Map<string, Set<AgentType>> = new Map();
  private messageHistory: AgentMessage[] = [];
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(20); // Support multiple agents
    
    // Initialize queues for each agent type
    Object.values(AgentType).forEach(type => {
      this.queues.set(type as AgentType, []);
    });
  }

  /**
   * Send a message to a specific agent or broadcast
   */
  send(message: AgentMessage, targetAgent?: AgentType): void {
    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    if (targetAgent) {
      // Direct message to specific agent
      const queue = this.queues.get(targetAgent);
      if (queue) {
        queue.push(message);
        this.emit(`message:${targetAgent}`, message);
      }
    } else {
      // Broadcast to all agents
      this.emit('broadcast', message);
    }

    // Emit general message event for logging
    this.emit('message', message);
  }

  /**
   * Subscribe to messages for a specific agent
   */
  subscribe(agentType: AgentType, callback: (message: AgentMessage) => void): () => void {
    const eventName = `message:${agentType}`;
    this.on(eventName, callback);

    // Also subscribe to broadcasts
    const broadcastHandler = (message: AgentMessage) => {
      if (message.agentType !== agentType) {
        callback(message);
      }
    };
    this.on('broadcast', broadcastHandler);

    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
      this.off('broadcast', broadcastHandler);
    };
  }

  /**
   * Get pending messages for an agent
   */
  getMessages(agentType: AgentType): AgentMessage[] {
    const queue = this.queues.get(agentType);
    if (!queue) return [];

    const messages = [...queue];
    queue.length = 0; // Clear the queue
    return messages;
  }

  /**
   * Get message history filtered by criteria
   */
  getHistory(filter?: {
    agentType?: AgentType;
    correlationId?: string;
    type?: AgentMessage['type'];
    limit?: number;
  }): AgentMessage[] {
    let filtered = [...this.messageHistory];

    if (filter) {
      if (filter.agentType) {
        filtered = filtered.filter(m => m.agentType === filter.agentType);
      }
      if (filter.correlationId) {
        filtered = filtered.filter(m => m.correlationId === filter.correlationId);
      }
      if (filter.type) {
        filtered = filtered.filter(m => m.type === filter.type);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Clear all queues and history
   */
  clear(): void {
    this.queues.forEach(queue => queue.length = 0);
    this.messageHistory.length = 0;
  }

  /**
   * Get queue statistics
   */
  getStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    this.queues.forEach((queue, agentType) => {
      stats[agentType] = queue.length;
    });
    stats.totalMessages = this.messageHistory.length;
    return stats;
  }
}