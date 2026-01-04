type Props = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  jsnCount: number;
  onAcceptBlock: () => void;
  onPlayJsn: () => void;
};

export default function JsnChainModal({
  isOpen,
  title,
  subtitle,
  jsnCount,
  onAcceptBlock,
  onPlayJsn,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="jsn-overlay" role="dialog" aria-modal="true" aria-labelledby="jsn-chain-title">
      <div className="jsn-modal">
        <div className="jsn-header">
          <div className="jsn-title" id="jsn-chain-title">
            {title}
          </div>
          <div className="jsn-subtitle">{subtitle}</div>
        </div>
        <div className="jsn-actions">
          <button type="button" className="jsn-secondary" onClick={onAcceptBlock}>
            Accept Block
          </button>
          <button
            type="button"
            className="jsn-primary"
            onClick={onPlayJsn}
            disabled={jsnCount === 0}
          >
            Just Say No ({jsnCount})
          </button>
        </div>
      </div>
    </div>
  );
}
