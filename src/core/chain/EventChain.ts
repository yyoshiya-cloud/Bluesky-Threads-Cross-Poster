import { IEventHandler } from './EventHandler';
import { ValidationHandler } from './ValidationHandler';
import { EnrichmentHandler } from './EnrichmentHandler';
import { MediatorTerminalHandler, IMediatorArbitrator } from './MediatorTerminalHandler';
import { AppEvent } from '../types';

/**
 * EventChain:
 * UIコンポーネントからのイベントを責任の連鎖でバブリングさせ、
 * 最終的にステートマシン Mediator に裁定させるパイプライン
 */
export class EventChain {
  private head: IEventHandler;

  constructor(mediator: IMediatorArbitrator, onValidationError?: (title: string, message: string) => void) {
    const validationHandler = new ValidationHandler(
      onValidationError ? { onValidationFailure: onValidationError } : undefined
    );
    const enrichmentHandler = new EnrichmentHandler();
    const terminalHandler = new MediatorTerminalHandler(mediator);

    // チェーンをリンク: Validation -> Enrichment -> Terminal(Mediator)
    validationHandler.setNext(enrichmentHandler).setNext(terminalHandler);

    this.head = validationHandler;
  }

  /**
   * イベントを Chain に投入し、バブリングを開始する
   */
  public dispatch(event: AppEvent): void {
    this.head.handle(event);
  }
}
