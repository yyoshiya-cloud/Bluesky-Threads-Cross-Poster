import React, { createContext, useContext } from 'react';
import { AppEvent } from './types';
import { EventChain } from './chain/EventChain';

const EventChainContext = createContext<((event: AppEvent) => void) | null>(null);

export interface EventChainProviderProps {
  chain: EventChain;
  children: React.ReactNode;
}

export const EventChainProvider: React.FC<EventChainProviderProps> = ({ chain, children }) => {
  const dispatch = (event: AppEvent) => {
    chain.dispatch(event);
  };

  return (
    <EventChainContext.Provider value={dispatch}>
      {children}
    </EventChainContext.Provider>
  );
};

export const useEventDispatch = (): ((event: AppEvent) => void) => {
  const dispatch = useContext(EventChainContext);
  if (!dispatch) {
    throw new Error('useEventDispatch must be used within an EventChainProvider');
  }
  return dispatch;
};
