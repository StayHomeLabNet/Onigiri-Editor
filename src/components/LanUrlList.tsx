import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface LanUrlListProps {
  urls: string[];
  label: string;
  showTitle: string;
  hideTitle: string;
  copyTitlePrefix: string;
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
  onCopyUrl,
  variant = 'inline',
  showProtocol = false,
  chipClassName = 'project-url-chip is-lan',
  toggleClassName = 'project-url-chip is-lan is-lan-toggle',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!urls || urls.length === 0) return null;

  const toggleBtn = (
    <button
      type="button"
      className={`${toggleClassName}${expanded ? ' is-expanded' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
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
    ? urls.map((lanUrl) => (
        <button
          key={lanUrl}
          type="button"
          className={chipClassName}
          onClick={() => onCopyUrl?.(lanUrl)}
          title={`${copyTitlePrefix}: ${lanUrl}`}
        >
          <Copy size={10} />
          <span>{showProtocol ? lanUrl : `LAN: ${lanUrl.replace(/^https?:\/\//, '')}`}</span>
        </button>
      ))
    : null;

  if (variant === 'block') {
    return (
      <div className="project-lan-collapsible">
        <div className="sidebar-project-lan-row">{toggleBtn}</div>
        {expanded && <div className="sidebar-project-lan-row">{chips}</div>}
      </div>
    );
  }

  return (
    <>
      {toggleBtn}
      {chips}
    </>
  );
};
