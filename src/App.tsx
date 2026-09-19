/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { AppMediator } from './core/mediator/AppMediator';
import { EventChain } from './core/chain/EventChain';
import { EventChainProvider } from './core/EventChainContext';
import { Root } from './components/Root';
import { RootViewModel } from './core/types';
import { getPendingDueScheduledPosts } from './utils/scheduledStorage';
import { executeScheduledPostItem } from './utils/scheduledExecutor';

export default function App() {
  // 1. ステートマシンとして振る舞う Mediator をインスタンス化
  const mediator = useMemo(() => new AppMediator(), []);

  // 2. 責任の連鎖 (Chain of Responsibility) を構築し、終端を Mediator に接続
  const eventChain = useMemo(() => {
    return new EventChain(mediator, (title, message) => {
      mediator.arbitrate({
        type: 'NOTIFY',
        payload: {
          type: 'warning',
          title,
          message,
        },
      });
    });
  }, [mediator]);

  // 3. MVP パターン: Mediator から Passive View への ViewModel バインディング
  const [viewModel, setViewModel] = useState<RootViewModel>(() => mediator.getViewModel());

  useEffect(() => {
    const unsubscribe = mediator.subscribe((nextViewModel) => {
      setViewModel(nextViewModel);
    });
    return unsubscribe;
  }, [mediator]);

  // 4. ブラウザ終了・リロード時の安全な同期保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      mediator.saveDraftSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [mediator]);

  // 5. バックグラウンド予約投稿の定周期監視（10秒おき & フォーカス時）
  const isExecutingScheduledRef = useRef(false);
  useEffect(() => {
    const checkAndExecuteDuePosts = async () => {
      if (isExecutingScheduledRef.current) return;
      const duePosts = getPendingDueScheduledPosts();
      if (duePosts.length === 0) return;

      isExecutingScheduledRef.current = true;
      try {
        for (const item of duePosts) {
          await executeScheduledPostItem(item, viewModel.credentials, (res) => {
            eventChain.dispatch({
              type: 'NOTIFY',
              payload: {
                type: res.success ? 'success' : 'error',
                title: res.success ? '⏰ 予約投稿完了' : '⚠️ 予約投稿エラー',
                message: res.message,
                duration: 8000,
              },
            });
          });
        }
        eventChain.dispatch({ type: 'REFRESH_SCHEDULED_POSTS' });
      } catch (err) {
        console.error('Scheduled post execution error in mediator runtime:', err);
      } finally {
        isExecutingScheduledRef.current = false;
      }
    };

    checkAndExecuteDuePosts();
    const interval = setInterval(checkAndExecuteDuePosts, 10000);

    const handleFocus = () => {
      checkAndExecuteDuePosts();
      eventChain.dispatch({ type: 'REFRESH_SCHEDULED_POSTS' });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [mediator, eventChain, viewModel.credentials]);

  // 6. すべてのコンポーネントを Root の配下に置き、MVP Passive View としてレンダリング
  return (
    <EventChainProvider chain={eventChain}>
      <Root viewModel={viewModel} />
    </EventChainProvider>
  );
}
