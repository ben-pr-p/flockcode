import { createContext, useContext } from 'react';

interface RightDrawerContextValue {
  openRightDrawer: () => void;
  closeRightDrawer: () => void;
}

/** Context for controlling the right (projects) drawer from any screen. */
export const RightDrawerContext = createContext<RightDrawerContextValue>({
  openRightDrawer: () => {},
  closeRightDrawer: () => {},
});

/** Hook to open/close the right (projects) drawer. */
export function useRightDrawer() {
  return useContext(RightDrawerContext);
}
