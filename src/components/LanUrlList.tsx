import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';

interface QrCodeCardProps {
  url: string;
  scanHint?: string;
  copyTitle?: string;
  closeTitle?: string;
  onCopyUrl?: (url: string) => void;
  onClose: () => void;
}

export const QrCodeCard: React.FC<QrCodeCardProps> = ({
  url,
  scanHint,
  copyTitle,
  closeTitle,
  onCopyUrl,
  onClose,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((res) => {
        if (!cancelled) setDataUrl(res);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="lan-qr-card" role="region" aria-label={url}>
      <div className="lan-qr-frame">
        {dataUrl ? (
          <img src={dataUrl} alt={url} className="lan-qr-img" width={120} height={120} />
        ) : (
          <div className="lan-qr-loading">...</div>
        )}
      </div>
      <div className="lan-qr-meta">
        <div className="lan-qr-url-row">
          <button
            type="button"
            className="lan-qr-url-btn"
            onClick={() => onCopyUrl?.(url)}
            title={copyTitle ? `${copyTitle}: ${url}` : url}
          >
            <Copy size={11} />
            <span>{url}</span>
          </button>
          <button
            type="button"
            className="icon-btn-sm"
            onClick={onClose}
            title={closeTitle || 'Close'}
            aria-label={closeTitle || 'Close'}
          >
            <X size={12} />
          </button>
        </div>
        {scanHint && <div className="lan-qr-hint">{scanHint}</div>}
      </div>
    </div>
  );
};

interface LanUrlListProps {
  urls: string[];
  label: string;
  showTitle: string;
  hideTitle: string;
  copyTitlePrefix: string;
  qrShowTitle?: string;
  qrHideTitle?: string;
  qrScanHint?: string;
  onCopyUrl?: (url: string) => void;
  variant?: 'block' | 'inline';
  showProtocol?: boolean;
  chipClassName?: string;
  toggleClassName?: string;
}

export const LanUrlList: React.FC<LanUrlListProps> = ({
  urls,
  label,
  showTitle,
  hideTitle,
  copyTitlePrefix,
  qrShowTitle = 'QR',
  qrHideTitle = 'Close QR',
  qrScanHint,
  onCopyUrl,
  variant = 'inline',
  showProtocol = false,
  chipClassName = 'project-url-chip is-lan',
  toggleClassName = 'project-url-chip is-lan is-lan-toggle',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeQrUrl && !urls.includes(activeQrUrl)) {
      setActiveQrUrl(null);
    }
  }, [urls, activeQrUrl]);

  if (!urls || urls.length === 0) return null;

  const toggleBtn = (
    <button
      type="button"
      className={`${toggleClassName}${expanded ? ' is-expanded' : ''}`}
      onClick={() => {
        setExpanded((prev) => {
          if (prev) setActiveQrUrl(null);
          return !prev;
        });
      }}
      aria-expanded={expanded}
      title={expanded ? hideTitle : showTitle}
    >
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <span>
        {label} ({urls.length})
      </span>
    </button>
  );

  const chips = expanded
    ? urls.map((lanUrl) => {
        const qrOpen = activeQrUrl === lanUrl;
        return (
          <span key={lanUrl} className="lan-chip-group">
            <button
              type="button"
              className={chipClassName}
              onClick={() => onCopyUrl?.(lanUrl)}
              title={`${copyTitlePrefix}: ${lanUrl}`}
            >
              <Copy size={10} />
              <span>{showProtocol ? lanUrl : `LAN: ${lanUrl.replace(/^https?:\/\//, '')}`}</span>
            </button>
            <button
              type="button"
              className={`project-url-chip is-lan is-qr-btn${qrOpen ? ' is-expanded' : ''}`}
              onClick={() => setActiveQrUrl((cur) => (cur === lanUrl ? null : lanUrl))}
              title={qrOpen ? qrHideTitle : qrShowTitle}
              aria-label={qrOpen ? qrHideTitle : qrShowTitle}
              aria-expanded={qrOpen}
            >
              <QrCode size={11} />
            </button>
          </span>
        );
      })
    : null;

  const qrCard =
    expanded && activeQrUrl ? (
      <QrCodeCard
        url={activeQrUrl}
        scanHint={qrScanHint}
        copyTitle={copyTitlePrefix}
        closeTitle={qrHideTitle}
        onCopyUrl={onCopyUrl}
        onClose={() => setActiveQrUrl(null)}
      />
    ) : null;

  if (variant === 'block') {
    return (
      <div className="project-lan-collapsible">
        <div className="sidebar-project-lan-row">{toggleBtn}</div>
        {expanded && <div className="sidebar-project-lan-row">{chips}</div>}
        {qrCard}
      </div>
    );
  }

  return (
    <>
      {toggleBtn}
      {chips}
      {qrCard}
    </>
  );
};
