import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const es: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.4',
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

**Onigiri Editor** reúne en un solo espacio multiplataforma **edición Markdown visual bidireccional**, **Chat IA y acciones personalizadas en la barra**, **PKM y Grafo de conocimiento**, **control de código Git**, **edición de código en más de 100 lenguajes** y **detección automática de servidor de desarrollo con navegador web integrado**.

> [!TIP]
> - **Cambia de modo en cualquier momento (\`⌘ + \\\` / \`Ctrl + \\\`)**: Alterna entre **Simple** (escritura sin distracciones con barra de formato), **Básico** (vista previa dividida bidireccional e IA) y **Avanzado** (múltiples pestañas, explorador de archivos, Git y terminal integrada).
> - **Guía de funciones (\`?\`)**: Haz clic en **\`?\`** en la barra superior o abre la **Paleta de comandos (\`⌘ + K\` / \`Ctrl + K\`)** para buscar cualquier función en inglés o japonés y ejecutarla al instante.
> - **Apertura rápida (\`⌘ + P\` / \`Ctrl + P\`)**: Salta a archivos del espacio de trabajo o escribe \`@\` para ir a cualquier encabezado.
> - **Ajustes (\`⌘ + ,\` / \`Ctrl + ,\`)**: Personaliza más de 112 atajos, botones personalizados de IA, instantáneas y copias de seguridad JSON.

---

## Aspectos destacados

### ✍️ 1. Escritura, edición visual y vista previa
- [x] **Edición bidireccional y resaltado sincronizado en tiempo real**: Edita en CodeMirror 6 (izquierda) o en la vista previa visual TipTap (derecha). Incluye **resaltado de línea actual** y **sincronización carácter a carácter de la selección** en la vista previa (configurable en **Ajustes → Editor**)
- [x] **Asistentes completos de escritura**:
  - **Menú flotante de selección** sobre el texto seleccionado (Negrita, Cursiva, Código, Enlace, Edición IA en línea, botones rápidos de IA)
  - **Barra GUI automática para tablas Markdown** al situar el cursor dentro de una tabla (añadir/eliminar filas y columnas, alinear, ordenar números, formatear)
  - **Controles interactivos de imagen en vista previa**: alinear a la izquierda/derecha con ajuste de texto, cambiar ancho (200 / 280 / 380px), editar texto Alt o eliminar directamente
  - **Comandos \`/\` al inicio de línea**, **Fragmentos personalizados**, **Índice automático (TOC)** y **vista previa de salto de línea simple (\`<br>\`)**
  - **Citas / Tarjetas de enlace (con miniaturas opcionales) / Búsqueda BibTeX y DOI / Notas al pie**, **pegado con título automático de URL**, **Notas diarias y plantillas**, **Web Clipper** y **Modo presentación**
- [x] **Utilidades avanzadas de código y texto (incluyendo menú contextual)**:
  - **Multicursor (\`⌘ + D\` / \`Option + Clic\`)**, **Selección en bloque (\`Option + Arrastrar\` / \`Alt + Arrastrar\`)**, **Marcadores de línea (\`⌘ + F2\` / \`F2\`)**, **Ir a línea (\`⌘ + L\`)**
  - **Buscar y reemplazar con Regex** (con ámbito en selección y despliegue automático de plegados), **Plegado de código**, **Espacios / espacios ideográficos / fin de línea visibles**, **Regla de columna**, **Modo enfoque** y **Desplazamiento máquina de escribir**
  - **Transformaciones con clic derecho y herramientas de datos**: Mayúsculas/Minúsculas/Título, recortar espacios iniciales, añadir citas, **Formatear / Minificar / Ordenar claves JSON**, **JSON ⇔ YAML**, **Formateador \`.env\`**, **Copiar como texto enriquecido**
  - **Control de codificación y saltos de línea**: Abrir/crear en UTF-8 / Shift_JIS / EUC-JP, cambio LF/CRLF, contadores en vivo de caracteres, palabras y tiempo de lectura

### 🤖 2. AI Harness, multimodelo y protección de privacidad
- [x] **AI Harness unificado (\`⌘ + ⇧ + E\` para edición en línea de la selección)**:
  - Orquesta **Apple Foundation Models (en el dispositivo, macOS 26+)**, **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **APIs de OpenAI / Anthropic / Gemini**, **Ollama** y **LM Studio** desde un único espacio con progreso en vivo, cancelación y diagnóstico de errores
- [x] **Limpieza de salida IA (botón \`Limpiar IA\`)**:
  - Limpieza basada en reglas con un clic para texto pegado de IA: alinea **anchos de columna en tablas GFM**, normaliza viñetas y espacios en encabezados, elimina caracteres de ancho cero/NBSP y normaliza comillas tipográficas preservando bloques de código. También **convierte HTML pegado a Markdown**
- [x] **Botones personalizados de IA y submenús en la barra**:
  - Registra hasta 5 botones principales + 10 elementos de submenú cada uno, con **selección de modelo independiente por botón/elemento (CLI de suscripción / API en la nube / IA local)** y variables de prompt (\`{{selection}}\`, \`{{clipboard}}\`, \`{{date}}\`, etc.), incluyendo el preset **Traducir con IA**
- [x] **Chat IA (con menciones \`@archivo\`), Autocompletado fantasma (\`Tab\` para aceptar, indicador de carga) y Corrección**:
  - Protegido con ejecución en sandbox de solo lectura, **Vista previa de envío y ocultación automática de secretos** (enmascara API keys/tokens) y **Diff línea por línea** antes de aplicar cambios

### 🛡️ 3. Copias de seguridad, gestión de recursos y compatibilidad
- [x] **Instantáneas automáticas y bloc rápido**:
  - **Línea temporal de instantáneas automáticas y restauración parcial por fragmentos** (al guardar y periódicamente)
  - **Bloc rápido (Scratchpad)** (notas sin necesidad de guardar) con **Atajo global (\`⌘ + ⇧ + Space\`)**
  - **Restauración de sesión** entre reinicios y detección de cambios externos
- [x] **Optimización de imágenes y diagnóstico de dialectos**:
  - Redimensiona y comprime automáticamente imágenes pegadas/arrastradas en \`assets/\`, **Inventario de tamaños de todas las imágenes** y **Limpiador de imágenes sin uso**
  - **Comprobación de compatibilidad Markdown** (diagnostica diferencias para GitHub / Zenn / Qiita / Notion / Obsidian)

### 🕸️ 4. Grafo de conocimiento, Git, herramientas dev y exportación
- [x] **PKM y Grafo de conocimiento**:
  - \`[[WikiLinks]]\`, enlaces inversos, explorador de \`#etiquetas\` y **Grafo de conocimiento interactivo con diagnóstico de enlaces rotos**
- [x] **Control de código Git y espacio de desarrollo (Modo Avanzado)**:
  - **Panel lateral Git** (stage/unstage/discard, diff en línea, **Mensaje de commit con IA**, Pull/Push) y **Comparar con Git HEAD**
  - **Múltiples pestañas y comparación lado a lado**, **Búsqueda y reemplazo Regex en carpetas (\`⌘ + ⇧ + G\`)**
  - **Terminal integrada**, **Lanzador multiservidor dev (compartir por QR / LAN y diagnóstico de logs con IA)** y **Navegador web integrado** (cierre \`✕\` en 1 clic)
  - **Vista previa de tablas CSV / TSV (scroll virtual para archivos de varios MB y sincronización bidireccional)**: Desplazamiento fluido en CSV grandes, columna de línea fija, columnas numéricas alineadas a la derecha con estadísticas (\`Σ / Prom / Mín / Máx\`), selector de delimitador (Auto / , / Tab / ;), ajuste de línea, **resaltado bidireccional editor ⇔ celda/subcadena**, copia de celda con doble clic (configurable en Ajustes) y copia como tabla Markdown
- [x] **Exportación y personalización**:
  - **Word (\`.docx\`)**, **PDF / HTML (configuración de página, temas de diseño y encabezados/pies)**, **exportación SVG/PNG y zoom para Mermaid y KaTeX**
  - **Macros de teclado (\`⌘ + ⇧ + M\` / \`F8\`)**, **4 temas (Claro / Oscuro / Sepia / Medianoche) + CSS personalizado** e **interfaz en 8 idiomas**

---

### 1. Prueba aquí las funciones interactivas

1. **Prueba la sincronización de selección y el menú flotante**: Selecciona cualquier frase de la cita inferior en el **lado del editor**; aparecerá el menú flotante y el texto equivalente se resaltará en la vista previa.
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **Prueba la barra GUI de tablas Markdown**: Haz clic en cualquier celda de la tabla inferior para mostrar la barra de edición sobre el editor.

| Modo | Ideal para | Diseño y capacidades |
| :--- | :--- | :--- |
| **Simple** | Notas rápidas y edición ágil | Editor limpio de un panel con barra superior oculta y barra de formato visible |
| **Básico** | Escritura diaria y edición visual | Editor + vista previa bidireccional + barra de formato + Chat IA |
| **Avanzado** | Flujos dev, PKM y Git | Múltiples pestañas y diff paralelo, Grafo Wiki, panel Git, servidor dev y terminal |

---

### 2. Resumen del flujo de trabajo (Mermaid)

> [!NOTE]
> Los avisos estilo GitHub (\`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, \`[!CAUTION]\`), diagramas Mermaid y bloques KaTeX pueden exportarse directamente a **SVG o PNG** desde la vista previa.

\`\`\`mermaid
flowchart LR
  Write["✍️ Escribir / Slash / Optimizar imágenes"] --> Knowledge["🕸️ WikiLinks y Grafo"]
  Knowledge --> AI["🤖 IA Personalizada / Fantasma / Revisión"]
  AI --> Check["🛡️ Compatibilidad e Instantáneas"]
  Check --> Git["🌿 Panel Git y Diff en línea"]
  Git --> Export["📦 Word / HTML / PDF / Diapositivas"]
\`\`\`

---

### 3. Atajos útiles (112+ comandos personalizables en Ajustes → Atajos)

| Acción | macOS | Windows / Linux |
| :--- | :--- | :--- |
| Cambiar modo (Simple / Básico / Avanzado) | \`⌘ + \\\` | \`Ctrl + \\\` |
| Apertura rápida (Archivos / \`@Encabezados\`) | \`⌘ + P\` | \`Ctrl + P\` |
| Paleta de comandos | \`⌘ + K\` | \`Ctrl + K\` |
| Grep y reemplazo en carpetas | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| Edición IA en línea de la selección | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| Alternar / Ir a marcador de línea | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| Grabar / Reproducir macro de teclado | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| Modo Zen / Selección en bloque | \`⌘ + ⇧ + F\` / \`Option + Arrastrar\` | \`Ctrl + Shift + F\` / \`Alt + Arrastrar\` |
| Atajo global (activar en Ajustes) | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. Fórmulas LaTeX y resaltado de sintaxis multilenguaje

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
