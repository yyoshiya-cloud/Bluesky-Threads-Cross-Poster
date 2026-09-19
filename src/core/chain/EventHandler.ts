import { AppEvent } from '../types';

/**
 * Chain of Responsibility (責任の連鎖) ハンドラーインターフェース
 */
export interface IEventHandler {
  setNext(handler: IEventHandler): IEventHandler;
  handle(event: AppEvent): void;
}

/**
 * 抽象基底ハンドラー
 * 各ハンドラーは自身で処理を行いつつ、次のハンドラーへイベントをバブリング（伝播）させる
 */
export abstract class AbstractEventHandler implements IEventHandler {
  protected nextHandler: IEventHandler | null = null;

  public setNext(handler: IEventHandler): IEventHandler {
    this.nextHandler = handler;
    return handler;
  }

  public handle(event: AppEvent): void {
    if (this.nextHandler) {
      this.nextHandler.handle(event);
    }
  }
}
