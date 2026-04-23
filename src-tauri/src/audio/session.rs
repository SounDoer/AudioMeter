//! cpal capture: WASAPI **output** endpoints use `build_input_stream` → loopback; **input** endpoints are microphones, etc.
//! See cpal WASAPI note: render device + input stream ⇒ `AUDCLNT_STREAMFLAGS_LOOPBACK`.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::thread::JoinHandle;

use super::device::DeviceInfo;

fn is_name_heuristic_loopback(name: &str) -> bool {
  let n = name.to_lowercase();
  n.contains("loopback")
    || n.contains("stereo mix")
    || n.contains("what u hear")
    || n.contains("立体声混音")
}

fn collect_outputs() -> Result<Vec<(usize, cpal::Device, cpal::SupportedStreamConfig)>, String> {
  let host = cpal::default_host();
  let mut rows = Vec::new();
  for (idx, device) in host
    .output_devices()
    .map_err(|e| e.to_string())?
    .enumerate()
  {
    if let Ok(cfg) = device.default_output_config() {
      rows.push((idx, device, cfg));
    }
  }
  rows.sort_by(|a, b| {
    let na = a.1.name().unwrap_or_default();
    let nb = b.1.name().unwrap_or_default();
    na.to_lowercase().cmp(&nb.to_lowercase())
  });
  Ok(rows)
}

fn collect_inputs() -> Result<Vec<(usize, cpal::Device, cpal::SupportedStreamConfig)>, String> {
  let host = cpal::default_host();
  let mut rows = Vec::new();
  for (idx, device) in host
    .input_devices()
    .map_err(|e| e.to_string())?
    .enumerate()
  {
    if let Ok(cfg) = device.default_input_config() {
      rows.push((idx, device, cfg));
    }
  }
  rows.sort_by(|a, b| {
    let na = a.1.name().unwrap_or_default();
    let nb = b.1.name().unwrap_or_default();
    na.to_lowercase().cmp(&nb.to_lowercase())
  });
  Ok(rows)
}

fn pick_output_by_index(target: usize) -> Result<(cpal::Device, cpal::SupportedStreamConfig), String> {
  let host = cpal::default_host();
  for (idx, device) in host
    .output_devices()
    .map_err(|e| e.to_string())?
    .enumerate()
  {
    if idx != target {
      continue;
    }
    let cfg = device
      .default_output_config()
      .map_err(|e| format!("{e} (output index {target})"))?;
    return Ok((device, cfg));
  }
  Err(format!("Output device index not found: {target}"))
}

fn pick_input_by_index(target: usize) -> Result<(cpal::Device, cpal::SupportedStreamConfig), String> {
  let host = cpal::default_host();
  for (idx, device) in host
    .input_devices()
    .map_err(|e| e.to_string())?
    .enumerate()
  {
    if idx != target {
      continue;
    }
    let cfg = device
      .default_input_config()
      .map_err(|e| format!("{e} (input index {target})"))?;
    return Ok((device, cfg));
  }
  Err(format!("Input device index not found: {target}"))
}

/// All selectable sources: system **outputs** (loopback monitor) first, then **inputs** (mics, line, virtual cable capture, …).
pub fn build_device_list() -> Result<Vec<DeviceInfo>, String> {
  let mut out = Vec::new();

  for (idx, device, cfg) in collect_outputs()? {
    let label = device.name().map_err(|e| e.to_string())?;
    out.push(DeviceInfo {
      id: format!("out:{idx}"),
      label,
      is_system_output_monitor: true,
      is_loopback: true,
      default_sample_rate: cfg.sample_rate().0,
      channels: cfg.channels(),
    });
  }

  for (idx, device, cfg) in collect_inputs()? {
    let label = device.name().map_err(|e| e.to_string())?;
    let is_loopback = is_name_heuristic_loopback(&label);
    out.push(DeviceInfo {
      id: format!("in:{idx}"),
      label,
      is_system_output_monitor: false,
      is_loopback,
      default_sample_rate: cfg.sample_rate().0,
      channels: cfg.channels(),
    });
  }

  Ok(out)
}

fn resolve_default_output() -> Result<(cpal::Device, cpal::SupportedStreamConfig), String> {
  let host = cpal::default_host();
  if let Some(def) = host.default_output_device() {
    let def_name = def.name().map_err(|e| e.to_string())?;
    for (_, device) in host
      .output_devices()
      .map_err(|e| e.to_string())?
      .enumerate()
    {
      let Ok(name) = device.name() else {
        continue;
      };
      if name == def_name {
        let cfg = device
          .default_output_config()
          .map_err(|e| format!("default output format: {e}"))?;
        return Ok((device, cfg));
      }
    }
  }
  let host = cpal::default_host();
  for (_, device) in host
    .output_devices()
    .map_err(|e| e.to_string())?
    .enumerate()
  {
    if let Ok(cfg) = device.default_output_config() {
      return Ok((device, cfg));
    }
  }
  // No render endpoints (e.g. some headless CI): fall back to first capture device.
  pick_input_by_index(0)
}

fn resolve_device(device_id: &str) -> Result<(cpal::Device, cpal::SupportedStreamConfig), String> {
  if device_id.is_empty() || device_id == "default" {
    return resolve_default_output();
  }

  if let Some(rest) = device_id.strip_prefix("out:") {
    let n: usize = rest
      .parse()
      .map_err(|_| format!("Invalid device id: {device_id}"))?;
    return pick_output_by_index(n);
  }

  if let Some(rest) = device_id.strip_prefix("in:") {
    let n: usize = rest
      .parse()
      .map_err(|_| format!("Invalid device id: {device_id}"))?;
    return pick_input_by_index(n);
  }

  Err(format!("Unknown device id: {device_id}"))
}

fn pack_pcm_chunk(sample_rate: u32, channels: u16, samples: &[f32]) -> Vec<u8> {
  let ch = channels.max(1) as usize;
  let frame_count = (samples.len() / ch) as u32;
  let mut v = Vec::with_capacity(12 + samples.len() * 4);
  v.extend_from_slice(&sample_rate.to_le_bytes());
  v.extend_from_slice(&channels.to_le_bytes());
  v.extend_from_slice(&0u16.to_le_bytes());
  v.extend_from_slice(&frame_count.to_le_bytes());
  for s in samples {
    v.extend_from_slice(&s.to_le_bytes());
  }
  v
}

fn run_capture_worker(
  device: cpal::Device,
  supported: cpal::SupportedStreamConfig,
  on_pcm: tauri::ipc::Channel<Vec<u8>>,
  stop_rx: std::sync::mpsc::Receiver<()>,
) -> Result<(), String> {
  let sample_rate = supported.sample_rate().0;
  let channels = supported.channels();
  let stream_config = StreamConfig {
    channels,
    sample_rate: supported.sample_rate(),
    buffer_size: cpal::BufferSize::Default,
  };

  // Large enough that brief JS stalls do not drop realtime audio (bridge may block on IPC).
  let (audio_tx, audio_rx) = std::sync::mpsc::sync_channel::<Vec<u8>>(256);
  let pcm_ch = on_pcm;

  let bridge = std::thread::spawn(move || {
    while let Ok(chunk) = audio_rx.recv() {
      if pcm_ch.send(chunk).is_err() {
        break;
      }
    }
  });

  let stream = match supported.sample_format() {
    SampleFormat::F32 => {
      let tx = audio_tx.clone();
      device
        .build_input_stream(
          &stream_config,
          move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let packed = pack_pcm_chunk(sample_rate, channels, data);
            let _ = tx.try_send(packed);
          },
          |e| log::error!("cpal stream error: {e}"),
          None,
        )
        .map_err(|e| e.to_string())?
    }
    SampleFormat::I16 => {
      let tx = audio_tx.clone();
      device
        .build_input_stream(
          &stream_config,
          move |data: &[i16], _: &cpal::InputCallbackInfo| {
            let floats: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
            let packed = pack_pcm_chunk(sample_rate, channels, &floats);
            let _ = tx.try_send(packed);
          },
          |e| log::error!("cpal stream error: {e}"),
          None,
        )
        .map_err(|e| e.to_string())?
    }
    SampleFormat::U16 => {
      let tx = audio_tx.clone();
      device
        .build_input_stream(
          &stream_config,
          move |data: &[u16], _: &cpal::InputCallbackInfo| {
            let floats: Vec<f32> = data
              .iter()
              .map(|&s| (s as f32 / 32768.0) - 1.0)
              .collect();
            let packed = pack_pcm_chunk(sample_rate, channels, &floats);
            let _ = tx.try_send(packed);
          },
          |e| log::error!("cpal stream error: {e}"),
          None,
        )
        .map_err(|e| e.to_string())?
    }
    f => {
      return Err(format!("Unsupported sample format: {f:?}"));
    }
  };

  stream.play().map_err(|e| e.to_string())?;

  let _ = stop_rx.recv();
  drop(stream);
  drop(audio_tx);
  let _ = bridge.join();
  Ok(())
}

pub struct CaptureSession {
  stop_tx: std::sync::mpsc::Sender<()>,
  join: Option<JoinHandle<Result<(), String>>>,
}

impl Drop for CaptureSession {
  fn drop(&mut self) {
    let _ = self.stop_tx.send(());
    if let Some(j) = self.join.take() {
      let _ = j.join();
    }
  }
}

impl CaptureSession {
  pub fn start(device_id: &str, on_pcm: tauri::ipc::Channel<Vec<u8>>) -> Result<Self, String> {
    let (device, supported) = resolve_device(device_id)?;
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();

    let join = std::thread::Builder::new()
      .name("audiometer-capture".into())
      .spawn(move || run_capture_worker(device, supported, on_pcm, stop_rx))
      .map_err(|e| e.to_string())?;

    Ok(CaptureSession {
      stop_tx,
      join: Some(join),
    })
  }
}
