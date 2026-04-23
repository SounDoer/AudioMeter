mod audio;
mod dsp;
mod engine;
mod ipc;
mod state;

use std::time::Duration;

use tauri::Emitter;

pub use audio::{AudioCapture, AudioCaptureSession, CpalBackend, DeviceInfo, PcmFrame};

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      ipc::commands::list_audio_devices,
      ipc::commands::audio_start,
      ipc::commands::audio_stop,
      ipc::commands::clear_audio_history,
      ipc::commands::get_meter_history,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let handle = app.handle().clone();
      std::thread::Builder::new()
        .name("audiometer-device-watch".into())
        .spawn(move || {
          let mut prev: Option<Vec<crate::audio::DeviceInfo>> = None;
          loop {
            std::thread::sleep(Duration::from_secs(2));
            if let Ok(list) = crate::audio::CpalBackend.list_devices() {
              if prev.as_ref() != Some(&list) {
                prev = Some(list.clone());
                let _ = handle.emit("device-list-changed", list);
              }
            }
          }
        })
        .map_err(|e| format!("device watch thread: {e}"))?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
