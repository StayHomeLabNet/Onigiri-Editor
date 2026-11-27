use tauri::{
    menu::{
        CheckMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    },
    AppHandle, Emitter, Runtime,
};

pub fn build_app_menu<R: Runtime>(
    app: &AppHandle<R>,
    locale: &str,
) -> tauri::Result<Menu<R>> {
    build_app_menu_with_state(app, locale, true, true, false, &[], &[])
}

pub fn build_app_menu_with_state<R: Runtime>(
    app: &AppHandle<R>,
    locale: &str,
    show_top_bar: bool,
    show_format_toolbar: bool,
    editor_split: bool,
    recent_files: &[String],
    recent_folders: &[String],
) -> tauri::Result<Menu<R>> {
    struct MenuLabels {
        about: &'static str,
        settings: &'static str,
        #[cfg(target_os = "macos")]
        services: &'static str,
        #[cfg(target_os = "macos")]
        hide: &'static str,
        #[cfg(target_os = "macos")]
        hide_others: &'static str,
        #[cfg(target_os = "macos")]
        show_all: &'static str,
        quit: &'static str,
        file: &'static str,
        new_file: &'static str,
        new_window: &'static str,
        new_encoding: &'static str,
        open: &'static str,
        quick_open: &'static str,
        reopen_encoding: &'static str,
        open_folder: &'static str,
        save: &'static str,
        save_as: &'static str,
        export_html: &'static str,
        export_pdf: &'static str,
        print_source: &'static str,
        open_recent: &'static str,
        recent_files_hdr: &'static str,
        recent_folders_hdr: &'static str,
        recent_empty: &'static str,
        clear_recent: &'static str,
        close_tab: &'static str,
        edit: &'static str,
        undo: &'static str,
        redo: &'static str,
        cut: &'static str,
        copy: &'static str,
        paste: &'static str,
        select_all: &'static str,
        find: &'static str,
        goto_line: &'static str,
        macro_toggle: &'static str,
        macro_play: &'static str,
        view: &'static str,
        mode_simple: &'static str,
        mode_basic: &'static str,
        mode_adv: &'static str,
        mode_harness: &'static str,
        top_bar: &'static str,
        format_toolbar: &'static str,
        editor_split: &'static str,
        palette: &'static str,
        options: &'static str,
        external_preview: &'static str,
        zen: &'static str,
        window: &'static str,
        minimize: &'static str,
        close_win: &'static str,
        help: &'static str,
        online_manual: &'static str,
        check_updates: &'static str,
    }

    let lbl = match locale {
        "ja" => MenuLabels {
            about: "Onigiri Editor について",
            settings: "設定…",
            #[cfg(target_os = "macos")]
            services: "サービス",
            #[cfg(target_os = "macos")]
            hide: "Onigiri Editor を隠す",
            #[cfg(target_os = "macos")]
            hide_others: "ほかを隠す",
            #[cfg(target_os = "macos")]
            show_all: "すべてを表示",
            quit: "Onigiri Editor を終了",
            file: "ファイル",
            new_file: "新規作成",
            new_window: "新しいウィンドウ",
            new_encoding: "新規作成（文字コード指定）…",
            open: "ファイルを開く…",
            quick_open: "クイックオープン…",
            reopen_encoding: "文字コードを指定して再読み込み…",
            open_folder: "フォルダを開く…",
            save: "保存",
            save_as: "名前を付けて保存…",
            export_html: "HTML として書き出し…",
            export_pdf: "印刷 / PDF 書き出し…",
            print_source: "ソースコードとして印刷…",
            open_recent: "最近開いた項目",
            recent_files_hdr: "— ファイル —",
            recent_folders_hdr: "— フォルダ —",
            recent_empty: "履歴はありません",
            clear_recent: "履歴をクリア",
            close_tab: "タブを閉じる",
            edit: "編集",
            undo: "元に戻す",
            redo: "やり直し",
            cut: "切り取り",
            copy: "コピー",
            paste: "貼り付け",
            select_all: "すべて選択",
            find: "検索・置換",
            goto_line: "指定行へ移動…",
            macro_toggle: "マクロの記録開始 / 停止",
            macro_play: "マクロを再生",
            view: "表示",
            mode_simple: "シンプルモード",
            mode_basic: "標準モード",
            mode_adv: "拡張モード",
            mode_harness: "AIハーネス",
            top_bar: "上部ヘッダーバーを表示",
            format_toolbar: "書式ツールバーを表示",
            editor_split: "エディタを上下に分割表示",
            palette: "コマンドパレット",
            options: "オプション / AIチャット",
            external_preview: "外部ブラウザでライブプレビュー",
            zen: "集中モード (Zen)",
            window: "ウィンドウ",
            minimize: "しまう",
            close_win: "閉じる",
            help: "ヘルプ",
            online_manual: "オンラインマニュアル",
            check_updates: "アップデートを確認…",
        },
        "zh-CN" => MenuLabels {
            about: "关于 Onigiri Editor",
            settings: "设置…",
            #[cfg(target_os = "macos")]
            services: "服务",
            #[cfg(target_os = "macos")]
            hide: "隐藏 Onigiri Editor",
            #[cfg(target_os = "macos")]
            hide_others: "隐藏其他",
            #[cfg(target_os = "macos")]
            show_all: "全部显示",
            quit: "退出 Onigiri Editor",
            file: "文件",
            new_file: "新建文件",
            new_window: "新建窗口",
            new_encoding: "使用指定编码新建…",
            open: "打开文件…",
            quick_open: "快速打开…",
            reopen_encoding: "使用指定编码重新打开…",
            open_folder: "打开文件夹…",
            save: "保存",
            save_as: "另存为…",
            export_html: "导出为 HTML…",
            export_pdf: "打印 / 导出 PDF…",
            print_source: "打印源代码…",
            open_recent: "最近打开",
            recent_files_hdr: "— 文件 —",
            recent_folders_hdr: "— 文件夹 —",
            recent_empty: "无最近记录",
            clear_recent: "清除记录",
            close_tab: "关闭标签页",
            edit: "编辑",
            undo: "撤销",
            redo: "重做",
            cut: "剪切",
            copy: "复制",
            paste: "粘贴",
            select_all: "全选",
            find: "查找与替换",
            goto_line: "跳转到行…",
            macro_toggle: "开始/停止录制宏",
            macro_play: "播放宏",
            view: "视图",
            mode_simple: "简洁模式",
            mode_basic: "标准模式",
            mode_adv: "高级模式",
            mode_harness: "AI Harness",
            top_bar: "显示顶部标题栏",
            format_toolbar: "显示格式工具栏",
            editor_split: "上下拆分编辑器",
            palette: "命令面板",
            options: "选项 / AI 聊天",
            external_preview: "在外部浏览器中实时预览",
            zen: "专注模式 (Zen)",
            window: "窗口",
            minimize: "最小化",
            close_win: "关闭窗口",
            help: "帮助",
            online_manual: "在线手册",
            check_updates: "检查更新…",
        },
        "zh-TW" => MenuLabels {
            about: "關於 Onigiri Editor",
            settings: "設定…",
            #[cfg(target_os = "macos")]
            services: "服務",
            #[cfg(target_os = "macos")]
            hide: "隱藏 Onigiri Editor",
            #[cfg(target_os = "macos")]
            hide_others: "隱藏其他",
            #[cfg(target_os = "macos")]
            show_all: "顯示全部",
            quit: "結束 Onigiri Editor",
            file: "檔案",
            new_file: "新增檔案",
            new_window: "新增視窗",
            new_encoding: "以指定編碼新增…",
            open: "開啟檔案…",
            quick_open: "快速開啟…",
            reopen_encoding: "以指定編碼重新開啟…",
            open_folder: "開啟資料夾…",
            save: "儲存",
            save_as: "另存新檔…",
            export_html: "匯出為 HTML…",
            export_pdf: "列印 / 匯出 PDF…",
            print_source: "列印原始碼…",
            open_recent: "最近開啟",
            recent_files_hdr: "— 檔案 —",
            recent_folders_hdr: "— 資料夾 —",
            recent_empty: "無最近項目",
            clear_recent: "清除紀錄",
            close_tab: "關閉分頁",
            edit: "編輯",
            undo: "復原",
            redo: "重做",
            cut: "剪下",
            copy: "複製",
            paste: "貼上",
            select_all: "全選",
            find: "尋找與取代",
            goto_line: "跳至行…",
            macro_toggle: "開始/停止錄製巨集",
            macro_play: "播放巨集",
            view: "檢視",
            mode_simple: "簡潔模式",
            mode_basic: "標準模式",
            mode_adv: "進階模式",
            mode_harness: "AI Harness",
            top_bar: "顯示頂部標題列",
            format_toolbar: "顯示格式工具列",
            editor_split: "上下分割編輯器",
            palette: "命令面板",
            options: "選項 / AI 聊天",
            external_preview: "在外部瀏覽器中即時預覽",
            zen: "專注模式 (Zen)",
            window: "視窗",
            minimize: "最小化",
            close_win: "關閉視窗",
            help: "說明",
            online_manual: "線上使用手冊",
            check_updates: "檢查更新…",
        },
        "ko" => MenuLabels {
            about: "Onigiri Editor 정보",
            settings: "설정…",
            #[cfg(target_os = "macos")]
            services: "서비스",
            #[cfg(target_os = "macos")]
            hide: "Onigiri Editor 가리기",
            #[cfg(target_os = "macos")]
            hide_others: "기타 가리기",
            #[cfg(target_os = "macos")]
            show_all: "모두 보기",
            quit: "Onigiri Editor 종료",
            file: "파일",
            new_file: "새 파일",
            new_window: "새 창",
            new_encoding: "인코딩 지정하여 새로 만들기…",
            open: "파일 열기…",
            quick_open: "빠른 열기…",
            reopen_encoding: "인코딩으로 다시 열기…",
            open_folder: "폴더 열기…",
            save: "저장",
            save_as: "다른 이름으로 저장…",
            export_html: "HTML로 내보내기…",
            export_pdf: "인쇄 / PDF 내보내기…",
            print_source: "소스 코드 인쇄…",
            open_recent: "최근 항목 열기",
            recent_files_hdr: "— 파일 —",
            recent_folders_hdr: "— 폴더 —",
            recent_empty: "최근 항목 없음",
            clear_recent: "기록 지우기",
            close_tab: "탭 닫기",
            edit: "편집",
            undo: "실행 취소",
            redo: "다시 실행",
            cut: "잘라내기",
            copy: "복사",
            paste: "붙여넣기",
            select_all: "모두 선택",
            find: "찾기 및 바꾸기",
            goto_line: "줄로 이동…",
            macro_toggle: "매크로 기록 시작 / 중지",
            macro_play: "매크로 재생",
            view: "보기",
            mode_simple: "심플 모드",
            mode_basic: "기본 모드",
            mode_adv: "고급 모드",
            mode_harness: "AI 하네스",
            top_bar: "상단 헤더 바 표시",
            format_toolbar: "서식 도구 모음 표시",
            editor_split: "편집기 위/아래 분할",
            palette: "명령 팔레트",
            options: "옵션 / AI 채팅",
            external_preview: "외부 브라우저 실시간 미리보기",
            zen: "집중 모드 (Zen)",
            window: "창",
            minimize: "최소화",
            close_win: "창 닫기",
            help: "도움말",
            online_manual: "온라인 설명서",
            check_updates: "업데이트 확인…",
        },
        "es" => MenuLabels {
            about: "Acerca de Onigiri Editor",
            settings: "Ajustes...",
            #[cfg(target_os = "macos")]
            services: "Servicios",
            #[cfg(target_os = "macos")]
            hide: "Ocultar Onigiri Editor",
            #[cfg(target_os = "macos")]
            hide_others: "Ocultar otros",
            #[cfg(target_os = "macos")]
            show_all: "Mostrar todo",
            quit: "Salir de Onigiri Editor",
            file: "Archivo",
            new_file: "Nuevo archivo",
            new_window: "Nueva ventana",
            new_encoding: "Nuevo archivo con codificación...",
            open: "Abrir archivo...",
            quick_open: "Apertura rápida...",
            reopen_encoding: "Reabrir con codificación...",
            open_folder: "Abrir carpeta...",
            save: "Guardar",
            save_as: "Guardar como...",
            export_html: "Exportar HTML...",
            export_pdf: "Imprimir / Exportar PDF...",
            print_source: "Imprimir código fuente...",
            open_recent: "Abrir reciente",
            recent_files_hdr: "— Archivos —",
            recent_folders_hdr: "— Carpetas —",
            recent_empty: "Sin elementos recientes",
            clear_recent: "Limpiar historial",
            close_tab: "Cerrar pestaña",
            edit: "Editar",
            undo: "Deshacer",
            redo: "Rehacer",
            cut: "Cortar",
            copy: "Copiar",
            paste: "Pegar",
            select_all: "Seleccionar todo",
            find: "Buscar y reemplazar",
            goto_line: "Ir a la línea...",
            macro_toggle: "Grabar / Detener macro",
            macro_play: "Reproducir macro",
            view: "Ver",
            mode_simple: "Modo Simple",
            mode_basic: "Modo Básico",
            mode_adv: "Modo Avanzado",
            mode_harness: "AI Harness",
            top_bar: "Mostrar barra superior",
            format_toolbar: "Mostrar barra de formato",
            editor_split: "Dividir editor arriba / abajo",
            palette: "Paleta de comandos",
            options: "Opciones / Chat IA",
            external_preview: "Vista previa en navegador externo",
            zen: "Modo Zen",
            window: "Ventana",
            minimize: "Minimizar",
            close_win: "Cerrar ventana",
            help: "Ayuda",
            online_manual: "Manual en línea",
            check_updates: "Buscar actualizaciones...",
        },
        "fr" => MenuLabels {
            about: "À propos d'Onigiri Editor",
            settings: "Paramètres...",
            #[cfg(target_os = "macos")]
            services: "Services",
            #[cfg(target_os = "macos")]
            hide: "Masquer Onigiri Editor",
            #[cfg(target_os = "macos")]
            hide_others: "Masquer les autres",
            #[cfg(target_os = "macos")]
            show_all: "Tout afficher",
            quit: "Quitter Onigiri Editor",
            file: "Fichier",
            new_file: "Nouveau fichier",
            new_window: "Nouvelle fenêtre",
            new_encoding: "Nouveau fichier avec encodage...",
            open: "Ouvrir un fichier...",
            quick_open: "Ouverture rapide...",
            reopen_encoding: "Rouvrir avec l'encodage...",
            open_folder: "Ouvrir un dossier...",
            save: "Enregistrer",
            save_as: "Enregistrer sous...",
            export_html: "Exporter en HTML...",
            export_pdf: "Imprimer / Exporter en PDF...",
            print_source: "Imprimer le code source...",
            open_recent: "Récents",
            recent_files_hdr: "— Fichiers —",
            recent_folders_hdr: "— Dossiers —",
            recent_empty: "Aucun élément récent",
            clear_recent: "Effacer l'historique",
            close_tab: "Fermer l'onglet",
            edit: "Édition",
            undo: "Annuler",
            redo: "Rétablir",
            cut: "Couper",
            copy: "Copier",
            paste: "Coller",
            select_all: "Tout sélectionner",
            find: "Rechercher et remplacer",
            goto_line: "Aller à la ligne...",
            macro_toggle: "Enregistrer / Arrêter la macro",
            macro_play: "Lire la macro",
            view: "Affichage",
            mode_simple: "Mode Simple",
            mode_basic: "Mode Standard",
            mode_adv: "Mode Avancé",
            mode_harness: "AI Harness",
            top_bar: "Afficher la barre d'en-tête",
            format_toolbar: "Afficher la barre de mise en forme",
            editor_split: "Fractionner l'éditeur haut / bas",
            palette: "Palette de commandes",
            options: "Options / Chat IA",
            external_preview: "Aperçu en direct dans le navigateur",
            zen: "Mode Zen",
            window: "Fenêtre",
            minimize: "Réduire",
            close_win: "Fermer la fenêtre",
            help: "Aide",
            online_manual: "Manuel en ligne",
            check_updates: "Vérifier les mises à jour...",
        },
        "de" => MenuLabels {
            about: "Über Onigiri Editor",
            settings: "Einstellungen...",
            #[cfg(target_os = "macos")]
            services: "Dienste",
            #[cfg(target_os = "macos")]
            hide: "Onigiri Editor ausblenden",
            #[cfg(target_os = "macos")]
            hide_others: "Andere ausblenden",
            #[cfg(target_os = "macos")]
            show_all: "Alle einblenden",
            quit: "Onigiri Editor beenden",
            file: "Datei",
            new_file: "Neue Datei",
            new_window: "Neues Fenster",
            new_encoding: "Neue Datei mit Kodierung...",
            open: "Datei öffnen...",
            quick_open: "Schnell öffnen...",
            reopen_encoding: "Mit Kodierung neu öffnen...",
            open_folder: "Ordner öffnen...",
            save: "Speichern",
            save_as: "Speichern unter...",
            export_html: "Als HTML exportieren...",
            export_pdf: "Drucken / Als PDF exportieren...",
            print_source: "Quellcode drucken...",
            open_recent: "Zuletzt geöffnet",
            recent_files_hdr: "— Dateien —",
            recent_folders_hdr: "— Ordner —",
            recent_empty: "Keine letzten Einträge",
            clear_recent: "Verlauf löschen",
            close_tab: "Tab schließen",
            edit: "Bearbeiten",
            undo: "Rückgängig",
            redo: "Wiederholen",
            cut: "Ausschneiden",
            copy: "Kopieren",
            paste: "Einfügen",
            select_all: "Alles auswählen",
            find: "Suchen & Ersetzen",
            goto_line: "Gehe zu Zeile...",
            macro_toggle: "Makro aufnehmen / stoppen",
            macro_play: "Makro abspielen",
            view: "Ansicht",
            mode_simple: "Einfacher Modus",
            mode_basic: "Standardmodus",
            mode_adv: "Erweiterter Modus",
            mode_harness: "AI Harness",
            top_bar: "Kopfzeile anzeigen",
            format_toolbar: "Formatierungsleiste anzeigen",
            editor_split: "Editor oben / unten teilen",
            palette: "Befehlspalette",
            options: "Optionen / KI-Chat",
            external_preview: "Live-Vorschau im externen Browser",
            zen: "Zen-Modus",
            window: "Fenster",
            minimize: "Minimieren",
            close_win: "Fenster schließen",
            help: "Hilfe",
            online_manual: "Online-Handbuch",
            check_updates: "Nach Updates suchen...",
        },
        _ => MenuLabels {
            about: "About Onigiri Editor",
            settings: "Settings...",
            #[cfg(target_os = "macos")]
            services: "Services",
            #[cfg(target_os = "macos")]
            hide: "Hide Onigiri Editor",
            #[cfg(target_os = "macos")]
            hide_others: "Hide Others",
            #[cfg(target_os = "macos")]
            show_all: "Show All",
            quit: "Quit Onigiri Editor",
            file: "File",
            new_file: "New File",
            new_window: "New Window",
            new_encoding: "New File with Encoding...",
            open: "Open File...",
            quick_open: "Quick Open...",
            reopen_encoding: "Reopen with Encoding...",
            open_folder: "Open Folder...",
            save: "Save",
            save_as: "Save As...",
            export_html: "Export HTML...",
            export_pdf: "Print / Export PDF...",
            print_source: "Print Source Code...",
            open_recent: "Open Recent",
            recent_files_hdr: "— Files —",
            recent_folders_hdr: "— Folders —",
            recent_empty: "No Recent Items",
            clear_recent: "Clear History",
            close_tab: "Close Tab",
            edit: "Edit",
            undo: "Undo",
            redo: "Redo",
            cut: "Cut",
            copy: "Copy",
            paste: "Paste",
            select_all: "Select All",
            find: "Find & Replace",
            goto_line: "Go to Line...",
            macro_toggle: "Record / Stop Macro",
            macro_play: "Play Macro",
            view: "View",
            mode_simple: "Simple Mode",
            mode_basic: "Basic Mode",
            mode_adv: "Advanced Mode",
            mode_harness: "AI Harness",
            top_bar: "Show Header Bar",
            format_toolbar: "Show Format Toolbar",
            editor_split: "Split Editor Top / Bottom",
            palette: "Command Palette",
            options: "Options / AI Chat",
            external_preview: "Live Preview in External Browser",
            zen: "Zen Mode",
            window: "Window",
            minimize: "Minimize",
            close_win: "Close Window",
            help: "Help",
            online_manual: "Online Manual",
            check_updates: "Check for Updates...",
        },
    };

    let about_label = lbl.about;
    let settings_label = lbl.settings;
    #[cfg(target_os = "macos")]
    let services_label = lbl.services;
    #[cfg(target_os = "macos")]
    let hide_label = lbl.hide;
    #[cfg(target_os = "macos")]
    let hide_others_label = lbl.hide_others;
    #[cfg(target_os = "macos")]
    let show_all_label = lbl.show_all;
    let quit_label = lbl.quit;

    let file_title = lbl.file;
    let new_label = lbl.new_file;
    let new_window_label = lbl.new_window;
    let new_encoding_label = lbl.new_encoding;
    let open_label = lbl.open;
    let quick_open_label = lbl.quick_open;
    let reopen_encoding_label = lbl.reopen_encoding;
    let open_folder_label = lbl.open_folder;
    let save_label = lbl.save;
    let save_as_label = lbl.save_as;
    let export_html_label = lbl.export_html;
    let export_pdf_label = lbl.export_pdf;
    let print_source_label = lbl.print_source;
    let open_recent_title = lbl.open_recent;
    let recent_files_header = lbl.recent_files_hdr;
    let recent_folders_header = lbl.recent_folders_hdr;
    let recent_empty_label = lbl.recent_empty;
    let clear_recent_label = lbl.clear_recent;
    let close_tab_label = lbl.close_tab;

    let edit_title = lbl.edit;
    let undo_label = lbl.undo;
    let redo_label = lbl.redo;
    let cut_label = lbl.cut;
    let copy_label = lbl.copy;
    let paste_label = lbl.paste;
    let select_all_label = lbl.select_all;
    let find_label = lbl.find;
    let goto_line_label = lbl.goto_line;
    let macro_toggle_label = lbl.macro_toggle;
    let macro_play_label = lbl.macro_play;

    let view_title = lbl.view;
    let mode_simple_label = lbl.mode_simple;
    let mode_basic_label = lbl.mode_basic;
    let mode_adv_label = lbl.mode_adv;
    let mode_harness_label = lbl.mode_harness;
    let top_bar_label = lbl.top_bar;
    let format_toolbar_label = lbl.format_toolbar;
    let editor_split_label = lbl.editor_split;
    let palette_label = lbl.palette;
    let options_label = lbl.options;
    let external_preview_label = lbl.external_preview;
    let zen_label = lbl.zen;

    let window_title = lbl.window;
    let minimize_label = lbl.minimize;
    let close_win_label = lbl.close_win;

    let help_title = lbl.help;
    let online_manual_label = lbl.online_manual;
    let check_updates_label = lbl.check_updates;

    let menu_about = MenuItemBuilder::with_id("open-about", about_label).build(app)?;
    let menu_settings = MenuItemBuilder::with_id("open-settings", settings_label)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let file_new = MenuItemBuilder::with_id("new-file", new_label)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let file_new_window = MenuItemBuilder::with_id("new-window", new_window_label)
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let file_new_encoding =
        MenuItemBuilder::with_id("new-file-with-encoding", new_encoding_label).build(app)?;
    let file_open = MenuItemBuilder::with_id("open-file", open_label)
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let file_quick_open = MenuItemBuilder::with_id("quick-open", quick_open_label)
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let file_reopen_encoding =
        MenuItemBuilder::with_id("reopen-with-encoding", reopen_encoding_label).build(app)?;
    let file_open_folder = MenuItemBuilder::with_id("open-folder", open_folder_label)
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let file_save = MenuItemBuilder::with_id("save", save_label)
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let file_save_as = MenuItemBuilder::with_id("save-as", save_as_label)
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let file_export_html = MenuItemBuilder::with_id("export-html", export_html_label).build(app)?;
    let file_export_pdf = MenuItemBuilder::with_id("export-pdf", export_pdf_label).build(app)?;
    let file_print_source = MenuItemBuilder::with_id("print-source", print_source_label).build(app)?;
    let file_close_tab = MenuItemBuilder::with_id("close-tab", close_tab_label)
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let mut recent_builder = SubmenuBuilder::new(app, open_recent_title);
    if recent_files.is_empty() && recent_folders.is_empty() {
        let empty_item = MenuItemBuilder::with_id("recent-empty", recent_empty_label)
            .enabled(false)
            .build(app)?;
        recent_builder = recent_builder.item(&empty_item);
    } else {
        if !recent_files.is_empty() {
            let files_hdr = MenuItemBuilder::with_id("recent-files-hdr", recent_files_header)
                .enabled(false)
                .build(app)?;
            recent_builder = recent_builder.item(&files_hdr);
            for (idx, p) in recent_files.iter().take(10).enumerate() {
                let name = std::path::Path::new(p)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(p.as_str());
                let label = if name == p.as_str() {
                    name.to_string()
                } else {
                    format!("{}  —  {}", name, p)
                };
                let item = MenuItemBuilder::with_id(format!("recent-file::{}", idx), label)
                    .build(app)?;
                recent_builder = recent_builder.item(&item);
            }
        }
        if !recent_folders.is_empty() {
            if !recent_files.is_empty() {
                recent_builder = recent_builder.separator();
            }
            let folders_hdr =
                MenuItemBuilder::with_id("recent-folders-hdr", recent_folders_header)
                    .enabled(false)
                    .build(app)?;
            recent_builder = recent_builder.item(&folders_hdr);
            for (idx, p) in recent_folders.iter().take(8).enumerate() {
                let name = std::path::Path::new(p)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(p.as_str());
                let label = if name == p.as_str() {
                    name.to_string()
                } else {
                    format!("{}  —  {}", name, p)
                };
                let item = MenuItemBuilder::with_id(format!("recent-folder::{}", idx), label)
                    .build(app)?;
                recent_builder = recent_builder.item(&item);
            }
        }
        recent_builder = recent_builder.separator();
        let clear_item =
            MenuItemBuilder::with_id("clear-recent", clear_recent_label).build(app)?;
        recent_builder = recent_builder.item(&clear_item);
    }
    let recent_submenu = recent_builder.build()?;

    let edit_undo = MenuItemBuilder::with_id("edit-undo", undo_label)
        .accelerator("CmdOrCtrl+Z")
        .build(app)?;
    let edit_redo = MenuItemBuilder::with_id("edit-redo", redo_label)
        .accelerator("CmdOrCtrl+Shift+Z")
        .build(app)?;
    let edit_find = MenuItemBuilder::with_id("find", find_label)
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let edit_goto_line = MenuItemBuilder::with_id("go-to-line", goto_line_label)
        .accelerator("CmdOrCtrl+L")
        .build(app)?;
    let edit_macro_toggle =
        MenuItemBuilder::with_id("macro-toggle-record", macro_toggle_label).build(app)?;
    let edit_macro_play = MenuItemBuilder::with_id("macro-play", macro_play_label).build(app)?;

    let view_simple = MenuItemBuilder::with_id("mode-simple", mode_simple_label).build(app)?;
    let view_basic = MenuItemBuilder::with_id("mode-basic", mode_basic_label).build(app)?;
    let view_adv = MenuItemBuilder::with_id("mode-advanced", mode_adv_label).build(app)?;
    let view_harness = MenuItemBuilder::with_id("toggle-harness", mode_harness_label)
        .accelerator("CmdOrCtrl+Shift+H")
        .build(app)?;
    let view_top_bar = CheckMenuItemBuilder::with_id("toggle-top-bar", top_bar_label)
        .checked(show_top_bar)
        .build(app)?;
    let view_format_toolbar =
        CheckMenuItemBuilder::with_id("toggle-format-toolbar", format_toolbar_label)
            .checked(show_format_toolbar)
            .build(app)?;
    let view_editor_split =
        CheckMenuItemBuilder::with_id("toggle-editor-split", editor_split_label)
            .checked(editor_split)
            .build(app)?;
    let view_palette = MenuItemBuilder::with_id("palette", palette_label)
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let view_options = MenuItemBuilder::with_id("toggle-inspector", options_label).build(app)?;
    let view_ext_preview =
        MenuItemBuilder::with_id("external-preview", external_preview_label).build(app)?;
    let view_zen = MenuItemBuilder::with_id("toggle-zen", zen_label)
        .accelerator("CmdOrCtrl+Shift+F")
        .build(app)?;

    let help_online_manual =
        MenuItemBuilder::with_id("open-online-manual", online_manual_label).build(app)?;
    let help_check_updates =
        MenuItemBuilder::with_id("check-updates", check_updates_label).build(app)?;

    #[cfg(target_os = "macos")]
    let app_submenu = SubmenuBuilder::new(app, "Onigiri Editor")
        .item(&menu_about)
        .separator()
        .item(&menu_settings)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some(services_label))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some(hide_label))?)
        .item(&PredefinedMenuItem::hide_others(app, Some(hide_others_label))?)
        .item(&PredefinedMenuItem::show_all(app, Some(show_all_label))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some(quit_label))?)
        .build()?;

    #[cfg_attr(target_os = "macos", allow(unused_mut))]
    let mut file_builder = SubmenuBuilder::new(app, file_title)
        .item(&file_new)
        .item(&file_new_window)
        .item(&file_new_encoding)
        .item(&file_open)
        .item(&file_quick_open)
        .item(&file_reopen_encoding)
        .item(&file_open_folder)
        .item(&recent_submenu)
        .separator()
        .item(&file_save)
        .item(&file_save_as)
        .separator()
        .item(&file_export_html)
        .item(&file_export_pdf)
        .item(&file_print_source)
        .separator()
        .item(&file_close_tab);

    #[cfg(not(target_os = "macos"))]
    {
        file_builder = file_builder
            .separator()
            .item(&menu_settings)
            .separator()
            .item(&PredefinedMenuItem::quit(app, Some(quit_label))?);
    }

    let file_submenu = file_builder.build()?;

    let edit_submenu = SubmenuBuilder::new(app, edit_title)
        .item(&edit_undo)
        .item(&edit_redo)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some(cut_label))?)
        .item(&PredefinedMenuItem::copy(app, Some(copy_label))?)
        .item(&PredefinedMenuItem::paste(app, Some(paste_label))?)
        .item(&PredefinedMenuItem::select_all(app, Some(select_all_label))?)
        .separator()
        .item(&edit_find)
        .item(&edit_goto_line)
        .separator()
        .item(&edit_macro_toggle)
        .item(&edit_macro_play)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, view_title)
        .item(&view_simple)
        .item(&view_basic)
        .item(&view_adv)
        .item(&view_harness)
        .separator()
        .item(&view_top_bar)
        .item(&view_format_toolbar)
        .item(&view_editor_split)
        .separator()
        .item(&view_palette)
        .item(&view_options)
        .item(&view_ext_preview)
        .item(&view_zen)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, window_title)
        .item(&PredefinedMenuItem::minimize(app, Some(minimize_label))?)
        .item(&PredefinedMenuItem::close_window(app, Some(close_win_label))?)
        .build()?;

    let mut help_builder = SubmenuBuilder::new(app, help_title)
        .item(&help_online_manual)
        .item(&help_check_updates)
        .separator();
    #[cfg(not(target_os = "macos"))]
    {
        help_builder = help_builder.item(&menu_about);
    }
    #[cfg(target_os = "macos")]
    {
        let help_about = MenuItemBuilder::with_id("open-about-help", about_label).build(app)?;
        help_builder = help_builder.item(&help_about);
    }
    let help_submenu = help_builder.build()?;

    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut menu_builder = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        menu_builder = menu_builder.item(&app_submenu);
    }

    menu_builder
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if id == "new-window" {
        let _ = crate::create_new_window_impl(app, None, None);
        return;
    }
    let normalized = match id {
        "open-about-help" => "open-about",
        other => other,
    };
    if let Some(target) = crate::focused_or_primary_window_label(app) {
        let _ = app.emit_to(&target, "menu-action", normalized);
    } else {
        let _ = app.emit("menu-action", normalized);
    }
}

#[tauri::command]
pub fn rebuild_app_menu(
    app: AppHandle,
    locale: String,
    show_top_bar: Option<bool>,
    show_format_toolbar: Option<bool>,
    editor_split: Option<bool>,
    recent_files: Option<Vec<String>>,
    recent_folders: Option<Vec<String>>,
) -> Result<(), String> {
    let rf = recent_files.unwrap_or_default();
    let rd = recent_folders.unwrap_or_default();
    let menu = build_app_menu_with_state(
        &app,
        &locale,
        show_top_bar.unwrap_or(true),
        show_format_toolbar.unwrap_or(true),
        editor_split.unwrap_or(false),
        &rf,
        &rd,
    )
    .map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}
