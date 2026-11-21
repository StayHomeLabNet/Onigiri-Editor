import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, QrCode, Wifi, X } from 'lucide-react';
import QRCode from 'qrcode';

export async function generateLanQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 148,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

interface QrCodeCardProps {
  url: string;
  scanHint?: string;
  copyTitle: string;
  closeTitle: string;
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
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    generateLanQrDataUrl(url)
      .then((res) => {
        if (!cancelled) setDataUrl(res);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="lan-qr-card" role="region" aria-label="LAN QR Code">
      <div className="lan-qr-frame">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code for ${url}`} className="lan-qr-img" />
        ) : (
          <div className="lan-qr-loading">…</div>
        )}
      </div>
      <div className="lan-qr-meta">
        <div className="lan-qr-url-row">
          <button
            type="button"
            className="lan-qr-url-btn"
            onClick={() => onCopyUrl?.(url)}
            title={`${copyTitle}: ${url}`}
          >
            <Copy size={11} />
            <span>{url}</span>
          </button>
          <button
            type="button"
            className="icon-btn-sm"
            onClick={onClose}
            title={closeTitle}
            aria-label={closeTitle}
          >
            <X size={12} />
          </button>
        </div>
        {scanHint && <div className="lan-qr-hint">{scanHint}</div>}
      </div>
    </div>
  );
};

function extractIpv4Octets(urlStr: string): [number, number, number, number] | null {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.hostname.split('.');
    if (parts.length !== 4) return null;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    return [nums[0], nums[1], nums[2], nums[3]];
  } catch {
    return null;
  }
}

export function isLikelyVirtualLanIp(
  octets: [number, number, number, number],
  hasStandardPrivateLan: boolean,
  hasNonGateway192: boolean
): boolean {
  const [a, b, c, d] = octets;
  // VirtualBox Host-Only default (192.168.56.x) or libvirt bridge (192.168.122.x)
  if (a === 192 && b === 168 && (c === 56 || c === 122)) return true;
  // CGNAT / Tailscale (100.64.0.0/10)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // Link-local APIPA (169.254.x.x)
  if (a === 169 && b === 254) return true;
  // Docker / WSL / Hyper-V default bridges (172.16.0.0/12) when a 192.168.x.x or 10.x.x.x LAN exists
  if (a === 172 && b >= 16 && b <= 31 && hasStandardPrivateLan) return true;
  // Host-only virtual adapters often assign .1 to the host PC on a secondary 192.168.x.1 subnet
  if (a === 192 && b === 168 && d === 1 && hasNonGateway192) return true;
  return false;
}

export function partitionLanUrls(urls: string[]): {
  primaryUrls: string[];
  secondaryUrls: string[];
} {
  if (!urls || urls.length <= 1) {
    return { primaryUrls: urls || [], secondaryUrls: [] };
  }
  const parsedList = urls.map((u) => ({ url: u, octets: extractIpv4Octets(u) }));
  const hasStandardPrivateLan = parsedList.some(({ octets }) => {
    if (!octets) return false;
    const [a, b, c] = octets;
    if (a === 192 && b === 168 && c !== 56 && c !== 122) return true;
    if (a === 10) return true;
    return false;
  });
  const hasNonGateway192 = parsedList.some(({ octets }) => {
    if (!octets) return false;
    const [a, b, c, d] = octets;
    return a === 192 && b === 168 && c !== 56 && c !== 122 && d !== 1;
  });

  const primaryUrls: string[] = [];
  const secondaryUrls: string[] = [];

  for (const item of parsedList) {
    const isVirtual =
      item.octets !== null &&
      isLikelyVirtualLanIp(item.octets, hasStandardPrivateLan, hasNonGateway192);
    if (!isVirtual && primaryUrls.length < 2) {
      primaryUrls.push(item.url);
    } else {
      secondaryUrls.push(item.url);
    }
  }

  if (primaryUrls.length === 0 && secondaryUrls.length > 0) {
    primaryUrls.push(secondaryUrls.shift()!);
  }

  return { primaryUrls, secondaryUrls };
}

interface LanUrlListProps {
  urls: string[];
  label: string;
  showTitle: string;
  hideTitle: string;
  copyTitlePrefix: string;
  qrShowTitle?: string;
  qrHideTitle?: string;
  qrScanHint?: string;
  showOtherTemplate?: string;
  hideOtherLabel?: string;
  onCopyUrl?: (url: string) => void;
  defaultExpanded?: boolean;
  showProtocol?: boolean;
  variant?: 'inline' | 'block';
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
  showOtherTemplate = '+{count} virtual/other',
  hideOtherLabel = 'Hide virtual/other',
  onCopyUrl,
  defaultExpanded = false,
  showProtocol = false,
  variant = 'inline',
  chipClassName = 'project-url-chip is-lan',
  toggleClassName = 'project-url-chip is-lan is-lan-toggle',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showSecondary, setShowSecondary] = useState(false);
  const [qrTargetUrl, setQrTargetUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { primaryUrls, secondaryUrls } = useMemo(() => partitionLanUrls(urls), [urls]);
  const visibleUrls = showSecondary ? [...primaryUrls, ...secondaryUrls] : primaryUrls;

  useEffect(() => {
    if (!expanded || !qrTargetUrl || !urls.includes(qrTargetUrl)) {
      setQrTargetUrl(null);
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    generateLanQrDataUrl(qrTargetUrl)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, qrTargetUrl, urls]);

  if (!urls || urls.length === 0) return null;

  const formatDisplay = (u: string) =>
    showProtocol ? u : u.replace(/^https?:\/\//, '');

  const toggleQr = (u: string) => {
    setQrTargetUrl((prev) => (prev === u ? null : u));
  };

  const renderUrlChips = (list: string[]) => (
    <>
      {list.map((lanUrl) => {
        const isQrOpen = qrTargetUrl === lanUrl;
        return (
          <span key={lanUrl} className="lan-chip-group">
            <button
              type="button"
              className={chipClassName}
              onClick={() => onCopyUrl?.(lanUrl)}
              title={`${copyTitlePrefix}: ${lanUrl}`}
            >
              <Wifi size={10} />
              <span>{formatDisplay(lanUrl)}</span>
            </button>
            <button
              type="button"
              className={`project-url-chip is-lan is-qr-btn ${isQrOpen ? 'is-expanded' : ''}`}
              onClick={() => toggleQr(lanUrl)}
              title={isQrOpen ? qrHideTitle : `${qrShowTitle}: ${lanUrl}`}
              aria-label={isQrOpen ? qrHideTitle : qrShowTitle}
              aria-expanded={isQrOpen}
            >
              <QrCode size={11} />
            </button>
          </span>
        );
      })}
      {secondaryUrls.length > 0 && (
        <button
          type="button"
          className="project-url-chip is-lan is-virtual-toggle"
          onClick={() => setShowSecondary((prev) => !prev)}
          aria-expanded={showSecondary}
        >
          <span>
            {showSecondary
              ? hideOtherLabel
              : showOtherTemplate.replace('{count}', String(secondaryUrls.length))}
          </span>
        </button>
      )}
    </>
  );

  const renderQrPopover = () => {
    if (!expanded || !qrTargetUrl) return null;
    return (
      <div className="lan-qr-card" role="region" aria-label="LAN QR Code">
        <div className="lan-qr-frame">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR code for ${qrTargetUrl}`} className="lan-qr-img" />
          ) : (
            <div className="lan-qr-loading">…</div>
          )}
        </div>
        <div className="lan-qr-meta">
          <div className="lan-qr-url-row">
            <button
              type="button"
              className="lan-qr-url-btn"
              onClick={() => onCopyUrl?.(qrTargetUrl)}
              title={`${copyTitlePrefix}: ${qrTargetUrl}`}
            >
              <Copy size={11} />
              <span>{qrTargetUrl}</span>
            </button>
            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => setQrTargetUrl(null)}
              title={qrHideTitle}
              aria-label={qrHideTitle}
            >
              <X size={12} />
            </button>
          </div>
          {qrScanHint && <div className="lan-qr-hint">{qrScanHint}</div>}
        </div>
      </div>
    );
  };

  if (variant === 'block') {
    return (
      <div className="project-lan-collapsible">
        <div className="sidebar-project-lan-row">
          <button
            type="button"
            className={`${toggleClassName} ${expanded ? 'is-expanded' : ''}`}
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? hideTitle : showTitle}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <Wifi size={10} />
            <span>
              {label} ({primaryUrls.length})
            </span>
          </button>
          {expanded && renderUrlChips(visibleUrls)}
        </div>
        {renderQrPopover()}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${toggleClassName} ${expanded ? 'is-expanded' : ''}`}
        onClick={() => setExpanded((prev) => !prev)}
        title={expanded ? hideTitle : showTitle}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Wifi size={10} />
        <span>
          {label} ({primaryUrls.length})
        </span>
      </button>
      {expanded && renderUrlChips(visibleUrls)}
      {renderQrPopover()}
    </>
  );
};
