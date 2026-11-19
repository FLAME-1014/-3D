# Performance Test Report

Status: **PASS — five-minute continuous mixed-hazard run**

- Date: 2026年11月18日 GMT+8 19:11:09; raw UTC timestamp: 2026-11-18T11:11:09.728Z
- Browser: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.4 Safari/537.36
- GPU: Google Inc. (AMD) / ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Logical processors: 16; device memory hint: 32
- Load: 300 steady seconds at 5× with flood, earthquake and typhoon changes every 30 seconds
- Samples: 30 steady ten-second windows after a separate ten-second warm-up window

| Metric | Steady-state result |
|---|---:|
| FPS median | 59.94 |
| FPS minimum / maximum | 59.15 / 59.94 |
| FPS P95 across windows | 59.94 |
| Frame-time P95 median | 16.80 ms |
| Frame-time P95 maximum | 16.80 ms |
| GPU geometries | 30–30 |
| GPU textures | 18–18 |
| Draw calls | 267–295 |
| Rapier bodies | 33–130 |
| Rapier colliders | 36–133 |
| JS heap range | 18.3–27.4 MB |
| Console / page errors | 0 |

Steady-state samples stayed above 30 FPS and below 100 ms P95 frame time. GPU geometry and texture counts remained stable after warm-up, simulated bodies stayed below the 185-body budget, and observed heap variation stayed below 128 MiB.

Results describe this workstation, Chrome build, driver, current scene and quality policy; other GPUs may produce different frame times.
