# WILDAI Tech Stack Energy Consumption Report

Grounded telemetry of execution times, hardware profiles, and energy consumption metrics on Windows.

## 💻 System Specifications

- **Operating System:** Windows 10 (v10.0.26200)
- **CPU Model:** 11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz (TDP Config: 45W)
- **GPU Model:** NVIDIA GeForce RTX 3070 Laptop GPU
- **Physical Memory (RAM):** 32 GB

## ⚡ Telemetry Summary Table

| Task Name | Duration | Avg CPU Util | CPU Power (Est) | GPU Power (Meas) | Energy Consumed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FAISS Index Building & Encoding | 3113.46s | 7.3% | 7.9W | 80.2W | 76.23102 Wh |
| Local LLM Chat (Ollama - llama3.2:3b) | 6.25s | 13.2% | 10.3W | 63.5W | 0.12795 Wh |
| Query Result Exporting (DOCX) | 0.36s | 0.0% | 5.0W | 54.7W | 0.00601 Wh |
| Query Result Exporting (MD) | 274.69s | 10.8% | 9.3W | 25.0W | 2.62072 Wh |
| Query Result Exporting (PDF) | 0.46s | 0.0% | 5.0W | 30.3W | 0.00449 Wh |
| RAG Custom Summary Synthesis | 19.86s | 15.6% | 11.2W | 96.3W | 0.59320 Wh |
| RAG Search & Synthesis Query | 0.35s | 0.0% | 5.0W | 26.0W | 0.00298 Wh |
| Web Scraping & Ingestion (Simulated) | 291.20s | 14.5% | 10.8W | 0.0W | 0.87360 Wh |

---

## 📝 Telemetry Log Guidelines
- **CPU power calculation:** $\text{Power}_{\text{CPU}} = 5.0 + 40.0 \times (\text{utilization}/100.0)$ Watts.
- **GPU power calculation:** Real-time polling via NVML / `nvidia-smi` sensors.
- **Energy calculation:** $\text{Energy (Wh)} = (\text{Avg Watts} \times \text{Duration in seconds}) / 3600$.

*Last updated: 2026-07-14 15:09:16 (IST)*