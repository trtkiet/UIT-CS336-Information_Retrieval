import glob
import logging
import multiprocessing
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

VIDEOS_DIR = "data/videos"
HLS_DIR = "data/hls_fast"

NUM_WORKERS = max(1, multiprocessing.cpu_count() - 4)

TARGET_HEIGHT = 360
CRF_VALUE = 30
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)


def convert_one_video(video_path):
    try:
        video_path = Path(video_path)
        video_id = video_path.stem

        output_dir = os.path.join(HLS_DIR, video_id)
        os.makedirs(output_dir, exist_ok=True)

        output_playlist = os.path.join(output_dir, "playlist.m3u8")

        if os.path.exists(output_playlist):
            return None  # Skip im lặng

        # CÔNG THỨC ULTRA FAST
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-c:v",
            "copy",
            "-crf",
            str(CRF_VALUE),
            "-c:a",
            "copy",
            # HLS
            "-f",
            "hls",
            "-hls_time",
            "2",
            "-hls_list_size",
            "0",
            "-hls_flags",
            "independent_segments",
            "-hls_segment_filename",
            f"{output_dir}/seg_%03d.ts",
            output_playlist,
        ]

        subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
        )
        return f"[DONE] {video_id}"

    except Exception as e:
        return f"[ERROR] {video_id}: {e}"


def main():
    if not os.path.exists(VIDEOS_DIR):
        logger.error(f"Không tìm thấy thư mục: {VIDEOS_DIR}")
        return

    os.makedirs(HLS_DIR, exist_ok=True)
    video_files = glob.glob(os.path.join(VIDEOS_DIR, "*.mp4"))

    if not video_files:
        logger.warning("Không tìm thấy file mp4!")
        return

    logger.info(f"--- BẮT ĐẦU CHẾ ĐỘ ULTRAFAST ---")
    logger.info(f"Số luồng xử lý song song: {NUM_WORKERS}")
    logger.info(f"Số video cần xử lý: {len(video_files)}")

    # Sử dụng ThreadPoolExecutor nhưng thực chất là gọi subprocess nên tận dụng tốt đa nhân
    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        results = executor.map(convert_one_video, video_files)

        count = 0
        for res in results:
            if res:
                logger.info(res)
                count += 1

    logger.info(f"--- HOÀN TẤT XỬ LÝ {count} VIDEO MỚI ---")


if __name__ == "__main__":
    main()
