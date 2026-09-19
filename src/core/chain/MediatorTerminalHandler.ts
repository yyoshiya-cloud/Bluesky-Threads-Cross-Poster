import { AbstractEventHandler } from './EventHandler';
import { AppEvent } from '../types';

export interface IMediatorArbitrator {
  arbitrate(event: AppEvent): void;
}

/**
 * MediatorTerminalHandler:
 * Chain of Responsibility の最終終端として、
 * バブリングされてきたイベントをステートマシン Mediator に裁定（Arbitrate）させるハンドラー
 */
export class MediatorTerminalHandler extends AbstractEventHandler {
  constructor(private mediator: IMediatorArbitrator) {
    super();
  }

  public override handle(event: AppEvent): void {
    // Mediator にイベントを委譲して裁定させる
    this.mediator.arbitrate(event);

    // 後続ハンドラーが存在する場合は引き続き伝播
    super.handle(event);
  }
}
