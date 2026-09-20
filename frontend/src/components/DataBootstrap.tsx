'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function DataBootstrap() {
  const refreshFromApi = useStore(
    state => state.refreshFromApi
  );

  useEffect(() => {
    void refreshFromApi();

    const interval = setInterval(() => {
      void refreshFromApi();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshFromApi]);

  return null;
}