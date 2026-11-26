import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const de: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.5',
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

**Onigiri Editor** vereint in einem plattformübergreifenden Arbeitsbereich **bidirektionale visuelle Markdown-Bearbeitung**, **KI-Chat & benutzerdefinierte Aktionen**, **PKM & Wissensgraph**, **Git-Versionsverwaltung**, **Code-Bearbeitung in über 100 Sprachen** sowie **automatische Dev-Server-Erkennung mit integriertem Webbrowser**.

> [!TIP]
> - **Modus jederzeit wechseln (\`⌘ + \\\` / \`Ctrl + \\\`)**: Wechseln Sie zwischen **Einfach** (fokussiertes Schreiben mit Formatleiste), **Standard** (bidirektionale Live-Vorschau & KI) und **Erweitert** (Multi-Tab, Datei-Explorer, Git und integriertes Terminal).
> - **Funktionsführer (\`?\`)**: Klicken Sie auf **\`?\`** in der oberen Leiste oder öffnen Sie die **Befehlspalette (\`⌘ + K\` / \`Ctrl + K\`)**, um Funktionen auf Englisch oder Japanisch zu suchen und direkt zu starten.
> - **Schnell öffnen (\`⌘ + P\` / \`Ctrl + P\`)**: Springen Sie zu Dateien oder tippen Sie \`@\`, um direkt zu einer Überschrift zu wechseln.
> - **Einstellungen (\`⌘ + ,\` / \`Ctrl + ,\`)**: Passen Sie über 112 Tastenkürzel, KI-Schaltflächen, Snapshots und JSON-Einstellungs-Backups an.

---

## Highlights

### ✍️ 1. Schreiben, visuelle Bearbeitung & Vorschau
- [x] **Bidirektionale Live-Bearbeitung & Echtzeit-Sync-Markierung**: Bearbeiten Sie in CodeMirror 6 (links) oder in der visuellen TipTap-Vorschau (rechts). Sowohl **aktuelle Cursor-Zeile** als auch **zeichenweise Auswahl-Synchronisation** werden in der Vorschau hervorgehoben (umschaltbar unter **Einstellungen → Editor**)
- [x] **Umfangreiche Schreibassistenten**:
  - Schwebendes **Auswahl-Bubble-Menü** über markiertem Text (Fett, Kursiv, Code, Link, Inline-KI-Bearbeitung, KI-Schnellaktionen)
  - Automatische **Markdown-Tabellen-GUI-Leiste** innerhalb von Tabellen (Zeilen/Spalten hinzufügen & löschen, ausrichten, numerisch sortieren, formatieren)
  - **Interaktive Bildsteuerung in der Vorschau**: links/rechts umfließend ausrichten, Breite umschalten (200 / 280 / 380px), Alt-Text bearbeiten oder direkt löschen
  - **Slash-Befehle \`/\`** am Zeilenanfang, **Eigene Snippets**, **Automatisches Inhaltsverzeichnis (TOC)** und **Einzelzeilenumbruch-Vorschau (\`<br>\`)**
  - **Zitate / Link-Karten (mit optionalen Vorschaubildern) / BibTeX & DOI-Abfrage / Fußnoten**, **URL-Auto-Titel beim Einfügen**, **Tagesnotizen & Vorlagen**, **Web Clipper** und **Präsentationsmodus**
- [x] **Profi-Code- & Textwerkzeuge (inkl. Kontextmenü)**:
  - **Multi-Cursor (\`⌘ + D\` / \`Option + Klick\`)**, **Rechteckauswahl (\`Option + Ziehen\` / \`Alt + Ziehen\`)**, **Zeilen-Lesezeichen (\`⌘ + F2\` / \`F2\`)**, **Gehe zu Zeile (\`⌘ + L\`)**
  - **Suchen & Regex-Ersetzen** (mit Auswahlbereich und automatischem Aufklappen), **Code-Faltung**, **Leerzeichen / Vollbreite-Leerzeichen / Zeilenenden anzeigen**, **Spaltenlineal**, **Fokusmodus** und **Schreibmaschinen-Scroll**
  - **Rechtsklick-Transformationen & Datenwerkzeuge**: Groß-/Kleinschreibung/Titelformat, führende Leerzeichen entfernen, Zitatzeichen einfügen, **JSON Formatieren / Minifizieren / Schlüssel sortieren**, **JSON ⇔ YAML**, **\`.env\`-Formatierer**, **Als Rich-Text kopieren**
  - **Kodierung & Zeilenenden**: Neu/Erneut öffnen mit UTF-8 / Shift_JIS / EUC-JP, LF/CRLF-Umschaltung, Live-Zähler für Zeichen, Wörter und Lesezeit

### 🤖 2. KI-Harness, Multi-Provider-Routing & Datenschutz
- [x] **Einheitlicher KI-Harness (\`⌘ + ⇧ + E\` für Inline-Bearbeitung der Auswahl)**:
  - Orchestrieren Sie **Apple Foundation Models (lokal auf dem Gerät, macOS 26+)**, **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **OpenAI / Anthropic / Gemini APIs**, **Ollama** und **LM Studio** aus einem Arbeitsbereich mit Live-Fortschritt, Abbruch und Fehlerdiagnose
- [x] **KI-Ausgabe bereinigen (Schaltfläche \`KI bereinigen\`)**:
  - Regelbasierte Ein-Klick-Bereinigung eingefügter KI-Texte: richtet **GFM-Tabellenspalten** aus, vereinheitlicht Aufzählungen und Überschriftenabstände, entfernt Nullbreiten-Zeichen/NBSP und normalisiert Anführungszeichen unter Beibehaltung von Codeblöcken. Wandelt auch **eingefügtes HTML automatisch in Markdown** um
- [x] **KI-Schaltflächen & Untermenüs in der Symbolleiste**:
  - Bis zu 5 Hauptschaltflächen + je 10 Untermenüpunkte mit **eigener Modellwahl pro Schaltfläche/Eintrag (Abo-CLI / Cloud-API / Lokale KI)** und Prompt-Variablen (\`{{selection}}\`, \`{{clipboard}}\`, \`{{date}}\` usw.), inklusive **KI-Übersetzen**-Preset
- [x] **KI-Chat (mit \`@Datei\`-Erwähnungen), KI-Ghost-Text-Autovervollständigung (\`Tab\`, mit Ladeanzeige) & Korrekturlesen**:
  - Geschützt durch schreibgeschützte Sandbox-Ausführung, **Sendeinhalt-Vorschau & Geheimnis-Maskierung** (verbirgt API-Keys/Tokens) sowie **zeilenweise Diff-Vorschau** vor dem Übernehmen

### 🛡️ 3. Sicherheit, Asset-Verwaltung & Kompatibilität
- [x] **Automatische Snapshots & Schnellnotizblock**:
  - **Automatische Snapshot-Zeitleiste & partielle Block-Wiederherstellung** (beim Speichern und periodisch)
  - **Schnellnotizblock (Scratchpad)** (ohne Speichern) mit **globalem Aufruf-Kürzel (\`⌘ + ⇧ + Space\`)**
  - **Sitzungswiederherstellung** nach Neustart & Erkennung externer Dateiänderungen
- [x] **Bildoptimierung & Dialekt-Diagnose**:
  - Automatische Skalierung & Komprimierung eingefügter/abgelegter Bilder nach \`assets/\`, **Größenübersicht aller Bilder** und **Bereinigung ungenutzter Bilder**
  - **Markdown-Kompatibilitätsprüfung** (erkennt Dialektunterschiede für GitHub / Zenn / Qiita / Notion / Obsidian)

### 🕸️ 4. Wissensgraph, Git, Dev-Tools & Export
- [x] **PKM & Wissensgraph**:
  - \`[[WikiLinks]]\`, Backlinks, \`#Tag\`-Browser und **interaktiver Wissensgraph mit Prüfung auf defekte Links**
- [x] **Git-Versionsverwaltung & Dev-Arbeitsbereich (Erweitert)**:
  - **Git-Seitenleiste** (Stage/Unstage/Discard, Inline-Diff, **KI-Commit-Nachricht**, Pull/Push) & **Mit Git HEAD vergleichen**
  - **Multi-Tab & Side-by-Side-Vergleich**, **Ordnerübergreifendes Regex-Grep-Ersetzen (\`⌘ + ⇧ + G\`)**
  - **Integriertes Terminal**, **Multi-Server-Dev-Launcher (QR-/LAN-Freigabe & KI-Log-Diagnose)** und **Integrierter Webbrowser** (1-Klick-\`✕\`-Schließen)
  - **CSV / TSV-Tabellenvorschau (virtuelles Scrollen für Multi-MB-Dateien & bidirektionale Synchronisation)**: Flüssiges Scrollen bei großen CSVs, fixierte Zeilennummernspalte, rechtsbündige Zahlenspalten mit Statistik (\`Σ / Ø / Min / Max\`), Trennzeichen-Umschalter (Auto / , / Tab / ;), Zeilenumbruch, **bidirektionale Markierung Editor ⇔ Zelle/Teilstring**, Zellenkopie per Doppelklick (in Einstellungen umschaltbar) und Kopieren als Markdown-Tabelle
- [x] **Export & Anpassung**:
  - **Word (\`.docx\`)**, **PDF / HTML (Seiteneinrichtung, Design-Themes & Kopf-/Fußzeilen)**, **SVG/PNG-Export & Zoom für Mermaid und KaTeX**
  - **Tastaturmakros (\`⌘ + ⇧ + M\` / \`F8\`)**, **4 Themes (Hell / Dunkel / Sepia / Mitternacht) + eigenes CSS** und **8-sprachige Oberfläche**

---

### 1. Interaktive Funktionen direkt hier testen

1. **Inline-Auswahl-Sync & Bubble-Menü testen**: Markieren Sie im **Editor links** einen beliebigen Teil des Zitats unten — das schwebende Bubble-Menü erscheint und der Text wird in der Vorschau hervorgehoben!
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **Markdown-Tabellen-GUI-Leiste testen**: Klicken Sie in eine beliebige Zelle der Tabelle unten, um die Bearbeitungsleiste über dem Editor einzublenden.

| Modus | Ideal für | Layout & Funktionen |
| :--- | :--- | :--- |
| **Einfach** | Schnelle Notizen & Fokus | Schlichter Einzel-Editor mit ausgeblendeter Kopfzeile & sichtbarer Formatleiste |
| **Standard** | Tägliches Schreiben & Visual-Edit | Editor + bidirektionale Live-Vorschau + Formatleiste + KI-Chat |
| **Erweitert** | Dev-Workflows, PKM & Git | Multi-Tab & Split-Diff, Wiki-Graph, Git-Panel, Dev-Server & Terminal |

---

### 2. Workflow-Übersicht (Mermaid)

> [!NOTE]
> GitHub-Hinweise (\`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, \`[!CAUTION]\`), Mermaid-Diagramme und KaTeX-Blöcke lassen sich direkt aus der Vorschau als **SVG oder PNG** exportieren.

\`\`\`mermaid
flowchart LR
  Write["✍️ Schreiben / Slash / Bilder optimieren"] --> Knowledge["🕸️ WikiLinks & Wissensgraph"]
  Knowledge --> AI["🤖 KI-Aktionen / Ghost-Text / Korrektur"]
  AI --> Check["🛡️ Kompatibilität & Snapshots"]
  Check --> Git["🌿 Git-Panel & Inline-Diff"]
  Git --> Export["📦 Word / HTML / PDF / Folien"]
\`\`\`

---

### 3. Praktische Tastenkürzel (112+ Befehle anpassbar unter Einstellungen → Tastenkürzel)

| Aktion | macOS | Windows / Linux |
| :--- | :--- | :--- |
| Modus wechseln (Einfach / Standard / Erweitert) | \`⌘ + \\\` | \`Ctrl + \\\` |
| Schnell öffnen (Dateien / \`@Überschriften\`) | \`⌘ + P\` | \`Ctrl + P\` |
| Befehlspalette | \`⌘ + K\` | \`Ctrl + K\` |
| Ordnerübergreifendes Grep & Ersetzen | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| Inline-KI-Bearbeitung der Auswahl | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| Zeilen-Lesezeichen umschalten / anspringen | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| Tastaturmakro aufnehmen / abspielen | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| Zen-Modus / Rechteckauswahl | \`⌘ + ⇧ + F\` / \`Option + Ziehen\` | \`Ctrl + Shift + F\` / \`Alt + Ziehen\` |
| Globales Aufruf-Kürzel (in Einstellungen aktivieren) | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. LaTeX-Mathematik & mehrsprachiges Syntax-Highlighting

Scaled Dot-Product Attention:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

\`\`\`typescript
export function greetOnigiri(name: string): string {
  return \`Hello, \${name} 🍙\`;
}
console.log(greetOnigiri('Onigiri Editor'));
\`\`\`
`,
};
