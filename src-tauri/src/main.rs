// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn get_log_file_content() -> Vec<String> {
    // // Get the home directory
    // let home_dir = dirs::home_dir().unwrap_or_default();

    // // Construct the path to the log file
    // let log_file_path = home_dir.join("Desktop").join("renderer.log");

    let home_dir = dirs::home_dir().unwrap_or_default();

    // Construct the path to the log file
    let mut log_file_path = PathBuf::new();
    log_file_path.push(home_dir);
    log_file_path.push("AppData");
    log_file_path.push("Roaming");
    log_file_path.push("Pi Network");
    log_file_path.push("logs");
    log_file_path.push("renderer.log");

    // Convert the path to a string
    let log_file_path_str = log_file_path.to_str().unwrap();

    println!("Log file path: {}", log_file_path_str);

    // Read the contents of the log file
    if let Ok(log_content) = fs::read_to_string(&log_file_path_str) {
        // Split the contents into lines
        let lines: Vec<String> = log_content.lines().map(String::from).collect();

        // Find the last SCP info entry
        let last_scp_info = find_last_scp_info(&lines);

        // Return the last SCP info
        match last_scp_info {
            Some(info) => info,
            None => Vec::new(),
        }
    } else {
        // Handle the case where reading the file fails
        Vec::new()
    }
}

fn find_last_scp_info(lines: &Vec<String>) -> Option<Vec<String>> {
    let mut log_entry = String::new();
    let mut inside_scp_lines = false;
    let mut last_scp_info: Option<Vec<String>> = None;

    for line in lines {
        if inside_scp_lines {
            log_entry += line;

            if line.contains('}') {
                inside_scp_lines = false;

                // Process log_entry as needed

                // Update last_scp_info with the processed log_entry
                last_scp_info = Some(vec![log_entry.clone()]);

                // Reset log_entry
                log_entry.clear();
            }
        } else if line.contains("SCP info: {") {
            log_entry = line.clone();
            inside_scp_lines = true;
        }
    }

    // Return the last processed SCP info or None if not found
    last_scp_info
}

use tauri::{CustomMenuItem, SystemTray, SystemTrayMenu};

fn main() {
    // here `"quit".to_string()` defines the menu item id, and the second parameter is the menu item label.
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let tray_menu = SystemTrayMenu::new().add_item(quit).add_item(hide);
    let tray = SystemTray::new().with_menu(tray_menu);

    use tauri::Manager;

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)] // 디버그 빌드에만 이 코드를 포함
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                event.window().hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![get_log_file_content])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
