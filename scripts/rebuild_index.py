import sys
from pathlib import Path
from datetime import datetime

# Ensure project root is on sys.path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.wildai_pipeline.config import PipelineConfig
from src.wildai_pipeline.rag_engine import RAGEngine


if __name__ == '__main__':
    cfg = PipelineConfig()
    engine = RAGEngine(cfg)
    def report_progress(message: str) -> None:
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f'[{timestamp}] {message}', flush=True)

    report_progress('Building index...')
    res = engine.build_index(progress_callback=report_progress)
    print('Index build result:')
    print(res)
