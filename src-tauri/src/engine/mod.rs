//! Orchestrates capture → DSP → IPC throttling.

pub mod meter_pipeline;
pub mod scheduler;

pub use meter_pipeline::MeterPipeline;
