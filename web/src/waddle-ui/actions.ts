/**
 * Waddle UI Action Router.
 * Dispatches controlled events from Generative UI components to Waddle system layers.
 */

import type { UIAction, ActionHandler } from './types.ts';

export const ALLOWED_ACTIONS = new Set([
  'task.cancel',
  'task.details',
  'task.retry',
  'approval.respond',
  'approval.allow_once',
  'approval.allow_always',
  'approval.deny',
  'match.follow',
  'match.notify',
  'match.events',
  'stock.chart',
  'stock.watchlist',
  'source.open',
  'review.full',
  'review.fix',
  'tool.rerun',
  'custom.dispatch',
]);

type ActionSubscriber = (action: UIAction) => void;

class ActionRouter {
  private subscribers: Set<ActionSubscriber> = new Set();
  private history: UIAction[] = [];

  /**
   * Subscribe to all UI actions dispatched in the system.
   */
  public subscribe(subscriber: ActionSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Dispatches an action from an interactive Generative UI element.
   */
  public dispatch(actionName: string, payload?: any): UIAction {
    const actionObj: UIAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: actionName,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Keep history trimmed to last 50 actions for debug/inspection
    this.history.unshift(actionObj);
    if (this.history.length > 50) {
      this.history.pop();
    }

    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(actionObj);
      } catch (err) {
        console.error('[ActionRouter] Error in subscriber:', err);
      }
    });

    return actionObj;
  }

  /**
   * Gets the recent action history (useful for playground and inspector).
   */
  public getHistory(): UIAction[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.history = [];
  }
}

export const actionRouter = new ActionRouter();

/**
 * Creates an action dispatcher tied to an optional custom handler.
 */
export function createActionDispatcher(customHandler?: ActionHandler): ActionHandler {
  return (actionName: string, payload?: any) => {
    actionRouter.dispatch(actionName, payload);
    if (customHandler) {
      customHandler(actionName, payload);
    }
  };
}
