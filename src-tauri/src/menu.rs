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
    build_app_menu_with_state(app, locale, true, true)
}

pub fn build_app_menu_with_state<R: Runtime>(
    app: &AppHandle<R>,
    locale: &str,
    show_top_bar: bool,
    show_format_toolbar: bool,
) -> tauri::Result<Menu<R>> {
    let is_ja = locale == "ja";

    let about_label = if is_ja {
        "Onigiri Editor について"
    } else {
        "About Onigiri Editor"
    };
    let settings_label = if is_ja { "設定…" } else { "Settings..." };
    #[cfg(target_os = "macos")]
    let services_label = if is_ja { "サービス" } else { "Services" };
    #[cfg(target_os = "macos")]
    let hide_label = if is_ja {
        "Onigiri Editor を隠す"
    } else {
        "Hide Onigiri Editor"
    };
    #[cfg(target_os = "macos")]
    let hide_others_label = if is_ja {
        "ほかを隠す"
    } else {
        "Hide Others"
    };
    #[cfg(target_os = "macos")]
    let show_all_label = if is_ja {
        "すべてを表示"
    } else {
        "Show All"
    };
    let quit_label = if is_ja {
        "Onigiri Editor を終了"
    } else {
        "Quit Onigiri Editor"
    };

    let file_title = if is_ja { "ファイル" } else { "File" };
    let new_label = if is_ja { "新規作成" } else { "New File" };
    let new_encoding_label = if is_ja {
        "新規作成（文字コード指定）…"
    } else {
        "New File with Encoding..."
    };
    let open_label = if is_ja { "ファイルを開く…" } else { "Open File..." };
    let reopen_encoding_label = if is_ja {
        "文字コードを指定して再読み込み…"
    } else {
        "Reopen with Encoding..."
    };
    let open_folder_label = if is_ja {
        "フォルダを開く…"
    } else {
        "Open Folder..."
    };
    let save_label = if is_ja { "保存" } else { "Save" };
    let save_as_label = if is_ja {
        "名前を付けて保存…"
    } else {
        "Save As..."
    };
    let export_html_label = if is_ja {
        "HTML として書き出し…"
    } else {
        "Export HTML..."
    };
    let export_pdf_label = if is_ja {
        "印刷 / PDF 書き出し…"
    } else {
        "Print / Export PDF..."
    };
    let close_tab_label = if is_ja { "タブを閉じる" } else { "Close Tab" };

    let edit_title = if is_ja { "編集" } else { "Edit" };
    let undo_label = if is_ja { "元に戻す" } else { "Undo" };
    let redo_label = if is_ja { "やり直し" } else { "Redo" };
    let cut_label = if is_ja { "切り取り" } else { "Cut" };
    let copy_label = if is_ja { "コピー" } else { "Copy" };
    let paste_label = if is_ja { "貼り付け" } else { "Paste" };
    let select_all_label = if is_ja { "すべて選択" } else { "Select All" };
    let find_label = if is_ja { "検索・置換" } else { "Find & Replace" };
    let goto_line_label = if is_ja {
        "指定行へ移動…"
    } else {
        "Go to Line..."
    };

    let view_title = if is_ja { "表示" } else { "View" };
    let mode_simple_label = if is_ja { "シンプルモード" } else { "Simple Mode" };
    let mode_basic_label = if is_ja { "標準モード" } else { "Basic Mode" };
    let mode_adv_label = if is_ja { "拡張モード" } else { "Advanced Mode" };
    let top_bar_label = if is_ja {
        "上部ヘッダーバーを表示"
    } else {
        "Show Header Bar"
    };
    let format_toolbar_label = if is_ja {
        "書式ツールバーを表示"
    } else {
        "Show Format Toolbar"
    };
    let palette_label = if is_ja {
        "コマンドパレット"
    } else {
        "Command Palette"
    };
    let options_label = if is_ja {
        "オプション / AIチャット"
    } else {
        "Options / AI Chat"
    };
    let external_preview_label = if is_ja {
        "外部ブラウザでライブプレビュー"
    } else {
        "Live Preview in External Browser"
    };
    let zen_label = if is_ja { "集中モード (Zen)" } else { "Zen Mode" };

    let window_title = if is_ja { "ウィンドウ" } else { "Window" };
    let minimize_label = if is_ja { "しまう" } else { "Minimize" };
    let close_win_label = if is_ja { "閉じる" } else { "Close Window" };

    let help_title = if is_ja { "ヘルプ" } else { "Help" };
    let online_manual_label = if is_ja {
        "オンラインマニュアル"
    } else {
        "Online Manual"
    };

    let menu_about = MenuItemBuilder::with_id("open-about", about_label).build(app)?;
    let menu_settings = MenuItemBuilder::with_id("open-settings", settings_label)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let file_new = MenuItemBuilder::with_id("new-file", new_label)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let file_new_encoding =
        MenuItemBuilder::with_id("new-file-with-encoding", new_encoding_label).build(app)?;
    let file_open = MenuItemBuilder::with_id("open-file", open_label)
        .accelerator("CmdOrCtrl+O")
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
    let file_close_tab = MenuItemBuilder::with_id("close-tab", close_tab_label)
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let edit_find = MenuItemBuilder::with_id("find", find_label)
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let edit_goto_line = MenuItemBuilder::with_id("go-to-line", goto_line_label)
        .accelerator("CmdOrCtrl+L")
        .build(app)?;

    let view_simple = MenuItemBuilder::with_id("mode-simple", mode_simple_label).build(app)?;
    let view_basic = MenuItemBuilder::with_id("mode-basic", mode_basic_label).build(app)?;
    let view_adv = MenuItemBuilder::with_id("mode-advanced", mode_adv_label).build(app)?;
    let view_top_bar = CheckMenuItemBuilder::with_id("toggle-top-bar", top_bar_label)
        .checked(show_top_bar)
        .build(app)?;
    let view_format_toolbar =
        CheckMenuItemBuilder::with_id("toggle-format-toolbar", format_toolbar_label)
            .checked(show_format_toolbar)
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
        .item(&file_new_encoding)
        .item(&file_open)
        .item(&file_reopen_encoding)
        .item(&file_open_folder)
        .separator()
        .item(&file_save)
        .item(&file_save_as)
        .separator()
        .item(&file_export_html)
        .item(&file_export_pdf)
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
        .item(&PredefinedMenuItem::undo(app, Some(undo_label))?)
        .item(&PredefinedMenuItem::redo(app, Some(redo_label))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some(cut_label))?)
        .item(&PredefinedMenuItem::copy(app, Some(copy_label))?)
        .item(&PredefinedMenuItem::paste(app, Some(paste_label))?)
        .item(&PredefinedMenuItem::select_all(app, Some(select_all_label))?)
        .separator()
        .item(&edit_find)
        .item(&edit_goto_line)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, view_title)
        .item(&view_simple)
        .item(&view_basic)
        .item(&view_adv)
        .separator()
        .item(&view_top_bar)
        .item(&view_format_toolbar)
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
    let normalized = match id {
        "open-about-help" => "open-about",
        other => other,
    };
    let _ = app.emit("menu-action", normalized);
}

#[tauri::command]
pub fn rebuild_app_menu(
    app: AppHandle,
    locale: String,
    show_top_bar: Option<bool>,
    show_format_toolbar: Option<bool>,
) -> Result<(), String> {
    let menu = build_app_menu_with_state(
        &app,
        &locale,
        show_top_bar.unwrap_or(true),
        show_format_toolbar.unwrap_or(true),
    )
    .map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}
