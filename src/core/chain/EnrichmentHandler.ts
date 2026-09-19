import { AbstractEventHandler } from './EventHandler';
import { AppEvent } from '../types';

/**
 * EnrichmentHandler: イベントのサニタイズ（トリム、不要な空白除去等）やコンテキスト補正を行うハンドラー
 */
export class EnrichmentHandler extends AbstractEventHandler {
  public override handle(event: AppEvent): void {
    let enrichedEvent = event;

    if (event.type === 'UPDATE_THREADS_TOPIC') {
      // トピックタグのサニタイズ (余分な前後の空白除去)
      enrichedEvent = {
        ...event,
        payload: event.payload.trim(),
      };
    }

    // 次のハンドラーへバブリング
    super.handle(enrichedEvent);
  }
}
