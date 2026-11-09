import { useEffect, useState } from 'react';
import type { DashboardData } from '../types';
import { loadDashboardData } from '../utils/loadData';

type State =
  | { status: 'loading'; step: string }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: DashboardData };

/** Carga y procesa los tres archivos una sola vez. */
export function useDashboardData(): State {
  const [state, setState] = useState<State>({ status: 'loading', step: 'Iniciando…' });
  useEffect(() => {
    let alive = true;
    loadDashboardData((step) => alive && setState({ status: 'loading', step }))
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: Error) => alive && setState({ status: 'error', error: e.message }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
