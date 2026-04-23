//! cpal capture: WASAPI **output** endpoints use `build_input_stream` → loopback; **input** endpoints are microphones, etc.
//! See cpal WASAPI note: render device + input stream ⇒ `AUDCLNT_STREAMFLAGS_LOOPBACK`.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;

use super::device::DeviceInfo;

use crate::engine::MeterPipeline;
use crate::ipc::types::{AudioFramePayload, MeterHistoryBuf};
use tauri::Emitter;

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
    let name = device.name().map_err(|e| e.to_string())?;
    let label = format!("{name} — what's playing");
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
    for device in host.output_devices().map_err(|e| e.to_string())? {
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
  for device in host.output_devices().map_err(|e| e.to_string())? {
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

pub fn unpack_pcm_chunk(bytes: &[u8]) -> Option<(u32, u16, Vec<f32>)> {
  if bytes.len() < 12 {
    return None;
  }
  let sample_rate = u32::from_le_bytes(bytes[0..4].try_into().ok()?);
  let channels = u16::from_le_bytes(bytes[4..6].try_into().ok()?);
  let frame_count = u32::from_le_bytes(bytes[8..12].try_into().ok()?);
  let ch = channels.max(1) as usize;
  let need = 12usize.saturating_add(frame_count as usize * ch * 4);
  if bytes.len() < need {
    return None;
  }
  let mut v = Vec::with_capacity(frame_count as usize * ch);
  let off = 12usize;
  for i in 0..frame_count as usize * ch {
    let start = off + i * 4;
    v.push(f32::from_le_bytes(bytes.get(start..start + 4)?.try_into().ok()?));
  }
  Some((sample_rate, channels, v))
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

struct RunCaptureArgs {
  device: cpal::Device,
  supported: cpal::SupportedStreamConfig,
  sample_rate: u32,
  channels: u16,
  frame_tx: tauri::ipc::Channel<AudioFramePayload>,
  app: tauri::AppHandle,
  stop_rx: std::sync::mpsc::Receiver<()>,
  clear_peak_history: Arc<AtomicBool>,
  meter_history: MeterHistoryBuf,
}

fn run_capture_worker(args: RunCaptureArgs) -> Result<(), String> {
  let RunCaptureArgs {
    device,
    supported,
    sample_rate,
    channels,
    frame_tx,
    app,
    stop_rx,
    clear_peak_history,
    meter_history,
  } = args;
  let stream_config = StreamConfig {
    channels,
    sample_rate: supported.sample_rate(),
    buffer_size: cpal::BufferSize::Default,
  };

  let (audio_tx, audio_rx) = std::sync::mpsc::sync_channel::<Vec<u8>>(256);

  let bridge = std::thread::spawn(move || {
    let mut pipeline = MeterPipeline::new(sample_rate, channels, meter_history);
    while let Ok(chunk) = audio_rx.recv() {
      if clear_peak_history.load(Ordering::Acquire) {
        clear_peak_history.store(false, Ordering::Release);
        pipeline.clear_peak_and_history();
      }
      let Some((_sr, _ch, floats)) = unpack_pcm_chunk(&chunk) else {
        continue;
      };
      let (frame, slow) = pipeline.push_pcm_f32(&floats);
      if let Some(f) = frame {
        if frame_tx.send(f).is_err() {
          break;
        }
      }
      if let Some(s) = slow {
        let _ = app.emit("loudness-slow", &s);
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
  clear_peak_history: Arc<AtomicBool>,
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
  pub fn start(
    device_id: &str,
    frame_tx: tauri::ipc::Channel<AudioFramePayload>,
    app: tauri::AppHandle,
    meter_history: MeterHistoryBuf,
  ) -> Result<Self, String> {
    let (device, supported) = resolve_device(device_id)?;
    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels();
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let clear_peak_history = Arc::new(AtomicBool::new(false));
    let clear_worker = clear_peak_history.clone();

    let join = std::thread::Builder::new()
      .name("audiometer-capture".into())
      .spawn(move || {
        run_capture_worker(RunCaptureArgs {
          device,
          supported,
          sample_rate,
          channels,
          frame_tx,
          app,
          stop_rx,
          clear_peak_history: clear_worker,
          meter_history,
        })
      })
      .map_err(|e| e.to_string())?;

    Ok(CaptureSession {
      stop_tx,
      join: Some(join),
      clear_peak_history,
    })
  }

  pub fn request_clear_peak_history(&self) {
    self.clear_peak_history.store(true, Ordering::Release);
  }
}
