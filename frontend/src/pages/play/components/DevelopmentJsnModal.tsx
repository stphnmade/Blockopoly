type Props = {
  isOpen: boolean;
  devLabel: string;
  devRequester?: string;
  jsnCount: number;
  displayName: (pid?: string | null) => string;
  onAllow: () => void;
  onJsn: () => void;
};

export default function DevelopmentJsnModal({
  isOpen,
  devLabel,
  devRequester,
  jsnCount,
  displayName,
  onAllow,
  onJsn,
}: Props) {
  if (!isOpen) return null;

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
          <button type="button" className="jsn-secondary" onClick={onAllow}>
            Allow
          </button>
          <button
            type="button"
            className="jsn-primary"
            onClick={onJsn}
            disabled={jsnCount === 0}
          >
            Just Say No ({jsnCount})
          </button>
        </div>
      </div>
    </div>
  );
}
