import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback(
    (message, tone = 'success', detail = '') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-3), { id, message, tone, detail }]);
      const timer = setTimeout(() => dismiss(id), 5200);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="pt-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pt-toast pt-toast-${toast.tone}`}>
            <span className="pt-toast-icon">
              <Icon name={toast.tone === 'error' ? 'AlertTriangle' : toast.tone === 'info' ? 'CircleHelp' : 'CheckCircle2'} size={17} />
            </span>
            <span className="pt-toast-copy">
              <strong>{toast.message}</strong>
              {toast.detail && <small>{toast.detail}</small>}
            </span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <Icon name="X" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
