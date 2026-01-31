import { useEffect, useState } from "react";

type Props = {
  isOpen: boolean;
  devLabel: string;
  devRequester?: string;
  jsnCount: number;
  displayName: (pid?: string | null) => string;
  onAllow: () => void;
};

export default function DevelopmentJsnModal({
  isOpen,
  devLabel,
  devRequester,
  jsnCount,
  displayName,
  onAllow,
}: Props) {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <button
        type="button"
        className="modal-minimized-banner"
        onClick={() => setIsMinimized(false)}
      >
        <span className="modal-minimized-dot" />
        <span className="modal-minimized-label">Block {devLabel}?</span>
      </button>
    );
  }

  return (
    <div className="jsn-overlay" role="dialog" aria-modal="true" aria-labelledby="jsn-title">
      <div className="jsn-modal">
        <div className="jsn-header">
          <div>
            <div className="jsn-title" id="jsn-title">
              Block {devLabel}?
            </div>
            <div className="jsn-subtitle">
              {displayName(devRequester)} played {devLabel} on a completed set.
            </div>
          </div>
        </div>
        <div className="jsn-actions">
          <button
            type="button"
            className="modal-minimize"
            onClick={() => setIsMinimized(true)}
          >
            Minimize
          </button>
          <button type="button" className="jsn-secondary" onClick={onAllow}>
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
