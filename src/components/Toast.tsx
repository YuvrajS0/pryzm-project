"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [visible, message]);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {message && (
        <div
          className={`fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-white shadow-lg transition-all duration-300 lg:bottom-8 ${
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0"
          }`}
        >
          {message}
        </div>
      )}
    </ToastContext>
  );
}
