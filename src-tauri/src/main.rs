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

use raw_cpuid::{CpuId, FeatureInfo};
use regex::Captures;
use regex::Regex;
use std::sync::Arc;
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, Pid, RefreshKind, System};
use tokio::main;

use sys_info_extended::{os_type, loadavg, get_graphics_info};


use std::process::Command;
use std::str;

#[tauri::command(async)]
async fn get_NodeSessionData() -> Option<String> {
    // Get the home directory
    let home_dir = dirs::home_dir().unwrap_or_default();

    // Build the path to the log file (first try "000003.log", then "000004.log")
    let log_filenames = ["000003.log", "000004.log"];
    let mut log_file_path = PathBuf::from(home_dir);
    log_file_path.push("AppData");
    log_file_path.push("Roaming");
    log_file_path.push("Pi Network");
    log_file_path.push("Local Storage");
    log_file_path.push("leveldb");

    // Find the first existing log file
    let log_file_path = log_filenames
        .iter()
        .filter_map(|filename| {
            let mut path = log_file_path.clone();
            path.push(filename);
            if path.exists() {
                Some(path)
            } else {
                None
            }
        })
        .next();

    if let Some(log_file_path) = log_file_path {
        if let Ok(file_content) = fs::read(&log_file_path) {
            // 파일 내용을 UTF-8로 디코딩
            let decoded_content = decode_windows_1252(&file_content);
            println!("{}", decoded_content);

            let session_key = extract_last_auth_token(&decoded_content);

            let result: &str = session_key.as_deref().unwrap_or("Default Value");

            // Define getNodeSession function or replace it with your actual implementation
            let node_session_result = getNodeSession(result).await;

            return node_session_result.ok();
        }
    }

    None
}

async fn getNodeSession(token: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().build()?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse()?);

    let request = client
        .request(
            reqwest::Method::GET,
            "https://socialchain.app/api/mining_sessions/status",
        )
        .headers(headers);

    let response = request.send().await?; // 비동기 호출

    // 패턴 매칭을 통한 결과 처리
    match response.text().await {
        Ok(body) => Ok(body),
        Err(e) => Err(Box::new(e)),
    }
}

#[derive(Debug)]
struct SystemInfo {
    total_memory: u64,
    used_memory: u64,
    total_storage: u64,
    used_storage: u64,
    cpu_percent: f64,
}

#[derive(Debug)]
struct StaticInfo {
    cpu_brd: String,
    cpu_freq: u64,
    core_number: usize,
    os_version: String,
    total_storage: u64,
    total_memory: u64,
    docker_version: String,
    docker_cpus: String
}


#[tauri::command(async)]
async fn get_static_info() -> Option<String> {

    // system module (universal)

    // disk, cpu, ram
    let mut sys = System::new();
    let disks = Disks::new_with_refreshed_list();

    let mut cpu_frequency = 0;
    let mut cpu_brand: String = String::new();

    sys.refresh_cpu();
    sys.refresh_memory();

    if let Some(cpu) = sys.cpus().get(1) {
        cpu_frequency = cpu.frequency();
        cpu_brand = cpu.brand().to_string();
    } else {
        println!("CPU not found.");
    }

    let os_version_option = System::long_os_version();

    let os_version = match os_version_option {
        Some(value) => value,
        None => String::new(),
    };

    // docker version, cpus, username, 연동상태 
    // let output = Command::new("docker")
    // .arg("version")
    // .output()
    // .expect("Failed to execute 'docker -v' command");

    // let docker_version = String::from_utf8(output.stdout).unwrap();
    
    // // 결과 출력
    // println!("Docker Version: {}", docker_version);
    
    let docker_cpus = match get_docker_cpus() {
        Ok(cpus_info) => cpus_info,
        Err(err) => err
    };

    let mut docker_cpus_number = "";

    if let Some(index) = docker_cpus.find(':') {
        docker_cpus_number = docker_cpus[index + 2..].trim();
        // println!("docker cpus: {}", docker_cpus_number);
    } else {
        // ":"가 없을 경우 에러 처리
        println!("Error: ':\"가 문자열에 없습니다.");
    }

    let docker_version = match get_docker_version() {
        Ok(version_info) => version_info,
        Err(err) => err,
    };

    let mut docker_version_number = "";

    if let Some(index) = docker_version.find(':') {
        docker_version_number = docker_version[index + 2..].trim();
        // println!("docker cpus: {}", docker_cpus_number);
    } else {
        // ":"가 없을 경우 에러 처리
        println!("Error: ':\"가 문자열에 없습니다.");
    }





    println!("Docker version: {:?}", docker_version_number);




    let static_info = StaticInfo {
        cpu_freq : cpu_frequency,
        cpu_brd: cpu_brand,
        core_number:  sys.cpus().len(),
        os_version: os_version,
        total_memory: sys.total_memory(),
        total_storage: disks.list().first()?.total_space(),
        docker_version: docker_version_number.to_string(),
        docker_cpus: docker_cpus_number.to_string()
    };

    let result = Some(format!("{:?}", static_info));

    if result.is_none() {
        eprintln!("Error: Result is None");
    }
    result



    // println!("output : {:?}", String::from_utf8(output.stdout));

    // let docker_version = String::from_utf8(output.stdout);
    // if output.status.success() {
    //     // 표준 출력을 문자열로 변환하여 출력
    //     if let Ok(result) = String::from_utf8(output.stdout) {
    //         println!("Docker version: {}", result.trim());
    //     } else {
    //         eprintln!("Failed to convert output to string");
    //     }
    // } else {
    //     // 에러 출력
    //     eprintln!("Command 'docker -v' failed with {:?}", output.status);
    // }
    
    // // CPU 사용률을 저장할 벡터
    // // let mut cpu_usages = Vec::new();

    // // CPU 사용률의 합을 저장할 변수
    // let mut total_usage = 0.0;

    // // CPU 개수를 저장할 변수
    // let mut cpu_count = 0;

    // for cpu in sys.cpus() {
    //     total_usage += cpu.cpu_usage();
    //     cpu_count += 1;
    // }

    // println!("{:?}", total_usage / cpu_count as f32);
    
    // x86 cpu module
    // let cpuid = CpuId::new();



    // let docker_cpus = match get_docker_cpus() {
    //     Ok(cpus_info) => cpus_info,
    //     Err(err) => err
    // };

    // println!("docker cpus : {:?}", docker_cpus);

    // Display system information:

    // println!("[{:?}]", disks.list().first()?.available_space());
    // println!("[{:?}]", disks.list().first()?.total_space());

    // num_cpus: sys.cpus().len(),
    // cpus: sys.cpus().iter().map(|cpu| cpu.cpu_usage()).collect(),

    // println!("haha[{:?}]", sys.cpus());

    // println!("Processor Brand String: has_tsc ß{:?}", has_tsc);
    // println!("Processor Brand String: {:?}", has_invariant_tsc);
    // println!("Processor Brand String: {:?}", tsc_frequency_hz);    

    // // Get the maximum number of logical processor IDs
    // if let Some(info) = cpuid.get_feature_info() {
    //     // let max_logical_processor_ids = 1 << info.max_logical_processor_ids();
    //     println!(
    //         "Max Logical Processor IDs: {}",
    //         info.max_logical_processor_ids()
    //     );
    // } else {
    //     println!("Failed to retrieve feature information");
    // }

    // println!("Physical core {:?}", cpuid.get_vendor_info());


}


#[tauri::command(async)]
async fn get_dynamic_info() -> Option<String> {

    // system module (universal)
    let mut sys = System::new();
    // disk, cpu, ram
    let disks = Disks::new_with_refreshed_list();
    // os
    let our_os_type = loadavg().unwrap();

    sys.refresh_memory();

    let system_info = SystemInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_storage: disks.list().first()?.total_space(),
        used_storage: disks.list().first()?.total_space() - disks.list().first()?.available_space(),
        cpu_percent: our_os_type.one * 100.0
    };

    let result = Some(format!("{:?}", system_info));

    if result.is_none() {
        eprintln!("Error: Result is None");
    }
    result

}

fn get_docker_version() -> Result<String, String> {
    // "docker version" 명령어를 실행하고 결과를 가져옵니다.
    let output = Command::new("docker")
        .arg("version")
        .output()
        .map_err(|_| "Failed to execute 'docker version'".to_string())?;

    // 명령어 실행이 성공한 경우에만 결과를 반환합니다.
    if output.status.success() {
        // 결과를 UTF-8 문자열로 변환하여 반환합니다.
        let version_str = str::from_utf8(&output.stdout)
            .map_err(|_| "Failed to convert to UTF-8".to_string())?;

        // 'Server:' 키워드를 포함하는 줄을 찾아서 해당 정보를 추출합니다.
        let server_line = version_str
            .lines()
            .find(|line| line.starts_with("Server:"))
            .map_or("", |line| line.trim());

        // 결과를 String으로 변환하여 반환합니다.
        Ok(server_line.to_string())
    } else {
        // 명령어 실행이 실패한 경우 에러 메시지를 반환합니다.
        Err(format!(
            "Error: {:?}\n{}",
            output.status,
            str::from_utf8(&output.stderr).unwrap_or("Failed to convert to UTF-8")
        ))
    }
}

fn get_docker_cpus() -> Result<String, String> {
    // "docker info" 명령어를 실행하고 결과를 가져옵니다.
    let output = Command::new("docker")
        .arg("info")
        .output()
        .map_err(|_| "Failed to execute 'docker info'".to_string())?;

    // 명령어 실행이 성공한 경우에만 결과를 반환합니다.
    if output.status.success() {
        // 결과를 UTF-8 문자열로 변환하여 반환합니다.
        let info_str = str::from_utf8(&output.stdout)
            .map_err(|_| "Failed to convert to UTF-8".to_string())?;

        // 'CPUs' 키워드를 포함하는 줄을 찾아서 CPU 정보를 추출합니다.
        let cpus_info: Vec<&str> = info_str
            .lines()
            .filter(|line| line.contains("CPUs"))
            .collect();

        // 결과를 String으로 변환하여 반환합니다.
        Ok(cpus_info.join("\n"))
    } else {
        // 명령어 실행이 실패한 경우 에러 메시지를 반환합니다.
        Err(format!(
            "Error: {:?}\n{}",
            output.status,
            str::from_utf8(&output.stderr).unwrap_or("Failed to convert to UTF-8")
        ))
    }
}


#[tauri::command(async)]
async fn get_piData() -> Option<String> {
    // Get the home directory
    let home_dir = dirs::home_dir().unwrap_or_default();

    // Build the path to the log file (first try "000003.log", then "000004.log")
    let log_filenames = ["000003.log", "000004.log"];
    let mut log_file_path = PathBuf::from(home_dir);
    log_file_path.push("AppData");
    log_file_path.push("Roaming");
    log_file_path.push("Pi Network");
    log_file_path.push("Local Storage");
    log_file_path.push("leveldb");

    // Find the first existing log file
    let log_file_path = log_filenames
        .iter()
        .filter_map(|filename| {
            let mut path = log_file_path.clone();
            path.push(filename);
            if path.exists() {
                Some(path)
            } else {
                None
            }
        })
        .next();

    // Read the contents of the log file
    if let Some(log_file_path) = log_file_path {
        if let Ok(file_content) = fs::read(&log_file_path) {
            // 파일 내용을 UTF-8로 디코딩
            let decoded_content = decode_windows_1252(&file_content);
            let session_key = extract_last_auth_token(&decoded_content);

            let result: &str = session_key.as_deref().unwrap_or("Default Value");

            // Define getPiBalance function or replace it with your actual implementation
            let balance = getPiBalance(result).await;

            return balance.ok();
        }
    }

    // Return an empty option if reading or decoding fails
    None
}

async fn getPiBalance(token: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().build()?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse()?);

    let request = client
        .request(reqwest::Method::GET, "https://socialchain.app/api/pi")
        .headers(headers);

    let response = request.send().await?; // 비동기 호출

    // 패턴 매칭을 통한 결과 처리
    match response.text().await {
        Ok(body) => Ok(body),
        Err(e) => Err(Box::new(e)),
    }
}

#[tauri::command(async)]
async fn get_session() -> Option<String> {
    // Get the home directory
    let home_dir = dirs::home_dir().unwrap_or_default();

    // Build the path to the log file (first try "000003.log", then "000004.log")
    let log_filenames = ["000003.log", "000004.log"];
    let mut log_file_path = PathBuf::from(home_dir);
    log_file_path.push("AppData");
    log_file_path.push("Roaming");
    log_file_path.push("Pi Network");
    log_file_path.push("Local Storage");
    log_file_path.push("leveldb");

    // Find the first existing log file
    let log_file_path = log_filenames
        .iter()
        .filter_map(|filename| {
            let mut path = log_file_path.clone();
            path.push(filename);
            if path.exists() {
                Some(path)
            } else {
                None
            }
        })
        .next();

    if let Some(log_file_path) = log_file_path {
        // Read the contents of the log file
        if let Ok(file_content) = fs::read(&log_file_path) {
            // Decode the file content using windows-1252
            let decoded_content = decode_windows_1252(&file_content);
            let session_key = extract_last_auth_token(&decoded_content);

            let result: &str = session_key.as_deref().unwrap_or("Default Value");

            return getUserInfo(result).await.ok();
        }
    }

    // Return None if no suitable log file is found or if reading or decoding fails
    None
}

async fn getUserInfo(token: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().build()?;
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", token).parse()?);

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

fn extract_last_auth_token(input_string: &str) -> Option<String> {
    let re = Regex::new(r"auth_token_storage_key,([^_]+)").unwrap();

    if let Some(mut last_index) = input_string.rfind("auth_token_storage_key,") {
        last_index += "auth_token_storage_key,".len();
        let result = &input_string[last_index..];
        let truncated_result = result.chars().take(43).collect::<String>();

        // println!("{}",truncated_result);
        return Some(truncated_result);
    }

    None
}

// Windows-1252 decoding function with removing specified characters
fn decode_windows_1252(data: &[u8]) -> String {
    let result = WINDOWS_1252.decode(data, DecoderTrap::Replace);
    match result {
        Ok(decoded) => {
            // Remove specific characters like \0x01, \0x02, etc.
            let cleaned_string: String = decoded
                .chars()
                .filter(|&c| c != '\x01' && c != '\x02')
                .collect();
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

#[tauri::command]
fn get_docker_exec() -> String {
    use std::process::Command;
    
    // Run the `docker exec` command to fetch Stellar Core info
    let output = Command::new("docker")
                         .args(&["exec", "pi-consensus", "stellar-core", "http-command", "info"])
                         .output()
                         .expect("Failed to execute command");
    
    // Convert the output to a string
    let output_str = String::from_utf8_lossy(&output.stdout);

    // Return the Stellar Core info
    output_str.to_string()
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

use tauri::Manager;

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

// for test
// #[tokio::main]
// async fn main() {
//     // get_NodeSessionData().await;
//     get_session().await;
// }

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

            app.emit_all("single-instance", Payload { args: argv, cwd })
                .unwrap();
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
        .invoke_handler(tauri::generate_handler![
            get_docker_exec,
            get_log_file_content,
            get_session,
            get_piData,
            get_NodeSessionData,
            get_dynamic_info,
            get_static_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}