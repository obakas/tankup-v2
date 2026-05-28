import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Pauses polling when the app goes to background and resumes it when the app
 * returns to the foreground. Uses refs so callers don't need to memoize callbacks.
 */
export function useAppStatePause(
  onPause: () => void,
  onResume: () => void,
) {
  const appStateRef = useRef(AppState.currentState);
  const onPauseRef = useRef(onPause);
  const onResumeRef = useRef(onResume);

  // Always hold the latest callbacks without re-subscribing to AppState.
  onPauseRef.current = onPause;
  onResumeRef.current = onResume;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      const isNowActive = nextState === "active";

      if (wasActive && !isNowActive) {
        onPauseRef.current();
      } else if (!wasActive && isNowActive) {
        onResumeRef.current();
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []); // subscribe once — callbacks stay fresh via refs
}
