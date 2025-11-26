import os
import glob
import subprocess
import logging
import math
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

# --- CẤU HÌNH ---
VIDEOS_DIR = "data/videos"
SPRITES_DIR = "data/sprites"
NUM_WORKERS = 32 

# Cấu hình Sprite
THUMB_WIDTH = 160
GRID_COLS = 10
GRID_ROWS = 10
INTERVAL = 1  # Lấy mẫu 1 giây 1 frame (đây là chuẩn công nghiệp cho tooltip)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

def get_video_duration(video_path):
    """Lấy thời lượng video bằng ffprobe"""
    cmd = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path)
    ]
    try:
        output = subprocess.check_output(cmd).decode().strip()
        return float(output)
    except Exception:
        return 0.0

def generate_sprite_for_video(video_path):
    try:
        video_path = Path(video_path)
        video_id = video_path.stem
        output_dir = os.path.join(SPRITES_DIR, video_id)
        
        # Nếu đã có sprite rồi thì bỏ qua (hoặc check kỹ hơn nếu muốn)
        if os.path.exists(output_dir) and len(list(Path(output_dir).glob("*.jpg"))) > 0:
            return f"[SKIP] {video_id}"

        os.makedirs(output_dir, exist_ok=True)
        
        # Output pattern: sprite_001.jpg, sprite_002.jpg
        output_pattern = os.path.join(output_dir, "sprite_%03d.jpg")

        # --- LỆNH FFMPEG TỐI ƯU ---
        # 1. -hwaccel cuda: Dùng GPU để decode video (nhanh hơn CPU rất nhiều)
        # 2. fps=1: Lấy 1 frame mỗi giây
        # 3. scale=160:-1: Resize về width 160px
        # 4. tile=10x10: Ghép thành lưới 10 cột x 10 hàng
        
        cmd = [
            "ffmpeg", "-y",
            "-hwaccel", "cuda",           # Kích hoạt GPU (NVIDIA)
            "-hwaccel_output_format", "cuda",
            "-i", str(video_path),
            "-vf", 
            f"fps=1,scale_cuda={THUMB_WIDTH}:-2,hwdownload,format=nv12,tile={GRID_COLS}x{GRID_ROWS}",
            "-q:v", "5",                  # Chất lượng ảnh JPEG (2-5 là tốt)
            output_pattern
        ]

        # Fallback nếu không có GPU hoặc lỗi driver CUDA: Dùng CPU thuần
        # cmd_cpu = [
        #     "ffmpeg", "-y",
        #     "-i", str(video_path),
        #     "-vf", f"fps=1,scale={THUMB_WIDTH}:-1,tile={GRID_COLS}x{GRID_ROWS}",
        #     "-q:v", "5",
        #     output_pattern
        # ]

        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
        return f"[DONE] {video_id}"

    except subprocess.CalledProcessError as e:
        # Nếu lỗi GPU, thử fallback sang CPU (tùy chọn)
        logger.error(f"Lỗi xử lý {video_id} (có thể do GPU/Codec): {e}")
        return f"[ERROR] {video_id}"
    except Exception as e:
        return f"[ERROR] {video_id}: {e}"

def main():
    if not os.path.exists(VIDEOS_DIR):
        logger.error(f"Không tìm thấy thư mục: {VIDEOS_DIR}")
        return

    os.makedirs(SPRITES_DIR, exist_ok=True)
    video_files = glob.glob(os.path.join(VIDEOS_DIR, "*.mp4"))
    
    logger.info(f"--- BẮT ĐẦU TẠO SPRITE SHEET (GPU ACCELERATED) ---")
    logger.info(f"Tổng video: {len(video_files)}")
    logger.info(f"Cấu hình: {THUMB_WIDTH}px width, Grid {GRID_COLS}x{GRID_ROWS}, Interval {INTERVAL}s")

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        results = executor.map(generate_sprite_for_video, video_files)
        
        for res in results:
            logger.info(res)

    logger.info("--- HOÀN TẤT ---")

if __name__ == "__main__":
    main()

