import argparse
import json
import math

import numpy as np
from scipy import signal


POINT_COUNT = 256
EPSILON = 1e-12
SMOOTHING_WIDTH = 2 ** (1 / 24)


def main() -> None:
    args = parse_args()
    recording = np.fromfile(args.recording, dtype=np.float32)
    sweep = np.fromfile(args.sweep, dtype=np.float32)

    sweep_start_sample = locate_sweep_start(recording, sweep)
    aligned_recording = recording[sweep_start_sample:]
    fft_size = next_power_of_two(max(len(sweep), len(aligned_recording)))

    source_fft = np.fft.rfft(sweep, n=fft_size)
    recording_fft = np.fft.rfft(aligned_recording, n=fft_size)
    response_fft = recording_fft / (source_fft + EPSILON)

    result = {
        "sampleRate": args.sample_rate,
        "sweepStartSample": sweep_start_sample,
        "latencyMs": ((sweep_start_sample - args.pre_roll_samples) / args.sample_rate)
        * 1000.0,
        "recordingLengthSeconds": len(recording) / args.sample_rate,
        "peakDbfs": calculate_peak_dbfs(aligned_recording),
        "rmsDbfs": calculate_rms_dbfs(aligned_recording),
        "points": build_measurement_points(
            response_fft,
            args.sample_rate,
            fft_size,
            args.start_frequency,
            args.end_frequency,
        ),
    }

    print(json.dumps(result))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recording", required=True)
    parser.add_argument("--sweep", required=True)
    parser.add_argument("--sample-rate", type=float, required=True)
    parser.add_argument("--pre-roll-samples", type=float, required=True)
    parser.add_argument("--start-frequency", type=float, required=True)
    parser.add_argument("--end-frequency", type=float, required=True)
    return parser.parse_args()


def locate_sweep_start(recording: np.ndarray, sweep: np.ndarray) -> int:
    if len(recording) <= len(sweep):
        return 0

    correlation = signal.correlate(recording, sweep, mode="valid", method="fft")
    return int(np.argmax(correlation))


def next_power_of_two(value: int) -> int:
    size = 1
    while size < max(1, value):
        size <<= 1
    return size


def build_measurement_points(
    response_fft: np.ndarray,
    sample_rate: float,
    fft_size: int,
    start_frequency: float,
    end_frequency: float,
) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    bin_width = sample_rate / fft_size
    highest_bin = len(response_fft) - 1
    effective_end_frequency = min(end_frequency * 0.97, sample_rate * 0.45)

    for point_index in range(POINT_COUNT):
        position = point_index / (POINT_COUNT - 1)
        frequency_hz = start_frequency * math.pow(
            effective_end_frequency / start_frequency,
            position,
        )
        center_bin = clamp(round(frequency_hz / bin_width), 1, highest_bin)
        magnitude = abs(response_fft[center_bin])
        low_bin = clamp(
            math.floor((frequency_hz / SMOOTHING_WIDTH) / bin_width),
            1,
            highest_bin,
        )
        high_bin = clamp(
            math.ceil((frequency_hz * SMOOTHING_WIDTH) / bin_width),
            1,
            highest_bin,
        )
        smoothed_slice = response_fft[low_bin : high_bin + 1]
        power = np.abs(smoothed_slice) ** 2
        smoothed_complex = np.sum(smoothed_slice)

        points.append(
            {
                "frequencyHz": frequency_hz,
                "magnitudeDbRelative": 20 * math.log10(float(magnitude) + EPSILON),
                "phaseDegrees": math.degrees(np.angle(response_fft[center_bin])),
                "smoothedMagnitudeDbRelative": 10
                * math.log10(float(np.mean(power)) + 1e-18),
                "smoothedPhaseDegrees": math.degrees(np.angle(smoothed_complex)),
            }
        )

    return points


def calculate_peak_dbfs(samples: np.ndarray) -> float:
    peak = float(np.max(np.abs(samples))) if len(samples) else 0.0
    return 20 * math.log10(peak + EPSILON)


def calculate_rms_dbfs(samples: np.ndarray) -> float:
    rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
    return 20 * math.log10(rms + EPSILON)


def clamp(value: int, minimum: int, maximum: int) -> int:
    return min(maximum, max(minimum, value))


if __name__ == "__main__":
    main()
