use std::{
    fs,
    path::PathBuf,
};

use tauri::{
    menu::{CheckMenuItem, ContextMenu, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalSize, Manager, PhysicalPosition, Size,
};

const EDGE_MARGIN: i32 = 12;
const APP_ICON_PNG: &[u8] = include_bytes!("../icons/128x128.png");

fn get_app_icon() -> Option<tauri::image::Image<'static>> {
    tauri::image::Image::from_bytes(APP_ICON_PNG).ok()
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub autostart: bool,
    pub always_on_top: bool,
    pub auto_snap: bool,
    pub close_to_tray: bool,
    pub widget_size_preset: String,
    pub widget_width: u32,
    pub widget_height: u32,
    pub widget_theme: String,
    pub show_resize_grip: bool,
    pub show_tithi_pill: bool,
    pub show_english_date: bool,
    pub show_weekday: bool,
    pub highlight_holidays: bool,
    pub show_grid_tithi: bool,
    pub show_highlights_ribbon: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            autostart: false,
            always_on_top: true,
            auto_snap: true,
            close_to_tray: true,
            widget_size_preset: "standard".to_string(),
            widget_width: 254,
            widget_height: 70,
            widget_theme: "glass".to_string(),
            show_resize_grip: true,
            show_tithi_pill: true,
            show_english_date: true,
            show_weekday: true,
            highlight_holidays: true,
            show_grid_tithi: true,
            show_highlights_ribbon: true,
        }
    }
}

fn app_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    fs::create_dir_all(&directory)
        .map_err(|error| error.to_string())?;

    Ok(directory)
}

fn position_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_config_dir(app)?;
    Ok(dir.join("widget-position.txt"))
}

fn settings_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_config_dir(app)?;
    Ok(dir.join("app-settings.json"))
}

fn load_settings_internal(app: &tauri::AppHandle) -> AppSettings {
    if let Ok(file) = settings_file(app) {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(mut settings) = serde_json::from_str::<AppSettings>(&content) {
                use tauri_plugin_autostart::ManagerExt;
                if let Ok(enabled) = app.autolaunch().is_enabled() {
                    settings.autostart = enabled;
                }
                return settings;
            }
        }
    }

    let mut settings = AppSettings::default();
    use tauri_plugin_autostart::ManagerExt;
    if let Ok(enabled) = app.autolaunch().is_enabled() {
        settings.autostart = enabled;
    }
    settings
}

fn save_settings_internal(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let file = settings_file(app)?;
    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| error.to_string())?;
    fs::write(file, content).map_err(|error| error.to_string())
}

fn save_position(
    app: &tauri::AppHandle,
    position: PhysicalPosition<i32>,
) -> Result<(), String> {
    let file = position_file(app)?;

    fs::write(
        file,
        format!("{},{}", position.x, position.y),
    )
    .map_err(|error| error.to_string())
}

fn read_position(
    app: &tauri::AppHandle,
) -> Option<PhysicalPosition<i32>> {
    let file = position_file(app).ok()?;

    let content = fs::read_to_string(file).ok()?;
    let mut parts = content.trim().split(',');

    let x = parts.next()?.parse::<i32>().ok()?;
    let y = parts.next()?.parse::<i32>().ok()?;

    if parts.next().is_some() {
        return None;
    }

    Some(PhysicalPosition::new(x, y))
}

fn widget_window(
    app: &tauri::AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main widget window not found".to_string())
}

#[tauri::command]
fn restore_widget_position(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let window = widget_window(&app)?;
    let settings = load_settings_internal(&app);

    // Apply saved size if within realistic bounds
    if settings.widget_width >= 200 && settings.widget_width <= 450 &&
       settings.widget_height >= 54 && settings.widget_height <= 140 {
        let _ = window.set_size(Size::Logical(LogicalSize::new(
            settings.widget_width as f64,
            settings.widget_height as f64,
        )));
    }

    let _ = window.set_always_on_top(settings.always_on_top);

    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor available".to_string())?;

    let area = monitor.work_area();

    let size = window
        .outer_size()
        .map_err(|error| error.to_string())?;

    let width = size.width as i32;
    let height = size.height as i32;

    let left = area.position.x + EDGE_MARGIN;
    let top = area.position.y + EDGE_MARGIN;

    let right = (
        area.position.x +
        area.size.width as i32 -
        width -
        EDGE_MARGIN
    ).max(left);

    let bottom = (
        area.position.y +
        area.size.height as i32 -
        height -
        EDGE_MARGIN
    ).max(top);

    // Default position is right side bottom, directly near the Windows 11 clock
    let default_bottom_right = PhysicalPosition::new(right, bottom);

    let desired = match read_position(&app) {
        Some(pos) => {
            // Migrate old top default to bottom-right clock area
            if pos.y <= top + 100 && pos.x >= right - 120 {
                default_bottom_right
            } else {
                pos
            }
        }
        None => default_bottom_right,
    };

    let final_position = PhysicalPosition::new(
        desired.x.clamp(left, right),
        desired.y.clamp(top, bottom),
    );

    window
        .set_position(final_position)
        .map_err(|error| error.to_string())?;

    save_position(&app, final_position)
}

#[tauri::command]
fn reset_widget_position(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let window = widget_window(&app)?;

    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor available".to_string())?;

    let area = monitor.work_area();

    let size = window
        .outer_size()
        .map_err(|error| error.to_string())?;

    let width = size.width as i32;
    let height = size.height as i32;

    let left = area.position.x + EDGE_MARGIN;
    let top = area.position.y + EDGE_MARGIN;

    let right = (
        area.position.x +
        area.size.width as i32 -
        width -
        EDGE_MARGIN
    ).max(left);

    let bottom = (
        area.position.y +
        area.size.height as i32 -
        height -
        EDGE_MARGIN
    ).max(top);

    let bottom_right = PhysicalPosition::new(right, bottom);

    window
        .set_position(bottom_right)
        .map_err(|error| error.to_string())?;

    save_position(&app, bottom_right)
}

#[tauri::command]
fn snap_widget(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let window = widget_window(&app)?;

    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor available".to_string())?;

    let area = monitor.work_area();

    let position = window
        .outer_position()
        .map_err(|error| error.to_string())?;

    let size = window
        .outer_size()
        .map_err(|error| error.to_string())?;

    let width = size.width as i32;
    let height = size.height as i32;

    let left = area.position.x + EDGE_MARGIN;
    let top = area.position.y + EDGE_MARGIN;

    let right = (
        area.position.x +
        area.size.width as i32 -
        width -
        EDGE_MARGIN
    ).max(left);

    let bottom = (
        area.position.y +
        area.size.height as i32 -
        height -
        EDGE_MARGIN
    ).max(top);

    let widget_center_x = position.x + width / 2;
    let widget_center_y = position.y + height / 2;

    let work_center_x =
        area.position.x + area.size.width as i32 / 2;

    let work_center_y =
        area.position.y + area.size.height as i32 / 2;

    let target_x = if widget_center_x < work_center_x {
        left
    } else {
        right
    };

    let target_y = if widget_center_y < work_center_y {
        top
    } else {
        bottom
    };

    let snapped = PhysicalPosition::new(
        target_x,
        target_y,
    );

    window
        .set_position(snapped)
        .map_err(|error| error.to_string())?;

    save_position(&app, snapped)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enable: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    if enable {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_app_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    Ok(load_settings_internal(&app))
}

#[tauri::command]
fn save_app_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    // Synchronize autostart with Windows
    use tauri_plugin_autostart::ManagerExt;
    let current_autostart = app.autolaunch().is_enabled().unwrap_or(false);
    if settings.autostart != current_autostart {
        if settings.autostart {
            let _ = app.autolaunch().enable();
        } else {
            let _ = app.autolaunch().disable();
        }
    }

    // Apply always on top to widget
    if let Ok(w) = widget_window(&app) {
        let _ = w.set_always_on_top(settings.always_on_top);

        // Apply size if changed
        let _ = w.set_size(Size::Logical(LogicalSize::new(
            settings.widget_width as f64,
            settings.widget_height as f64,
        )));
    }

    save_settings_internal(&app, &settings)?;

    // Broadcast change to all windows
    let _ = app.emit("settings-changed", &settings);

    Ok(())
}

#[tauri::command]
fn set_widget_size(app: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    let clamped_w = width.clamp(200, 450);
    let clamped_h = height.clamp(54, 140);

    let window = widget_window(&app)?;
    window
        .set_size(Size::Logical(LogicalSize::new(
            clamped_w as f64,
            clamped_h as f64,
        )))
        .map_err(|e| e.to_string())?;

    let mut settings = load_settings_internal(&app);
    settings.widget_width = clamped_w;
    settings.widget_height = clamped_h;

    if clamped_w == 216 && clamped_h == 56 {
        settings.widget_size_preset = "compact".to_string();
    } else if clamped_w == 254 && clamped_h == 70 {
        settings.widget_size_preset = "standard".to_string();
    } else if clamped_w == 300 && clamped_h == 86 {
        settings.widget_size_preset = "expanded".to_string();
    } else {
        settings.widget_size_preset = "custom".to_string();
    }

    save_settings_internal(&app, &settings)?;
    let _ = app.emit("settings-changed", &settings);

    // Keep window clamped within work area after resizing
    let _ = restore_widget_position(app);

    Ok(())
}

#[tauri::command]
fn set_widget_always_on_top(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = widget_window(&app)?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())?;

    let mut settings = load_settings_internal(&app);
    settings.always_on_top = always_on_top;
    save_settings_internal(&app, &settings)?;
    let _ = app.emit("settings-changed", &settings);

    Ok(())
}

#[tauri::command]
async fn show_settings_window(app: tauri::AppHandle, page: Option<String>) -> Result<(), String> {
    show_or_create_settings_and_about(&app, page.as_deref());
    Ok(())
}

#[tauri::command]
async fn show_calendar_window(app: tauri::AppHandle) -> Result<(), String> {
    show_or_create_calendar(&app);
    Ok(())
}

#[tauri::command]
fn show_widget_context_menu(app: tauri::AppHandle, window: tauri::Window) -> Result<(), String> {
    let calendar_i = MenuItem::with_id(&app, "open_calendar", "Open Calendar", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let settings_i = MenuItem::with_id(&app, "open_settings", "Settings & Preferences...", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep1 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    let size_compact = MenuItem::with_id(&app, "size_compact", "Size: Compact (216×56)", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let size_standard = MenuItem::with_id(&app, "size_standard", "Size: Standard (254×70)", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let size_expanded = MenuItem::with_id(&app, "size_expanded", "Size: Expanded (300×86)", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep2 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    let snap_i = MenuItem::with_id(&app, "snap_widget", "Snap to Corner", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let reset_pos_i = MenuItem::with_id(&app, "reset_position", "Reset to Bottom-Right (Clock)", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep3 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    let about_i = MenuItem::with_id(&app, "open_about", "About & Legal...", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep4 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;

    let hide_i = MenuItem::with_id(&app, "hide_widget", "Hide Widget (Tray Only)", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit_i = MenuItem::with_id(&app, "quit", "Exit Mero Desktop Patro", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    let menu = Menu::with_items(
        &app,
        &[
            &calendar_i,
            &settings_i,
            &sep1,
            &size_compact,
            &size_standard,
            &size_expanded,
            &sep2,
            &snap_i,
            &reset_pos_i,
            &sep3,
            &about_i,
            &sep4,
            &hide_i,
            &quit_i,
        ],
    ).map_err(|e| e.to_string())?;

    menu.popup(window).map_err(|e| e.to_string())?;

    Ok(())
}

fn show_or_create_calendar(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("calendar") {
        if let Some(icon) = get_app_icon() {
            let _ = window.set_icon(icon);
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let builder = tauri::WebviewWindowBuilder::new(
            app,
            "calendar",
            tauri::WebviewUrl::App("calendar.html".into()),
        )
        .title("Mero Desktop Patro - Calendar")
        .inner_size(680.0, 740.0)
        .min_inner_size(560.0, 620.0)
        .center()
        .decorations(true)
        .resizable(true)
        .visible(true);

        if let Ok(w) = builder.build() {
            if let Some(icon) = get_app_icon() {
                let _ = w.set_icon(icon);
            }
        }
    }
}

fn show_or_create_settings_and_about(app: &tauri::AppHandle, page: Option<&str>) {
    let target_page = page.unwrap_or("system");

    if let Some(window) = app.get_webview_window("settings") {
        if let Some(icon) = get_app_icon() {
            let _ = window.set_icon(icon);
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("navigate-to-page", target_page);
    } else {
        let url = format!("settings.html?tab={}", target_page);
        let builder = tauri::WebviewWindowBuilder::new(
            app,
            "settings",
            tauri::WebviewUrl::App(url.into()),
        )
        .title("Mero Desktop Patro - Settings & Information")
        .inner_size(880.0, 640.0)
        .min_inner_size(680.0, 500.0)
        .center()
        .decorations(true)
        .resizable(true)
        .visible(true);

        if let Ok(w) = builder.build() {
            if let Some(icon) = get_app_icon() {
                let _ = w.set_icon(icon);
            }
        }
    }
}

fn handle_menu_action(app: &tauri::AppHandle, id: &str) {
    match id {
        "quit" => {
            app.exit(0);
        }
        "toggle_widget" => {
            if let Some(w) = app.get_webview_window("main") {
                if w.is_visible().unwrap_or(true) {
                    let _ = w.hide();
                } else {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        }
        "hide_widget" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        "open_calendar" => {
            show_or_create_calendar(app);
        }
        "open_settings" => {
            show_or_create_settings_and_about(app, Some("system"));
        }
        "size_compact" => {
            let _ = set_widget_size(app.clone(), 216, 56);
        }
        "size_standard" => {
            let _ = set_widget_size(app.clone(), 254, 70);
        }
        "size_expanded" => {
            let _ = set_widget_size(app.clone(), 300, 86);
        }
        "snap_widget" => {
            let _ = snap_widget(app.clone());
        }
        "reset_position" => {
            let _ = reset_widget_position(app.clone());
        }
        "open_about" => {
            show_or_create_settings_and_about(app, Some("about"));
        }
        "toggle_autostart" => {
            use tauri_plugin_autostart::ManagerExt;
            let autolaunch = app.autolaunch();
            let is_on = autolaunch.is_enabled().unwrap_or(false);
            if is_on {
                let _ = autolaunch.disable();
            } else {
                let _ = autolaunch.enable();
            }
        }
        _ => {}
    }
}

fn setup_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);

    let toggle_i = MenuItem::with_id(app, "toggle_widget", "Toggle Widget", true, None::<&str>)?;
    let calendar_i = MenuItem::with_id(app, "open_calendar", "Open Calendar", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "open_settings", "Settings & Preferences...", true, None::<&str>)?;
    let snap_i = MenuItem::with_id(app, "snap_widget", "Snap Widget to Corner", true, None::<&str>)?;
    let reset_pos_i = MenuItem::with_id(app, "reset_position", "Reset to Bottom-Right (Clock)", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let autostart_i = CheckMenuItem::with_id(
        app,
        "toggle_autostart",
        "Start with Windows",
        true,
        autostart_enabled,
        None::<&str>,
    )?;
    let about_i = MenuItem::with_id(app, "open_about", "About & Legal...", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Exit Mero Desktop Patro", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_i,
            &calendar_i,
            &settings_i,
            &snap_i,
            &reset_pos_i,
            &sep1,
            &autostart_i,
            &about_i,
            &sep2,
            &quit_i,
        ],
    )?;

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Mero Desktop Patro")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_menu_action(app, event.id().as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(true) {
                        let _ = w.set_focus();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = get_app_icon() {
        tray_builder = tray_builder.icon(icon);
    } else if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            setup_tray(app.handle())?;
            if let Some(icon) = get_app_icon() {
                for (_label, window) in app.webview_windows() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            handle_menu_action(app, event.id().as_ref());
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "calendar" || label == "settings" {
                    api.prevent_close();
                    let _ = window.hide();
                } else if label == "main" {
                    let settings = load_settings_internal(window.app_handle());
                    if settings.close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            restore_widget_position,
            reset_widget_position,
            snap_widget,
            exit_app,
            show_widget_context_menu,
            is_autostart_enabled,
            set_autostart,
            get_app_settings,
            save_app_settings,
            set_widget_size,
            set_widget_always_on_top,
            show_settings_window,
            show_calendar_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mero Desktop Patro");
}
