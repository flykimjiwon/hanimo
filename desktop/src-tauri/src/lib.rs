mod commands;
mod sidecar;

use sidecar::Sidecar;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Sidecar::new())
        .invoke_handler(tauri::generate_handler![
            commands::start_sidecar,
            commands::send_prompt,
            commands::stop_sidecar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
