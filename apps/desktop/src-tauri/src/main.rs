// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Check if running as native messaging host
    if appsdesktop_lib::is_native_host_mode() {
        appsdesktop_lib::run_as_native_host();
    } else {
        appsdesktop_lib::run();
    }
}
