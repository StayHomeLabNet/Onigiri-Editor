import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const fr: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.1',
  modes: {
    simple: 'Simple',
    basic: 'Standard',
    advanced: 'Avancé',
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

**Onigiri Editor** réunit **l'édition Markdown visuelle bidirectionnelle**, **le Chat IA et des boutons personnalisés**, **le graphe de connaissances**, **Git**, **la coloration de plus de 100 langages** et **un navigateur web intégré avec détection de serveur de développement**.

> [!TIP]
> - **Changer de mode (\`⌘ + \\\` / \`Ctrl + \\\`)** : Basculez entre **Simple**, **Standard** et **Avancé**.
> - **Guide des fonctions (\`?\`)** : Cliquez sur **\`?\`** ou ouvrez la **Palette de commandes (\`⌘ + K\` / \`Ctrl + K\`)**.
> - **Ouverture rapide (\`⌘ + P\` / \`Ctrl + P\`)** : Accédez rapidement aux fichiers ou tapez \`@\` pour un titre.

## Points forts

- [x] **Édition bidirectionnelle et surlignage synchronisé** : Surligne en temps réel la ligne du curseur ainsi que **le texte exact sélectionné** dans l'aperçu.
- [x] **Boutons IA personnalisés par modèle** : Compatible Apple Foundation Models, Codex / Claude / Gemini / Antigravity CLI, API Cloud et Ollama / LM Studio.
- [x] **Sécurité et productivité** : Instantanés automatiques, vérification de compatibilité Markdown, optimisation d'images, panneau Git et export Word/HTML/PDF.

\`\`\`mermaid
flowchart LR
  Write["✍️ Écrire / Slash / Images"] --> Knowledge["🕸️ WikiLinks & Graphe"]
  Knowledge --> AI["🤖 IA Personnalisée & Relecture"]
  AI --> Git["🌿 Git & Instantanés"]
  Git --> Export["📦 Word / HTML / PDF / Diapos"]
\`\`\`
`,
};
