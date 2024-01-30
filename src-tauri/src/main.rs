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
use sysinfo::{Components, CpuRefreshKind, Disks, Networks, RefreshKind, System};
use tokio::main;

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

// num_cpus: usize,
// cpus: Vec<f32>,

// #[derive(Debug)]
// struct CpuInfo {
//     // 여기에 CPU 정보에 대한 필드들을 추가
//     usage_percent: f32,  // 예시로 사용률을 저장하는 필드를 추가
// }

#[derive(Debug)]
struct LoadAverage {
    one_minute: f64,
    five_minutes: f64,
    fifteen_minutes: f64,
}

// Convert u64 to String for total_memory field
fn convert_to_string(value: u64) -> String {
    value.to_string()
}
const MHZ_TO_HZ: u64 = 1000000;
const KHZ_TO_HZ: u64 = 1000;

#[tauri::command(async)]
async fn get_system_info() -> Option<String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let disks = Disks::new_with_refreshed_list();
    let load_avg = System::load_average();

    let system_info = SystemInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_storage: disks.list().first()?.total_space(),
        used_storage: disks.list().first()?.total_space() - disks.list().first()?.available_space(),
        cpu_percent: load_avg.one,
    };

    // Display system information:
    println!("System name:             {:?}", System::name());
    println!("System kernel version:   {:?}", System::kernel_version());
    println!("System OS version:       {:?}", System::os_version());
    println!("System host name:        {:?}", System::host_name());

    // println!("{:?}", load_avg.one);
    // println!("[{:?}]", disks.list().first()?.available_space());
    // println!("[{:?}]", disks.list().first()?.total_space());

    // num_cpus: sys.cpus().len(),
    // cpus: sys.cpus().iter().map(|cpu| cpu.cpu_usage()).collect(),

    // println!("haha[{:?}]", sys.cpus());

    // let cpuid = CpuId::new();

    // if let Some(vf) = cpuid.get_vendor_info() {
    //     assert!(vf.as_str() == "GenuineIntel" || vf.as_str() == "AuthenticAMD");
    // }

    // let has_sse = cpuid
    //     .get_feature_info()
    //     .map_or(false, |finfo| finfo.has_sse());
    // if has_sse {
    //     println!("CPU supports SSE!");
    // }

    // if let Some(cparams) = cpuid.get_cache_parameters() {
    //     for cache in cparams {
    //         let size = cache.associativity()
    //             * cache.physical_line_partitions()
    //             * cache.coherency_line_size()
    //             * cache.sets();
    //         println!("L{}-Cache size is {}", cache.level(), size);
    //     }
    // } else {
    //     println!("No cache parameter information available")
    // }

    // // Print vendor information
    // if let Some(vendor_info) = cpuid.get_vendor_info() {
    //     println!("Vendor: {:?}", vendor_info);
    // } else {
    //     println!("Failed to retrieve vendor information");
    // }

    // // Print processor brand string
    // if let Some(brand_string) = cpuid.get_processor_brand_string() {
    //     println!("Processor Brand String: {:?}", brand_string.as_str());
    // } else {
    //     println!("Failed to retrieve processor brand string");
    // }

    // let cpuid = raw_cpuid::CpuId::new();

    // let has_tsc = cpuid
    //     .get_feature_info()
    //     .map_or(false, |finfo| finfo.has_tsc());

    // let has_invariant_tsc = cpuid
    //     .get_advanced_power_mgmt_info()
    //     .map_or(false, |efinfo| efinfo.has_invariant_tsc());

    // let tsc_frequency_hz = cpuid.get_tsc_info().map(|tinfo| {
    //     if tinfo.nominal_frequency() != 0 {
    //         tinfo.tsc_frequency()
    //     } else if tinfo.numerator() != 0 && tinfo.denominator() != 0 {
    //         // Skylake and Kabylake don't report the crystal clock, approximate with base frequency:
    //         cpuid
    //             .get_processor_frequency_info()
    //             .map(|pinfo| pinfo.processor_base_frequency() as u64 * MHZ_TO_HZ)
    //             .map(|cpu_base_freq_hz| {
    //                 let crystal_hz =
    //                     cpu_base_freq_hz * tinfo.denominator() as u64 / tinfo.numerator() as u64;
    //                 crystal_hz * tinfo.numerator() as u64 / tinfo.denominator() as u64
    //             })
    //     } else {
    //         None
    //     }
    // });

    // println!("Processor Brand String: {:?}", has_tsc);
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

    // // Print other CPU information
    // println!("Feature Info: {:?}", cpuid.get_feature_info());
    // println!("Cache Info: {:?}", cpuid.get_cache_info());
    // println!("Processor Serial: {:?}", cpuid.get_processor_serial());
    // println!("Cache Parameters: {:?}", cpuid.get_cache_parameters());
    // println!("Monitor/Mwait Info: {:?}", cpuid.get_monitor_mwait_info());
    // println!("Thermal/Power Info: {:?}", cpuid.get_thermal_power_info());
    // println!("Extended Features: {:?}", cpuid.get_extended_feature_info());
    // println!("Direct Cache Access Info: {:?}", cpuid.get_direct_cache_access_info());
    // println!("Performance Monitoring Info: {:?}", cpuid.get_performance_monitoring_info());
    // println!("Extended Topology Info: {:?}", cpuid.get_extended_topology_info());
    // println!("Extended Topology Info V2: {:?}", cpuid.get_extended_topology_info_v2());
    // println!("Extended State Info: {:?}", cpuid.get_extended_state_info());
    // println!("RDT Monitoring Info: {:?}", cpuid.get_rdt_monitoring_info());
    // println!("RDT Allocation Info: {:?}", cpuid.get_rdt_allocation_info());
    // println!("SGX Info: {:?}", cpuid.get_sgx_info());
    // println!("Processor Trace Info: {:?}", cpuid.get_processor_trace_info());
    // println!("TSC Info: {:?}", cpuid.get_tsc_info());
    // println!("Processor Frequency Info: {:?}", cpuid.get_processor_frequency_info());
    // println!("SoC Vendor Info: {:?}", cpuid.get_soc_vendor_info());
    // println!("DAT Info: {:?}", cpuid.get_deterministic_address_translation_info());
    // println!("Hypervisor Info: {:?}", cpuid.get_hypervisor_info());
    // println!("Extended Processor and Feature Identifiers: {:?}", cpuid.get_extended_processor_and_feature_identifiers());
    // println!("L1 Cache and TLB Info: {:?}", cpuid.get_l1_cache_and_tlb_info());
    // println!("L2/L3 Cache and TLB Info: {:?}", cpuid.get_l2_l3_cache_and_tlb_info());
    // println!("APM Info: {:?}", cpuid.get_advanced_power_mgmt_info());
    // println!("Processor Capacity and Feature Info: {:?}", cpuid.get_processor_capacity_feature_info());
    // println!("SVM Info: {:?}", cpuid.get_svm_info());
    // println!("TLB 1GB Page Info: {:?}", cpuid.get_tlb_1gb_page_info());
    // println!("Performance Optimization Info: {:?}", cpuid.get_performance_optimization_info());
    // println!("Processor Topology Info: {:?}", cpuid.get_processor_topology_info());
    // println!("Memory Encryption Info: {:?}", cpuid.get_memory_encryption_info());

    // println!("Physical core {:?}", cpuid.get_vendor_info());
    // println!("global cpu info {:?}",cpuid.get_processor_brand_string());

    let result = Some(format!("{:?}", system_info));
    if result.is_none() {
        eprintln!("Error: Result is None");
    }
    result
    // Some(format!("{:?}", system_info))
}
// println!("total memory: {:?} bytes", system_info);

// fn convert_to_string(value: u64) -> Option<String> {
//     // Convert u64 to String
//     let string_value = value.to_string();

//     // Wrap the string in Some to create an Option<String>
//     Some(string_value)
// }

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
            get_log_file_content,
            get_session,
            get_piData,
            get_NodeSessionData,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
