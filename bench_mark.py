import concurrent.futures
import glob
import json
import logging
import os
import time

import numpy as np
import pandas as pd
import torch
from tqdm import tqdm

import config
from retrieval_system import VideoRetrievalSystem
from utils.video_metadata import load_video_metadata

# --- CẤU HÌNH TỐI ƯU ---
SHOTS_DIR = "data/shots"
VIDEOS_DIR = "data/videos"
NUM_WORKERS = 8
# QUAN TRỌNG: Phải tăng lên 200 để tính được Recall@200
TOP_K_EVAL = 200

# Tắt log rác
logging.basicConfig(level=logging.ERROR, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


# --- 1. Load Metadata ---
def load_benchmark_data():
    print("📂 Đang tải dữ liệu Shots và FPS Metadata...", end="\r")
    shots_map = {}

    if not os.path.exists(SHOTS_DIR):
        print(f"❌ Không tìm thấy {SHOTS_DIR}. Chạy chế độ Fallback.")
    else:
        json_files = glob.glob(os.path.join(SHOTS_DIR, "*_shots.json"))
        for file_path in json_files:
            try:
                filename = os.path.basename(file_path)
                video_id = filename.replace("_shots.json", "")
                with open(file_path, "r") as f:
                    data = json.load(f)
                    ranges = [
                        (item["start_frame"], item["end_frame"])
                        for item in data["items"]
                    ]
                    shots_map[video_id] = ranges
            except Exception:
                pass

    fps_map = load_video_metadata(VIDEOS_DIR)
    print(
        f"✅ Đã tải dữ liệu: {len(shots_map)} shots maps, {len(fps_map)} videos FPS.        "
    )
    return shots_map, fps_map


def get_shot_id(video_id, frame_idx, shots_map):
    if video_id not in shots_map:
        return -1
    for shot_idx, (start, end) in enumerate(shots_map[video_id]):
        if start <= frame_idx <= end:
            return shot_idx
    return -1


# --- 2. Logic So Sánh ---
def is_match(pred_vid, pred_frame, target_vid, target_frame, shots_map, fps_map):
    if pred_vid != target_vid:
        return False

    pred_shot = get_shot_id(pred_vid, pred_frame, shots_map)
    target_shot = get_shot_id(target_vid, target_frame, shots_map)

    if pred_shot != -1 and target_shot != -1:
        return pred_shot == target_shot

    video_fps = fps_map.get(target_vid, 25.0)
    tolerance = int(video_fps)
    return abs(pred_frame - target_frame) <= tolerance


def parse_keyframe_index(filename):
    try:
        if isinstance(filename, int):
            return filename
        return int(filename.split("_")[1].split(".")[0])
    except Exception:
        return -1


# --- 3. Worker Function ---
def process_query(args):
    row, searcher, shots_map, fps_map, top_k = args
    query_text = row["caption"]
    target_vid = row["video_id"]
    target_frame_idx = parse_keyframe_index(row["keyframe_id"])

    start_t = time.time()
    try:
        results = searcher.clip_search(query_text, max_results=top_k)
        if not results:
            return float("inf"), time.time() - start_t

        found_rank = float("inf")
        for i, res in enumerate(results):
            pred_vid = res.get("video_id")
            pred_frame = res.get("keyframe_index")

            if is_match(
                pred_vid, pred_frame, target_vid, target_frame_idx, shots_map, fps_map
            ):
                found_rank = i + 1
                break

        return found_rank, time.time() - start_t

    except Exception:
        return float("inf"), 0


# --- 4. Main Benchmark ---
def run_benchmark_shots(csv_file="ground_truth.csv"):
    print("🚀 Khởi tạo hệ thống Search...", end="\r")
    try:
        searcher = VideoRetrievalSystem(re_ingest=False)
        device_name = searcher.encoder.device.upper()
        if "CUDA" in device_name:
            searcher.clip_search("warmup", 1)
        print(f"🚀 Hệ thống sẵn sàng. Thiết bị: {device_name}            ")
    except Exception as e:
        print(f"\n❌ Lỗi khởi tạo: {e}")
        return

    shots_map, fps_map = load_benchmark_data()

    try:
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip()
    except Exception as e:
        print(f"❌ Lỗi file CSV: {e}")
        return

    tasks = [
        (row, searcher, shots_map, fps_map, TOP_K_EVAL) for _, row in df.iterrows()
    ]

    print(
        f"⚡ Bắt đầu Benchmark: {len(tasks)} queries | {NUM_WORKERS} luồng | Top {TOP_K_EVAL}"
    )
    ranks = []
    times = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        results = list(
            tqdm(executor.map(process_query, tasks), total=len(tasks), unit="query")
        )

        for r, t in results:
            if t > 0:
                ranks.append(r)
                times.append(t)

    if not ranks:
        print("❌ Không có kết quả nào trả về.")
        return

    # Tính Metrics
    ranks_np = np.array(ranks)

    # MRR
    with np.errstate(divide="ignore"):
        reciprocal_ranks = 1.0 / ranks_np
    mrr = np.mean(reciprocal_ranks)

    # Recall Calculation
    total = len(ranks)
    r1 = np.sum(ranks_np <= 1) / total
    r5 = np.sum(ranks_np <= 5) / total
    r10 = np.sum(ranks_np <= 10) / total
    r20 = np.sum(ranks_np <= 20) / total
    r30 = np.sum(ranks_np <= 30) / total
    r50 = np.sum(ranks_np <= 50) / total
    r80 = np.sum(ranks_np <= 80) / total
    r100 = np.sum(ranks_np <= 100) / total
    r150 = np.sum(ranks_np <= 150) / total
    r200 = np.sum(ranks_np <= 200) / total

    # Thời gian
    avg_time = np.mean(times)

    # In kết quả đẹp
    print("\n" + "═" * 50)
    print(f"📊 KẾT QUẢ BENCHMARK (GPU + Multi-thread)")
    print("═" * 50)
    print(f"✅ Mean Reciprocal Rank (MRR) : {mrr:.4f}")
    print("─" * 50)
    print(f"🎯 Recall@1                 : {r1*100:6.2f}%")
    print(f"🎯 Recall@5                 : {r5*100:6.2f}%")
    print(f"🎯 Recall@10                : {r10*100:6.2f}%")
    print(f"🎯 Recall@20                : {r20*100:6.2f}%")
    print(f"🎯 Recall@30                : {r30*100:6.2f}%")
    print(f"🎯 Recall@50                : {r50*100:6.2f}%")
    print(f"🎯 Recall@80                : {r80*100:6.2f}%")
    print(f"🎯 Recall@100               : {r100*100:6.2f}%")
    print(f"🎯 Recall@150               : {r150*100:6.2f}%")
    print(f"🎯 Recall@200               : {r200*100:6.2f}%")
    print("─" * 50)
    print(f"⏱️  Trung bình mỗi query     : {avg_time*1000:6.1f} ms")
    print(
        f"🚀 Tốc độ xử lý (Throughput): {total/sum(times)*NUM_WORKERS:.1f} query/s (ước tính)"
    )
    print("═" * 50)


if __name__ == "__main__":
    run_benchmark_shots()
