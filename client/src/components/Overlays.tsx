import type { ReactNode } from 'react';
import { useStore } from '../state/store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ConnectionBanner() {
  const status = useStore((s) => s.connection);
  if (status === 'connected') return null;
  const text =
    status === 'connecting' ? 'CONNECTING TO SERVER…' : status === 'reconnecting' ? 'CONNECTION LOST – RECONNECTING…' : 'SERVER UNREACHABLE – RETRYING…';
  return <div className="connection-banner">{text}</div>;
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal px-panel pop-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2 className="px-panel-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
