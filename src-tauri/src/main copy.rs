// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use encoding::all::WINDOWS_1252;
use encoding::{DecoderTrap, Encoding};

use chrono::Duration;
use std::thread;

use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};

use std::sync::Arc;
use std::sync::Mutex;
use regex::Regex;
use regex::Captures;
use reqwest::blocking::Client;


#[tauri::command(async)]
// async fn get_session() -> Result<String, Box<dyn std::error::Error>> {
async fn get_session() -> Option<String> {
        // Get the home directory
    let home_dir = dirs::home_dir().unwrap_or_default();
    
    // Build the path to the log file
    let mut log_file_path = PathBuf::from(home_dir);
    log_file_path.push("AppData");
    log_file_path.push("Roaming");
    log_file_path.push("Pi Network");
    log_file_path.push("Local Storage");
    log_file_path.push("leveldb");
    log_file_path.push("000003.log");

    // Read the contents of the log file
    if let Ok(file_content) = fs::read(&log_file_path) {
        // 파일 내용을 UTF-8로 디코딩
        let decoded_content = decode_windows_1252(&file_content);
        // let res = getNodeInfo().await;

       return getNodeInfo().await.ok();
    }
    // Return an empty vector if reading or decoding fails
    None
}

async fn getNodeInfo() -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().build()?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "Authorization",
        "Bearer MNr3bzUd1BN8tBY8vlc0Dck8qKUQFQBabsQceovlZeM".parse()?,
    );

    let request = client
        .request(reqwest::Method::GET, "https://socialchain.app/api/me")
        .headers(headers);

    let response = request.send().await?; // 비동기 호출

    // 패턴 매칭을 통한 결과 처리
    match response.text().await {
        Ok(body) => Ok(body),
        Err(e) => Err(Box::new(e)),
    }
}


fn extract_last_auth_token(input_string: String) -> Option<String> {
    let re = Regex::new(r"mobile-app-webview-ui_access-token,([^_]+)").unwrap();
    
    // Find all matches and collect them into a vector
    let matches: Vec<String> = re
        .captures_iter(&input_string)
        .map(|captures| captures[1].trim().to_string())
        .collect();

    // Return the last match, if any
    matches.last().cloned()
}

// Windows-1252 decoding function with removing specified characters
fn decode_windows_1252(data: &[u8]) -> String {
    let result = WINDOWS_1252.decode(data, DecoderTrap::Replace);
    match result {
        Ok(decoded) => {
            // Remove specific characters like \0x01, \0x02, etc.
            let cleaned_string: String = decoded.chars().filter(|&c| c != '\x01' && c != '\x02').collect();
            cleaned_string
        }
        Err(err) => {
            eprintln!("Error decoding: {}", err);
            String::new()
        }
    }
}


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

// use tauri::{CustomMenuItem, SystemTray, SystemTrayMenu};

#[allow(dead_code)]
#[tauri::command]
fn init_process(window: tauri::Window) {
    std::thread::spawn(move || loop {
        window
            .emit(
                "beep",
                format!("beep: {}", chrono::Local::now().to_rfc3339()),
            )
            .unwrap();

        thread::sleep(Duration::seconds(5).to_std().unwrap());
    });
}

fn build_menu() -> SystemTrayMenu {
    let menuitem_quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let menuitem_show = CustomMenuItem::new("show".to_string(), "Show");
    SystemTrayMenu::new()
        .add_item(menuitem_show)
        .add_item(menuitem_quit)
}

use tauri::{Manager};

#[derive(Clone, serde::Serialize)]
struct Payload {
  args: Vec<String>,
  cwd: String,
}


fn main() {

    #[allow(clippy::mutex_integer)]
    let count = Arc::new(Mutex::new(0));

    let tray_menu = build_menu();

    // // here `"quit".to_string()` defines the menu item id, and the second parameter is the menu item label.
    // let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    // let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    // let tray_menu = SystemTrayMenu::new().add_item(quit).add_item(hide);
    // let tray = SystemTray::new().with_menu(tray_menu);

    use tauri::Manager;

    tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        println!("{}, {argv:?}, {cwd}", app.package_info().name);

        app.emit_all("single-instance", Payload { args: argv, cwd }).unwrap();
    }))
    .system_tray(SystemTray::new().with_menu(tray_menu))
    .on_system_tray_event(move |app, event| match event {
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            println!("system tray received a right click");
        }
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            println!("system tray received a double click");
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "quit" => {
                std::process::exit(0);
            }
            "show" => {
                let w = app.get_window("main").unwrap();
                w.show().unwrap();

                // because the window shows in a specific workspace and the user
                // can hide it and move to another, it will next show in the original
                // workspace it was opened in.
                // this is important for the window to always show in whatever workspace
                // the user moved to and is active in.
                w.set_focus().unwrap();
            }

            _ => {}
        },
        _ => {}
    })
    .on_window_event(|event| match event.event() {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            // don't kill the app when the user clicks close. this is important
            event.window().hide().unwrap();
            api.prevent_close();
        }
        _ => {}
    })
    .setup(|app| {
        // don't show on the taskbar/springboard
        // this is purely a personal taste thing
        #[cfg(target_os = "macos")]
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);

        let window = app.get_window("main").unwrap();

        // this is a workaround for the window to always show in current workspace.
        // see https://github.com/tauri-apps/tauri/issues/2801
        window.set_always_on_top(true).unwrap();

        // watch out! forever loop, every 5s emit an event
        // to the JS side, which has to subscribe on the event ID.
        std::thread::spawn(move || loop {
            window
                .emit(
                    "rs_js_emit",
                    format!("beep: {}", chrono::Local::now().to_rfc3339()),
                )
                .unwrap();
            println!("rs -> js emit");

            thread::sleep(Duration::seconds(5).to_std().unwrap());
        });
        Ok(())
    })
        .invoke_handler(tauri::generate_handler![get_log_file_content, get_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
