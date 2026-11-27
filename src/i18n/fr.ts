import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const fr: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v2.0.0',
  modes: {
    simple: 'Simple',
    basic: 'Standard',
    advanced: 'Avancé',
  },
  harness: {
    modeLabel: 'AI Harness',
    editorLabel: 'Éditeur',
    newThread: 'Nouveau fil',
    threadsHeading: 'Fils',
    permPlan: 'Plan (Lecture seule)',
    permApprove: 'Approuver les modifications',
    permAuto: 'Auto-édition',
    permFull: 'Accès complet',
    executePlanBtn: 'Exécuter ce plan',
    diffCardTitle: 'Fichiers modifiés',
    acceptChangesBtn: 'Conserver les modifications',
    revertTurnBtn: 'Annuler ce tour',
    openInEditorBtn: "Ouvrir dans l'éditeur",
    sendToHarnessBtn: 'Continuer dans AI Harness',
  },
  layouts: {
    editor: 'Éditeur',
    split: 'Divisé',
    preview: 'Aperçu',
  },
  themes: {
    light: 'Clair',
    dark: 'Sombre',
    sepia: 'Sépia',
    midnight: 'Minuit',
  },
  actions: {
    newFile: 'Nouveau',
    openFile: 'Ouvrir',
    openFolder: 'Ouvrir un dossier',
    save: 'Enregistrer',
    saveAs: 'Enregistrer sous',
    exportHtml: 'Exporter en HTML',
    exportPdf: 'Imprimer / Exporter en PDF',
    exportDocx: 'Exporter en Word (.docx)',
    exportOptions: 'Mise en page et export (PDF / HTML)...',
    commandPalette: 'Palette de commandes',
    quickOpen: 'Ouverture rapide',
    zenMode: 'Mode Zen',
    toggleFocusMode: 'Mode Focus',
    sidebar: 'Barre latérale',
    inspector: 'Options / Chat IA',
    settings: 'Paramètres',
    about: "À propos d'Onigiri Editor",
    language: 'Langue',
    theme: 'Thème',
    slidePresentation: 'Présentation en diapositives',
    openDailyNote: 'Note du jour',
    newFromTemplate: 'Modèles et Note du jour',
    webClipUrl: 'Capturer une page web en Markdown',
    workspaceGrep: 'Rechercher et remplacer dans le dossier',
    insertCitation: 'Insérer citation / Carte lien / Note de bas de page',
    knowledgeGraph: 'Graphe de connaissances',
    findUnusedAssets: 'Gestion et nettoyage des images',
    featureGuide: 'Guide des fonctions (?)',
    toggleTopBar: "Afficher/Masquer la barre d'en-tête",
    toggleFormatToolbar: 'Afficher/Masquer la barre de mise en forme',
    toggleEditorSplit: "Fractionner l'éditeur haut / bas",
    undo: 'Annuler',
    redo: 'Rétablir',
    selectAll: 'Tout sélectionner',
    copy: 'Copier',
    paste: 'Coller',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    resetZoom: 'Réinitialiser le zoom (100%)',
    copyRichText: 'Copier en texte enrichi',
    macroRecord: 'Enregistrer la macro',
    macroStop: "Arrêter l'enregistrement",
    macroPlay: 'Lire la macro',
  },
  tabMenu: {
    pin: "Épingler l'onglet",
    unpin: "Désépingler l'onglet",
    openSide: 'Ouvrir sur le côté',
    compareWithActive: "Comparer avec l'onglet actif",
    close: 'Fermer',
    closeOthers: 'Fermer les autres',
  },
  sidebar: {
    files: 'Fichiers',
    outline: 'Plan',
    knowledge: 'Connaissances',
    snippets: 'Extraits',
    git: 'Contrôle Git',
    noFolder: 'Aucun dossier ouvert',
    chooseFolder: 'Ouvrir un dossier de travail',
    closeFolder: 'Fermer le dossier',
    noHeadings: 'Aucun titre trouvé (# ~ ######)',
    filterFiles: 'Filtrer par nom ou extension...',
    newFilePrompt: 'Nom du nouveau fichier',
    newFolderPrompt: 'Nom du nouveau dossier',
    renamePrompt: 'Renommer',
    deleteConfirm: 'Supprimer « {name} » ?',
  },
  inspector: {
    chat: 'Chat IA',
    review: 'Relecture',
    ai: 'Nettoyage IA',
    stats: 'Statistiques',
    diff: 'Instantanés',
    settings: 'Réglages rapides',
    settingsLabels: {
      activeLineSyncHighlight: 'Surligner la ligne/le bloc actif dans le panneau opposé',
      previewSelectionSyncHighlight: "Surligner la sélection de l'éditeur dans l'aperçu",
      syncScroll: 'Défilement synchronisé (Éditeur ↔ Aperçu)',
      typewriterMode: 'Défilement machine à écrire',
      lineNumbers: 'Afficher les numéros de ligne',
      wordWrap: 'Retour à la ligne automatique',
      hideTopBarInSimpleMode: "Masquer la barre d'en-tête en mode Simple",
      showFormatToolbarInSimpleMode: 'Afficher la barre de mise en forme en mode Simple',
      builtinBrowserEnabled: 'Activer le navigateur web intégré dans le panneau droit',
    },
  },
  status: {
    draft: 'Brouillon',
    saved: 'Enregistré',
    words: 'mots',
    chars: 'car.',
    line: 'Ligne',
    col: 'Col',
    syncOn: 'Défilement sync ON',
    syncOff: 'Défilement sync OFF',
  },
  aiChat: {
    title: 'Chat IA',
    send: 'Envoyer',
    cancelBtn: 'Arrêter',
    clearChat: 'Effacer la discussion',
    inputPlaceholder: "Posez une question à l'IA ou demandez une modification...",
    running: 'En cours',
    offline: 'Hors ligne',
  },
  settingsModal: {
    title: 'Paramètres',
    tabGeneral: 'Général et Affichage',
    tabEditor: 'Éditeur et Aperçu',
    tabAiCustom: 'IA Personnalisée',
    tabKeybindings: 'Raccourcis clavier',
    tabIntegrations: 'Navigateur et Serveur',
    tabData: 'Données et Sauvegarde',
    localeLabel: "Langue de l'interface",
    themeLabel: 'Thème',
    aiCustom: {
      title: "Boutons IA personnalisés de la barre d'outils",
      desc: "Enregistrez jusqu'à 5 boutons IA personnalisés. Envoie la sélection si du texte est sélectionné, sinon tout le document.",
      addBtn: 'Ajouter un bouton',
      resetDefaultsBtn: 'Réinitialiser',
      aiModelOverrideLabel: 'Modèle IA utilisé (CLI / API / Local)',
      followAiChatOption: 'Suivre la sélection du Chat IA',
      providerGroupSubscription: 'CLI Abonnement',
      providerGroupApi: 'API Cloud',
      providerGroupLocal: 'IA Locale / Sur appareil',
      modelSelectLabel: 'Modèle',
      customModelOption: 'Saisir un modèle personnalisé...',
      refreshModelsBtn: 'Actualiser les modèles',
    },
  },
  browser: {
    modePreview: 'Aperçu',
    modeBrowser: 'Navigateur Web',
    closeBrowser: 'Fermer le navigateur web',
    back: 'Précédent',
    forward: 'Suivant',
    reload: 'Actualiser',
    home: 'Accueil',
    go: 'Aller',
    openExternal: 'Ouvrir dans le navigateur externe',
    openSettings: 'Paramètres du navigateur (URL accueil)',
  },
  updates: {
    checkBtn: 'Vérifier les mises à jour',
  },
  sampleDocument: `---
title: Bienvenue dans Onigiri Editor — Éditeur hybride à l'ère de l'IA
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# Bienvenue dans Onigiri Editor 🍙

**Onigiri Editor** réunit dans un espace multiplateforme **l'édition Markdown visuelle bidirectionnelle**, **le Chat IA et des actions personnalisées**, **le PKM et graphe de connaissances**, **le contrôle de version Git**, **l'édition de code dans plus de 100 langages** et **un navigateur web intégré avec détection de serveur de développement**.

> [!TIP]
> - **Changer de mode à tout moment (\`⌘ + \\\` / \`Ctrl + \\\`)** : Basculez entre **Simple** (écriture épurée avec barre de formatage), **Standard** (aperçu divisé bidirectionnel et IA) et **Avancé** (multi-onglets, explorateur de fichiers, Git et terminal intégré).
> - **Guide des fonctions (\`?\`)** : Cliquez sur **\`?\`** dans la barre supérieure ou ouvrez la **Palette de commandes (\`⌘ + K\` / \`Ctrl + K\`)** pour rechercher une fonctionnalité en anglais ou en japonais et la lancer directement.
> - **Ouverture rapide (\`⌘ + P\` / \`Ctrl + P\`)** : Accédez aux fichiers du projet ou tapez \`@\` pour aller à un titre.
> - **Paramètres (\`⌘ + ,\` / \`Ctrl + ,\`)** : Personnalisez plus de 112 raccourcis, les boutons IA personnalisés, les instantanés et les sauvegardes JSON.

---

## Points forts

### ✍️ 1. Écriture, édition visuelle et aperçu
- [x] **Édition bidirectionnelle et surlignage synchronisé en temps réel** : Éditez dans CodeMirror 6 (à gauche) ou dans l'aperçu visuel TipTap (à droite). Inclut le **surlignage de la ligne du curseur** et la **synchronisation caractère par caractère de la sélection** (réglable dans **Paramètres → Éditeur**)
- [x] **Assistants d'écriture complets** :
  - **Menu contextuel flottant de sélection** au-dessus du texte sélectionné (Gras, Italique, Code, Lien, Édition IA en ligne, boutons IA rapides)
  - **Barre d'outils GUI automatique pour tableaux Markdown** lorsque le curseur est dans un tableau (ajouter/supprimer lignes et colonnes, aligner, tri numérique, formater)
  - **Contrôles d'image interactifs dans l'aperçu** : habillage gauche/droite, changement de largeur (200 / 280 / 380px), édition du texte Alt ou suppression directe
  - **Commandes Slash \`/\`** en début de ligne, **Extraits personnalisés**, **Sommaire automatique (TOC)** et **aperçu des sauts de ligne simples (\`<br>\`)**
  - **Citations / Cartes de liens (avec miniatures) / Recherche BibTeX & DOI / Notes de bas de page**, **collage avec titre automatique d'URL**, **Notes quotidiennes et modèles**, **Web Clipper** et **Mode Présentation**
- [x] **Utilitaires pro de code et de texte (y compris menu clic droit)** :
  - **Multicurseur (\`⌘ + D\` / \`Option + Clic\`)**, **Sélection rectangulaire (\`Option + Glisser\` / \`Alt + Glisser\`)**, **Signets de ligne (\`⌘ + F2\` / \`F2\`)**, **Aller à la ligne (\`⌘ + L\`)**
  - **Rechercher et remplacer par Regex** (avec portée sur la sélection et dépliage automatique), **Pliage de code**, **Affichage des espaces / espaces idéographiques / fins de ligne**, **Règle de colonne**, **Mode Focus** et **Défilement machine à écrire**
  - **Transformations par clic droit et outils de données** : Majuscules/Minuscules/Titre, suppression des espaces de début, ajout de citations, **Formater / Minifier / Trier les clés JSON**, **JSON ⇔ YAML**, **Formateur \`.env\`**, **Copier en texte enrichi**
  - **Gestion de l'encodage et des fins de ligne** : Ouvrir/créer en UTF-8 / Shift_JIS / EUC-JP, bascule LF/CRLF, compteurs en direct de caractères, mots et temps de lecture

### 🤖 2. AI Harness, multi-fournisseurs et confidentialité
- [x] **AI Harness unifié (\`⌘ + ⇧ + E\` pour l'édition en ligne de la sélection)** :
  - Orchestrez **Apple Foundation Models (sur l'appareil, macOS 26+)**, **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **API OpenAI / Anthropic / Gemini**, **Ollama** et **LM Studio** depuis un seul espace avec suivi de progression, annulation et diagnostic d'erreurs
- [x] **Nettoyage des sorties IA (bouton \`Nettoyer IA\`)** :
  - Nettoyage en un clic du texte collé depuis une IA : aligne les **largeurs de colonnes GFM**, normalise puces et espacement des titres, supprime les caractères de largeur nulle/NBSP et normalise les guillemets tout en préservant les blocs de code. Convertit aussi **le HTML collé en Markdown**
- [x] **Boutons IA personnalisés et sous-menus dans la barre** :
  - Enregistrez jusqu'à 5 boutons principaux + 10 sous-éléments chacun, avec **modèle dédié par bouton/élément (CLI d'abonnement / API Cloud / IA locale)** et variables de prompt (\`{{selection}}\`, \`{{clipboard}}\`, \`{{date}}\`, etc.), incluant le préréglage **Traduction IA**
- [x] **Chat IA (avec mentions \`@fichier\`), Saisie prédictive fantôme (\`Tab\` pour accepter, indicateur de chargement) et Relecture** :
  - Protégé par exécution en bac à sable en lecture seule, **Aperçu avant envoi et masquage des secrets** (masque clés API/tokens) et **Diff ligne par ligne** avant application

### 🛡️ 3. Sécurité, gestion des ressources et compatibilité
- [x] **Instantanés automatiques et bloc-notes rapide** :
  - **Chronologie d'instantanés automatiques et restauration partielle par blocs** (à l'enregistrement et périodiquement)
  - **Bloc-notes rapide (Scratchpad)** (notes sans enregistrement) avec **Raccourci global (\`⌘ + ⇧ + Space\`)**
  - **Restauration de session** au redémarrage et détection des modifications externes
- [x] **Optimisation d'images et diagnostic de dialecte** :
  - Redimensionne et compresse automatiquement les images collées/déposées dans \`assets/\`, **Inventaire des tailles d'images** et **Nettoyeur d'images inutilisées**
  - **Vérification de compatibilité Markdown** (diagnostique les différences pour GitHub / Zenn / Qiita / Notion / Obsidian)

### 🕸️ 4. Graphe de connaissances, Git, outils dev et export
- [x] **PKM et Graphe de connaissances** :
  - \`[[WikiLinks]]\`, rétroliens, explorateur de \`#tags\` et **Graphe interactif avec diagnostic des liens brisés**
- [x] **Contrôle Git et espace développeur (Mode Avancé)** :
  - **Onglet latéral Git** (stage/unstage/discard, diff en ligne, **Message de commit IA**, Pull/Push) et **Comparer avec Git HEAD**
  - **Multi-onglets et comparaison côte à côte**, **Recherche & remplacement Regex multi-dossiers (\`⌘ + ⇧ + G\`)**
  - **Terminal intégré**, **Lanceur multi-serveurs dev (partage QR / LAN et diagnostic de logs par IA)** et **Navigateur web intégré** (fermeture \`✕\` en 1 clic)
  - **Aperçu de tableaux CSV / TSV (défilement virtuel multi-Mo et surlignage bidirectionnel)** : Défilement fluide sur gros CSV, colonne de numéros figée, colonnes numériques alignées à droite avec statistiques (\`Σ / Moy / Min / Max\`), sélecteur de délimiteur (Auto / , / Tab / ;), retour à la ligne, **surlignage bidirectionnel éditeur ⇔ cellule/sous-chaîne**, copie de cellule par double-clic (activable dans Paramètres) et copie en tableau Markdown
- [x] **Export et personnalisation** :
  - **Word (\`.docx\`)**, **PDF / HTML (mise en page, thèmes et en-têtes/pieds de page)**, **export SVG/PNG et zoom pour Mermaid et KaTeX**
  - **Macros clavier (\`⌘ + ⇧ + M\` / \`F8\`)**, **4 thèmes (Clair / Sombre / Sépia / Minuit) + CSS personnalisé** et **interface en 8 langues**

---

### 1. Essayez les fonctions interactives ici

1. **Testez la synchronisation de sélection et le menu flottant** : Sélectionnez une expression dans la citation ci-dessous côté **éditeur** — le menu flottant apparaît au-dessus et le texte correspondant est surligné dans l'aperçu !
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **Testez la barre GUI des tableaux Markdown** : Cliquez dans n'importe quelle cellule du tableau ci-dessous pour afficher la barre d'édition au-dessus de l'éditeur.

| Mode | Idéal pour | Disposition et fonctionnalités |
| :--- | :--- | :--- |
| **Simple** | Notes rapides et édition agile | Éditeur épuré à un panneau, barre supérieure masquée et barre de formatage visible |
| **Standard** | Écriture quotidienne et édition visuelle | Éditeur + aperçu bidirectionnel + barre de formatage + Chat IA |
| **Avancé** | Workflows dev, PKM et Git | Multi-onglets et diff côte à côte, Graphe Wiki, panneau Git, serveur dev et terminal |

---

### 2. Aperçu du workflow (Mermaid)

> [!NOTE]
> Les encadrés GitHub (\`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, \`[!CAUTION]\`), diagrammes Mermaid et blocs KaTeX peuvent être exportés directement en **SVG ou PNG** depuis l'aperçu.

\`\`\`mermaid
flowchart LR
  Write["✍️ Écrire / Slash / Optimiser images"] --> Knowledge["🕸️ WikiLinks & Graphe"]
  Knowledge --> AI["🤖 IA Personnalisée / Fantôme / Relecture"]
  AI --> Check["🛡️ Compatibilité & Instantanés"]
  Check --> Git["🌿 Panneau Git & Diff en ligne"]
  Git --> Export["📦 Word / HTML / PDF / Diapos"]
\`\`\`

---

### 3. Raccourcis utiles (112+ commandes personnalisables dans Paramètres → Raccourcis)

| Action | macOS | Windows / Linux |
| :--- | :--- | :--- |
| Changer de mode (Simple / Standard / Avancé) | \`⌘ + \\\` | \`Ctrl + \\\` |
| Ouverture rapide (Fichiers / \`@Titres\`) | \`⌘ + P\` | \`Ctrl + P\` |
| Palette de commandes | \`⌘ + K\` | \`Ctrl + K\` |
| Grep et remplacement multi-dossiers | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| Édition IA en ligne sur la sélection | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| Basculer / Aller au signet de ligne | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| Enregistrer / Rejouer macro clavier | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| Mode Zen / Sélection rectangulaire | \`⌘ + ⇧ + F\` / \`Option + Glisser\` | \`Ctrl + Shift + F\` / \`Alt + Glisser\` |
| Raccourci global (à activer dans Paramètres) | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. Formules LaTeX et coloration syntaxique multilingue

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
