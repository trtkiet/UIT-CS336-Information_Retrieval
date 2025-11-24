import os
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
import logging
from retrieval_system import VideoRetrievalSystem 
import config
import subprocess

log_file = "system.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] - %(message)s",
    handlers=[
        logging.FileHandler(log_file),
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

try:
    search_system = VideoRetrievalSystem(re_ingest=False)
    logger.info("Search system initialized successfully!")
except Exception as e:
    logger.error(f"Failed to initialize search system: {e}")
    search_system = None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search_api():
    """
    The core API endpoint.  
    It receives the query data, calls the search system, and returns results.
    """
    if not search_system:
        return jsonify({"error": "Search system is not available."}), 500

    query_data = request.get_json()
    if not query_data:
        return jsonify({"error": "Invalid input: No JSON data received."}), 400

    logger.info(f"Received search request: {query_data}")

    try:
        clip_results = search_system.clip_search(query_data.get('description'), max_results=500)
        
        if query_data.get('objects'):
            object_results = search_system.object_search(query_data.get('objects'), projection={'video_id': 1, 'keyframe_index': 1})
            results = search_system.intersect([clip_results, object_results])
            return jsonify(results)

        return jsonify(clip_results)
    except Exception as e:
        logger.error(f"An error occurred during search: {e}", exc_info=True)
        return jsonify({"error": "An internal error occurred during search."}), 500

@app.route('/keyframes/<string:video_id>/keyframe_<int:keyframe_index>.webp')
def serve_frame_image(video_id, keyframe_index):
    try:
        keyframe_dir = os.path.join(config.KEYFRAMES_DIR, video_id)
        filename = f"keyframe_{keyframe_index}.webp"
        return send_from_directory(keyframe_dir, filename)
        
    except FileNotFoundError:
        return send_from_directory('static', 'placeholder.png'), 404

@app.route('/videos/<path:video_id>')
def serve_video_file(video_id):
    try:
        filename = f"{video_id}.mp4" 
        
        return send_from_directory(
            config.VIDEOS_DIR, 
            filename,
            as_attachment=False 
        )
    except FileNotFoundError:
        return "Video not found", 404

@app.route("/video-segment/<string:video_id>")
def serve_video_segment(video_id):
    """
    API trả về đoạn video ngắn để preview.
    :param video_id
    Sử dụng query param: ?start=5&duration=3
    :return: đoạn video theo duration
    """
    try:
        start_time = request.args.get('start', '0')
        duration = request.args.get('duration', '3')

        video_path = os.path.join(config.VIDEOS_DIR, f"{video_id}.mp4")
        if not os.path.exists(video_path):
            return "Video not found", 404

        cmd = [
            "ffmpeg",
            "-ss", start_time,
            "-i", video_path,
            "-t", duration,
            "-c", "copy",
            "-f", "mp4",
            "-movflags", "frag_keyframe+empty_moov",
            "pipe:1"
        ]

        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

        def generate():
            while True:
                chunk = process.stdout.read(4096)
                if not chunk:
                    break
                yield chunk

        return Response(generate(), mimetype="video/mp4")
    except Exception as e:
        logger.error(f"An error occurred during video segment: {e}")
        return "Error", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)