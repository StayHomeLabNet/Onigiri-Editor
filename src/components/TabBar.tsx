import React from 'react';
import { Plus, X, FileText } from 'lucide-react';
import type { DocumentTab } from '../types';

interface TabBarProps {
  tabs: DocumentTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="tabbar">
      <div className="tabbar-scroll">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`tab-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              title={tab.filePath || tab.title}
            >
              <FileText size={13} className="tab-icon" />
              <span className="tab-title">{tab.title}</span>
              {tab.dirty && <span className="tab-dirty-dot" />}
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  aria-label="Close tab"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="tab-add-btn" onClick={onNewTab} title="New Tab">
        <Plus size={14} />
      </button>
    </div>
  );
};
