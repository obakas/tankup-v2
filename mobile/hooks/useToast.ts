import { useCallback, useRef, useState } from "react";

export type ToastState = { msg: string; ok: boolean } | null;

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string, ok = true) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ msg, ok });
      timerRef.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  return { toast, showToast };
}
