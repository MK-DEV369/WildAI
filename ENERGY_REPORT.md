# WILDAI Tech Stack Energy Consumption Report

Grounded telemetry of execution times, hardware profiles, and energy consumption metrics on Windows.

## 💻 System Specifications

- **Operating System:** Windows 11 (v10.0.26200)
- **CPU Model:** AMD Ryzen 7 5800H with Radeon Graphics (TDP Config: 45W)
- **GPU Model:** NVIDIA GeForce RTX 3050 Laptop GPU
- **Physical Memory (RAM):** 15 GB

## ⚡ Telemetry Summary Table

| Task Name | Duration | Avg CPU Util | CPU Power (Est) | GPU Power (Meas) | Energy Consumed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FAISS Index Building & Encoding | 454.77s | 22.0% | 13.8W | 62.8W | 9.67292 Wh |
| Local LLM Chat (Ollama - llama3.2:3b) | 64.40s | 18.3% | 12.3W | 39.4W | 0.92524 Wh |
| Query Result Exporting (MD) | 274.69s | 10.8% | 9.3W | 25.0W | 2.62072 Wh |
| RAG Search & Synthesis Query | 0.59s | 5.8% | 7.3W | 20.4W | 0.00455 Wh |
| Web Scraping & Ingestion (Simulated) | 291.20s | 14.5% | 10.8W | 0.0W | 0.87360 Wh |

---

## 📝 Telemetry Log Guidelines
- **CPU power calculation:** $\text{Power}_{\text{CPU}} = 5.0 + 40.0 \times (\text{utilization}/100.0)$ Watts.
- **GPU power calculation:** Real-time polling via NVML / `nvidia-smi` sensors.
- **Energy calculation:** $\text{Energy (Wh)} = (\text{Avg Watts} \times \text{Duration in seconds}) / 3600$.

*Last updated: 2026-06-12 00:59:44 (IST)*