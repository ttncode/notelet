pub mod storage;

use serde::Serialize;
use serde_json::{Map, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::{Update, UpdaterExt};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const MAIN_WINDOW: &str = "main";
const HIDDEN_ARG: &str = "--hidden";
const AUTOSTART_OFF_MARKER: &str = "autostart-off";
// How long the page gets to write pending edits before Quit or an update goes ahead anyway.
const FLUSH_TIMEOUT: Duration = Duration::from_secs(5);

enum Pending {
    Quit,
    /// Downloaded already, so only the install runs after the page has saved.
    Update(Box<Update>, Vec<u8>),
}

impl Pending {
    fn name(&self) -> &'static str {
        match self {
            Pending::Quit => "quit",
            Pending::Update(..) => "update",
        }
    }
}

#[derive(Default)]
struct AppState {
    storage_lock: Mutex<()>,
    pending: Mutex<Option<Pending>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadResponse {
    data: Map<String, Value>,
    recovered: Option<&'static str>,
    damaged_path: Option<String>,
}

#[derive(Clone, Serialize)]
struct FlushRequest {
    then: &'static str,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

#[tauri::command]
fn storage_load(app: AppHandle, state: State<AppState>) -> Result<LoadResponse, String> {
    let _guard = state.storage_lock.lock().map_err(|error| error.to_string())?;
    let loaded = storage::load(&data_dir(&app)?).map_err(|error| error.to_string())?;
    Ok(LoadResponse {
        data: loaded.data,
        recovered: loaded.recovered,
        damaged_path: loaded.damaged_path.map(|path| path.display().to_string()),
    })
}

#[tauri::command]
fn storage_save(app: AppHandle, state: State<AppState>, data: Map<String, Value>) -> Result<(), String> {
    let _guard = state.storage_lock.lock().map_err(|error| error.to_string())?;
    storage::save(&data_dir(&app)?, &data).map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_maximize(window: WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|error| error.to_string())?;
    let result = if maximized { window.unmaximize() } else { window.maximize() };
    result.map_err(|error| error.to_string())
}

#[tauri::command]
fn after_flush(app: AppHandle, then: String) {
    run_pending(&app, &then);
}

/// Native Save dialog for a backup. `Ok(false)` when the user cancels.
#[tauri::command]
async fn save_backup(app: AppHandle, file_name: String, text: String) -> Result<bool, String> {
    let mut dialog = app.dialog().file().set_file_name(&file_name).add_filter("Notelet backup", &["json"]);
    if let Ok(downloads) = app.path().download_dir() {
        dialog = dialog.set_directory(downloads);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = chosen.into_path().map_err(|error| error.to_string())?;
    std::fs::write(path, text).map_err(|error| error.to_string())?;
    Ok(true)
}

fn window_state_flags() -> StateFlags {
    StateFlags::all() - StateFlags::VISIBLE
}

fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else { return };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

fn hide_main(app: &AppHandle) {
    let _ = app.save_window_state(window_state_flags());
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
}

/// Asks the page to write pending edits, then quits or updates once it answers or the timeout
/// passes, whichever comes first.
fn request_after_flush(app: &AppHandle, pending: Pending) {
    let then = pending.name();
    if let Ok(mut slot) = app.state::<AppState>().pending.lock() {
        *slot = Some(pending);
    }
    let _ = app.emit("flush-request", FlushRequest { then });
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FLUSH_TIMEOUT);
        run_pending(&handle, then);
    });
}

/// `then` is the action the page saved for, or `"cancel"` when its save failed: the pending
/// action is dropped and the window shown, so the unsaved text stays in front of the user.
fn run_pending(app: &AppHandle, then: &str) {
    let state = app.state::<AppState>();
    let pending = {
        let Ok(mut slot) = state.pending.lock() else { return };
        if then == "cancel" {
            slot.take();
            drop(slot);
            show_main(app);
            return;
        }
        if slot.as_ref().map(Pending::name) != Some(then) {
            return;
        }
        slot.take()
    };
    match pending {
        Some(Pending::Quit) => {
            let _ = app.save_window_state(window_state_flags());
            app.exit(0);
        }
        Some(Pending::Update(update, bytes)) => {
            let _ = app.save_window_state(window_state_flags());
            match update.install(bytes) {
                Ok(()) => app.restart(),
                Err(error) => show_message(app, format!("Couldn't install the update: {error}")),
            }
        }
        None => {}
    }
}

fn show_message(app: &AppHandle, text: String) {
    app.dialog().message(text).title("Notelet").show(|_| {});
}

fn ask_to_install(app: &AppHandle, version: &str) -> bool {
    app.dialog()
        .message(format!(
            "Notelet {version} is available (you have {}).\n\nDownload and install it now? Notelet restarts by itself.",
            app.package_info().version
        ))
        .title("Notelet")
        .buttons(MessageDialogButtons::OkCancelCustom("Install and restart".to_string(), "Later".to_string()))
        .blocking_show()
}

async fn check_for_update(app: AppHandle) {
    let result = match app.updater() {
        Ok(updater) => updater.check().await,
        Err(error) => Err(error),
    };
    match result {
        Ok(Some(update)) if !ask_to_install(&app, &update.version) => {}
        // Downloading first keeps the gap between the page's last save and the installer closing
        // the app to the install alone.
        Ok(Some(update)) => match update.download(|_, _| {}, || {}).await {
            Ok(bytes) => request_after_flush(&app, Pending::Update(Box::new(update), bytes)),
            Err(error) => show_message(&app, format!("Couldn't download the update: {error}")),
        },
        Ok(None) => show_message(&app, format!("Notelet {} is the latest version.", app.package_info().version)),
        Err(error) => show_message(&app, format!("Couldn't check for updates: {error}")),
    }
}

fn autostart_marker(app: &AppHandle) -> Option<PathBuf> {
    data_dir(app).ok().map(|dir| dir.join(AUTOSTART_OFF_MARKER))
}

/// Start with Windows is on unless the user turned it off from the tray, which leaves a marker file.
fn apply_autostart_choice(app: &AppHandle) -> bool {
    let turned_off = autostart_marker(app).is_some_and(|marker| marker.exists());
    if !turned_off {
        let _ = app.autolaunch().enable();
    }
    !turned_off
}

fn set_autostart(app: &AppHandle, enabled: bool) {
    let Some(marker) = autostart_marker(app) else { return };
    if enabled {
        let _ = std::fs::remove_file(&marker);
        let _ = app.autolaunch().enable();
    } else {
        if let Some(dir) = marker.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(&marker, b"");
        let _ = app.autolaunch().disable();
    }
}

fn build_tray(app: &AppHandle, autostart_on: bool) -> tauri::Result<()> {
    let version = MenuItem::with_id(app, "version", format!("Notelet {}", app.package_info().version), false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Notelet", true, None::<&str>)?;
    let check = MenuItem::with_id(app, "check-updates", "Check for updates", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(app, "autostart", "Start with Windows", true, autostart_on, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&version, &open, &check, &autostart, &separator, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Notelet")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "check-updates" => {
                tauri::async_runtime::spawn(check_for_update(app.clone()));
            }
            "autostart" => set_autostart(app, autostart.is_checked().unwrap_or(false)),
            "quit" => request_after_flush(app, Pending::Quit),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// WebView2's browser keys (F5, Ctrl+P, Ctrl+F find bar, Alt+arrows, …) would otherwise act
/// before Notelet's own shortcuts. Editing keys such as Ctrl+C and Ctrl+Z are not affected.
#[cfg(windows)]
fn disable_browser_keys(window: &WebviewWindow) {
    let _ = window.with_webview(|webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
        use windows_core::Interface;
        let Ok(core) = webview.controller().CoreWebView2() else { return };
        let Ok(settings) = core.Settings() else { return };
        if let Ok(settings) = settings.cast::<ICoreWebView2Settings3>() {
            let _ = settings.SetAreBrowserAcceleratorKeysEnabled(false);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first, as the plugin requires: a second launch only brings the window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])))
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(window_state_flags()).build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            storage_load,
            storage_save,
            toggle_maximize,
            after_flush,
            save_backup
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                hide_main(window.app_handle());
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let autostart_on = apply_autostart_choice(&handle);
            build_tray(&handle, autostart_on)?;
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                disable_browser_keys(&window);
            }
            if !std::env::args().any(|arg| arg == HIDDEN_ARG) {
                show_main(&handle);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Notelet");
}
