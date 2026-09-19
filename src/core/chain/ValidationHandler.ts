import { AbstractEventHandler } from './EventHandler';
import { AppEvent } from '../types';

export interface ValidationCallback {
  onValidationFailure: (title: string, message: string) => void;
}

/**
 * ValidationHandler: イベントの整合性や必須パラメータの事前検証を行うハンドラー
 */
export class ValidationHandler extends AbstractEventHandler {
  constructor(private callback?: ValidationCallback) {
    super();
  }

  public override handle(event: AppEvent): void {
    // 投稿リクエスト時の検証
    if (event.type === 'SCHEDULE_POST_REQUEST') {
      const now = Date.now();
      if (event.payload.scheduledAt <= now) {
        if (this.callback) {
          this.callback.onValidationFailure(
            '予約日時の指定エラー',
            '過去の日時を指定して予約することはできません。現在より未来の日時を指定してください。'
          );
        }
        return; // バブリングを中断
      }
    }

    // 次のハンドラーへイベントをバブリング
    super.handle(event);
  }
}
