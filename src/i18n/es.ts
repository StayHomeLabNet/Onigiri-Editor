import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const es: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.0',
  modes: {
    simple: 'Simple',
    basic: 'Básico',
    advanced: 'Avanzado',
  },
  layouts: {
    editor: 'Editor',
    split: 'Dividir',
    preview: 'Vista previa',
  },
  themes: {
    light: 'Claro',
    dark: 'Oscuro',
    sepia: 'Sepia',
    midnight: 'Medianoche',
  },
  actions: {
    newFile: 'Nuevo',
    openFile: 'Abrir',
    openFolder: 'Abrir carpeta',
    save: 'Guardar',
    saveAs: 'Guardar como',
    exportHtml: 'Exportar HTML',
    exportPdf: 'Imprimir / Exportar PDF',
    exportDocx: 'Exportar Word (.docx)',
    exportOptions: 'Configurar página y exportar (PDF / HTML)...',
    commandPalette: 'Paleta de comandos',
    quickOpen: 'Apertura rápida',
    zenMode: 'Modo Zen',
    toggleFocusMode: 'Modo Enfoque',
    sidebar: 'Barra lateral',
    inspector: 'Opciones / Chat IA',
    settings: 'Ajustes',
    about: 'Acerca de Onigiri Editor',
    language: 'Idioma',
    theme: 'Tema',
    slidePresentation: 'Presentación de diapositivas',
    openDailyNote: 'Nota diaria',
    newFromTemplate: 'Plantillas y Nota diaria',
    webClipUrl: 'Recortar página web a Markdown',
    workspaceGrep: 'Buscar y reemplazar en carpetas',
    insertCitation: 'Insertar cita / Tarjeta de enlace / Nota al pie',
    knowledgeGraph: 'Grafo de conocimiento',
    findUnusedAssets: 'Gestión y limpieza de imágenes',
    featureGuide: 'Guía de funciones (?)',
    toggleTopBar: 'Mostrar/Ocultar barra superior',
    toggleFormatToolbar: 'Mostrar/Ocultar barra de formato',
    toggleEditorSplit: 'Dividir editor arriba / abajo',
    undo: 'Deshacer',
    redo: 'Rehacer',
    selectAll: 'Seleccionar todo',
    copy: 'Copiar',
    paste: 'Pegar',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    resetZoom: 'Restablecer zoom (100%)',
    copyRichText: 'Copiar como texto enriquecido',
    macroRecord: 'Grabar macro',
    macroStop: 'Detener grabación',
    macroPlay: 'Reproducir macro',
  },
  tabMenu: {
    pin: 'Fijar pestaña',
    unpin: 'Desfijar pestaña',
    openSide: 'Abrir al lado',
    compareWithActive: 'Comparar diferencias con la pestaña activa',
    close: 'Cerrar',
    closeOthers: 'Cerrar otras',
  },
  sidebar: {
    files: 'Archivos',
    outline: 'Esquema',
    knowledge: 'Conocimiento',
    snippets: 'Fragmentos',
    git: 'Control de código Git',
    noFolder: 'Ninguna carpeta abierta',
    chooseFolder: 'Abrir carpeta de trabajo',
    closeFolder: 'Cerrar carpeta',
    noHeadings: 'No se encontraron encabezados (# ~ ######)',
    filterFiles: 'Filtrar por nombre o extensión...',
    newFilePrompt: 'Nombre del nuevo archivo',
    newFolderPrompt: 'Nombre de la nueva carpeta',
    renamePrompt: 'Renombrar',
    deleteConfirm: '¿Eliminar "{name}"?',
  },
  inspector: {
    chat: 'Chat IA',
    review: 'Corrección',
    ai: 'Limpieza IA',
    stats: 'Estadísticas',
    diff: 'Instantáneas',
    settings: 'Ajustes rápidos',
    settingsLabels: {
      activeLineSyncHighlight: 'Resaltar línea/bloque activo en el panel opuesto',
      previewSelectionSyncHighlight: 'Resaltar la selección del editor en la vista previa',
      syncScroll: 'Desplazamiento sincronizado (Editor ↔ Vista previa)',
      typewriterMode: 'Desplazamiento máquina de escribir',
      lineNumbers: 'Mostrar números de línea',
      wordWrap: 'Ajuste de línea',
      hideTopBarInSimpleMode: 'Ocultar barra superior en modo Simple',
      showFormatToolbarInSimpleMode: 'Mostrar barra de formato en modo Simple',
      builtinBrowserEnabled: 'Habilitar navegador web integrado en el panel derecho',
    },
  },
  status: {
    draft: 'Borrador',
    saved: 'Guardado',
    words: 'palabras',
    chars: 'caracteres',
    line: 'Línea',
    col: 'Col',
    syncOn: 'Sync Scroll ON',
    syncOff: 'Sync Scroll OFF',
  },
  aiChat: {
    title: 'Chat IA',
    send: 'Enviar',
    cancelBtn: 'Detener',
    clearChat: 'Limpiar chat',
    inputPlaceholder: 'Pregunta a la IA o pide una edición sobre el documento actual...',
    running: 'Ejecutando',
    offline: 'Desconectado',
  },
  settingsModal: {
    title: 'Ajustes',
    tabGeneral: 'General y Vista',
    tabEditor: 'Editor y Vista previa',
    tabAiCustom: 'IA Personalizada',
    tabKeybindings: 'Atajos de teclado',
    tabIntegrations: 'Navegador y Servidor',
    tabData: 'Datos y Respaldo',
    localeLabel: 'Idioma de la interfaz',
    themeLabel: 'Tema',
    aiCustom: {
      title: 'Botones personalizados de IA',
      desc: 'Registra hasta 5 botones de IA en la barra de herramientas. Envía solo la selección si hay texto seleccionado, o el documento completo.',
      addBtn: 'Añadir botón',
      resetDefaultsBtn: 'Restablecer valores',
      aiModelOverrideLabel: 'Modelo de IA (Suscripción CLI / API / Local)',
      followAiChatOption: 'Seguir selección del Chat IA',
      providerGroupSubscription: 'CLI de Suscripción',
      providerGroupApi: 'API en la Nube',
      providerGroupLocal: 'IA Local / En el dispositivo',
      modelSelectLabel: 'Modelo',
      customModelOption: 'Introducir modelo personalizado...',
      refreshModelsBtn: 'Actualizar modelos',
    },
  },
  browser: {
    modePreview: 'Vista previa',
    modeBrowser: 'Navegador Web',
    closeBrowser: 'Cerrar navegador web',
    back: 'Atrás',
    forward: 'Adelante',
    reload: 'Recargar',
    home: 'Inicio',
    go: 'Ir',
    openExternal: 'Abrir en navegador externo',
    openSettings: 'Ajustes del navegador (URL de inicio)',
  },
  updates: {
    checkBtn: 'Buscar actualizaciones',
  },
  sampleDocument: `---
title: Bienvenido a Onigiri Editor — Editor híbrido para la era de la IA
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# Bienvenido a Onigiri Editor 🍙

**Onigiri Editor** combina **edición Markdown visual bidireccional**, **Chat IA y botones personalizados**, **Grafo de conocimiento**, **Control de código Git**, **resaltado de más de 100 lenguajes** y **servidor de desarrollo con navegador web integrado**.

> [!TIP]
> - **Cambia de modo (\`⌘ + \\\` / \`Ctrl + \\\`)**: Alterna entre **Simple**, **Básico** y **Avanzado**.
> - **Guía de funciones (\`?\`)**: Haz clic en **\`?\`** o abre la **Paleta de comandos (\`⌘ + K\` / \`Ctrl + K\`)**.
> - **Apertura rápida (\`⌘ + P\` / \`Ctrl + P\`)**: Salta a archivos o usa \`@\` para ir a un encabezado.

## Funciones principales

- [x] **Edición bidireccional y resaltado sincronizado**: Resalta tanto el bloque del cursor como el **texto exacto seleccionado** en la vista previa en tiempo real.
- [x] **Botones de IA personalizados por modelo**: Compatible con Apple Foundation Models, Codex / Claude / Gemini / Antigravity CLI, APIs en la nube y Ollama / LM Studio.
- [x] **Productividad y seguridad**: Instantáneas automáticas, comprobación de compatibilidad Markdown, optimización de imágenes, panel Git y exportación a Word/HTML/PDF.

\`\`\`mermaid
flowchart LR
  Write["✍️ Escribir / Comandos / Imágenes"] --> Knowledge["🕸️ WikiLinks y Grafo"]
  Knowledge --> AI["🤖 IA Personalizada y Revisión"]
  AI --> Git["🌿 Git e Instantáneas"]
  Git --> Export["📦 Word / HTML / PDF / Diapositivas"]
\`\`\`
`,
};
