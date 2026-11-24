import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const de: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.0',
  modes: {
    simple: 'Einfach',
    basic: 'Standard',
    advanced: 'Erweitert',
  },
  layouts: {
    editor: 'Editor',
    split: 'Geteilt',
    preview: 'Vorschau',
  },
  themes: {
    light: 'Hell',
    dark: 'Dunkel',
    sepia: 'Sepia',
    midnight: 'Mitternacht',
  },
  actions: {
    newFile: 'Neu',
    openFile: 'Öffnen',
    openFolder: 'Ordner öffnen',
    save: 'Speichern',
    saveAs: 'Speichern unter',
    exportHtml: 'Als HTML exportieren',
    exportPdf: 'Drucken / Als PDF exportieren',
    exportDocx: 'Als Word (.docx) exportieren',
    exportOptions: 'Seiteneinrichtung & Export (PDF / HTML)...',
    commandPalette: 'Befehlspalette',
    quickOpen: 'Schnell öffnen',
    zenMode: 'Zen-Modus',
    toggleFocusMode: 'Fokus-Modus',
    sidebar: 'Seitenleiste',
    inspector: 'Optionen / KI-Chat',
    settings: 'Einstellungen',
    about: 'Über Onigiri Editor',
    language: 'Sprache',
    theme: 'Design',
    slidePresentation: 'Folienpräsentation',
    openDailyNote: 'Tagesnotiz',
    newFromTemplate: 'Vorlagen & Tagesnotiz',
    webClipUrl: 'Webseite als Markdown speichern',
    workspaceGrep: 'Ordnerübergreifend suchen & ersetzen',
    insertCitation: 'Zitat / Link-Karte / Fußnote einfügen',
    knowledgeGraph: 'Wissensgraph',
    findUnusedAssets: 'Bildverwaltung & Bereinigung',
    featureGuide: 'Funktionsführer (?)',
    toggleTopBar: 'Kopfzeile ein-/ausblenden',
    toggleFormatToolbar: 'Formatierungsleiste ein-/ausblenden',
    toggleEditorSplit: 'Editor oben / unten teilen',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    selectAll: 'Alles auswählen',
    copy: 'Kopieren',
    paste: 'Einfügen',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    resetZoom: 'Zoom zurücksetzen (100%)',
    copyRichText: 'Als Rich-Text kopieren',
    macroRecord: 'Makro aufnehmen',
    macroStop: 'Aufnahme stoppen',
    macroPlay: 'Makro abspielen',
  },
  tabMenu: {
    pin: 'Tab anheften',
    unpin: 'Tab lösen',
    openSide: 'Seitlich öffnen',
    compareWithActive: 'Mit aktivem Tab vergleichen',
    close: 'Schließen',
    closeOthers: 'Andere schließen',
  },
  sidebar: {
    files: 'Dateien',
    outline: 'Gliederung',
    knowledge: 'Wissen',
    snippets: 'Snippets',
    git: 'Git-Quellcodeverwaltung',
    noFolder: 'Kein Ordner geöffnet',
    chooseFolder: 'Arbeitsordner öffnen',
    closeFolder: 'Ordner schließen',
    noHeadings: 'Keine Überschriften gefunden (# ~ ######)',
    filterFiles: 'Nach Dateiname oder Endung filtern...',
    newFilePrompt: 'Neuer Dateiname',
    newFolderPrompt: 'Neuer Ordnername',
    renamePrompt: 'Umbenennen',
    deleteConfirm: '„{name}“ wirklich löschen?',
  },
  inspector: {
    chat: 'KI-Chat',
    review: 'Korrektur',
    ai: 'KI-Bereinigung',
    stats: 'Statistik',
    diff: 'Snapshots',
    settings: 'Schnelleinstellungen',
    settingsLabels: {
      activeLineSyncHighlight: 'Aktive Zeile/Block im gegenüberliegenden Bereich hervorheben',
      previewSelectionSyncHighlight: 'Ausgewählten Text des Editors in der Vorschau markieren',
      syncScroll: 'Scrollen synchronisieren (Editor ↔ Vorschau)',
      typewriterMode: 'Schreibmaschinen-Scrollen',
      lineNumbers: 'Zeilennummern anzeigen',
      wordWrap: 'Zeilenumbruch',
      hideTopBarInSimpleMode: 'Kopfzeile im einfachen Modus ausblenden',
      showFormatToolbarInSimpleMode: 'Formatierungsleiste im einfachen Modus anzeigen',
      builtinBrowserEnabled: 'Integrierten Webbrowser im rechten Bereich aktivieren',
    },
  },
  status: {
    draft: 'Entwurf',
    saved: 'Gespeichert',
    words: 'Wörter',
    chars: 'Zeichen',
    line: 'Zeile',
    col: 'Sp.',
    syncOn: 'Sync Scroll EIN',
    syncOff: 'Sync Scroll AUS',
  },
  aiChat: {
    title: 'KI-Chat',
    send: 'Senden',
    cancelBtn: 'Stoppen',
    clearChat: 'Chat leeren',
    inputPlaceholder: 'Stellen Sie der KI eine Frage oder geben Sie eine Anweisung...',
    running: 'Läuft',
    offline: 'Offline',
  },
  settingsModal: {
    title: 'Einstellungen',
    tabGeneral: 'Allgemein & Ansicht',
    tabEditor: 'Editor & Vorschau',
    tabAiCustom: 'KI-Schaltflächen',
    tabKeybindings: 'Tastenkürzel',
    tabIntegrations: 'Browser & Server',
    tabData: 'Daten & Backup',
    localeLabel: 'Oberflächensprache',
    themeLabel: 'Design',
    aiCustom: {
      title: 'Benutzerdefinierte KI-Schaltflächen',
      desc: 'Registrieren Sie bis zu 5 KI-Schaltflächen in der Symbolleiste. Sendet nur die Auswahl oder das ganze Dokument.',
      addBtn: 'Schaltfläche hinzufügen',
      resetDefaultsBtn: 'Zurücksetzen',
      aiModelOverrideLabel: 'KI-Modell (Abo-CLI / API / Lokal)',
      followAiChatOption: 'KI-Chat-Auswahl folgen',
      providerGroupSubscription: 'Abo-CLI',
      providerGroupApi: 'Cloud-API',
      providerGroupLocal: 'Lokale KI / Auf dem Gerät',
      modelSelectLabel: 'Modell',
      customModelOption: 'Benutzerdefiniertes Modell eingeben...',
      refreshModelsBtn: 'Modelle aktualisieren',
    },
  },
  browser: {
    modePreview: 'Vorschau',
    modeBrowser: 'Webbrowser',
    closeBrowser: 'Webbrowser schließen',
    back: 'Zurück',
    forward: 'Vorwärts',
    reload: 'Neu laden',
    home: 'Startseite',
    go: 'Los',
    openExternal: 'Im externen Browser öffnen',
    openSettings: 'Browsereinstellungen (Start-URL)',
  },
  updates: {
    checkBtn: 'Nach Updates suchen',
  },
  sampleDocument: `---
title: Willkommen bei Onigiri Editor — Hybrider Editor für das KI-Zeitalter
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# Willkommen bei Onigiri Editor 🍙

**Onigiri Editor** vereint **bidirektionale visuelle Markdown-Bearbeitung**, **KI-Chat & benutzerdefinierte Aktionen**, **Wissensgraph**, **Git-Verwaltung**, **100+ Programmiersprachen** und einen **integrierten Webbrowser mit Dev-Server-Erkennung**.

> [!TIP]
> - **Modus wechseln (\`⌘ + \\\` / \`Ctrl + \\\`)**: Wechseln Sie jederzeit zwischen **Einfach**, **Standard** und **Erweitert**.
> - **Funktionsführer (\`?\`)**: Klicken Sie auf **\`?\`** oder öffnen Sie die **Befehlspalette (\`⌘ + K\` / \`Ctrl + K\`)**.
> - **Schnell öffnen (\`⌘ + P\` / \`Ctrl + P\`)**: Springen Sie zu Dateien oder mit \`@\` zu Überschriften.

## Highlights

- [x] **Bidirektionales Bearbeiten & Sync-Markierung**: Hebt sowohl die aktuelle Cursor-Zeile als auch **exakt markierten Text** in der Live-Vorschau hervor.
- [x] **KI-Schaltflächen mit eigener Modellwahl**: Unterstützt Apple Foundation Models, Codex / Claude / Gemini / Antigravity CLI, Cloud-APIs sowie Ollama / LM Studio.
- [x] **Sicherheit & Produktivität**: Automatische Snapshots, Markdown-Kompatibilitätsprüfung, Bildoptimierung, Git-Panel und Word/HTML/PDF-Export.

\`\`\`mermaid
flowchart LR
  Write["✍️ Schreiben / Slash / Bilder"] --> Knowledge["🕸️ WikiLinks & Wissensgraph"]
  Knowledge --> AI["🤖 KI-Aktionen & Korrektur"]
  AI --> Git["🌿 Git & Snapshots"]
  Git --> Export["📦 Word / HTML / PDF / Folien"]
\`\`\`
`,
};
