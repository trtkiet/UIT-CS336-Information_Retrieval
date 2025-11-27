import { elements } from "./elements.js";

export function initVideoModal() {
  elements.closeModalBtn.addEventListener("click", closeModal);
  elements.modalOverlay.addEventListener("click", (e) => {
    if (e.target === elements.modalOverlay) {
      closeModal();
    }
  });
}

export function openModal(videoId, startTime, fps) {
  closeModal(); // Ensure cleanup of previous instance

  elements.modalVideoTitle.textContent = `Playing: ${videoId} (FPS: ${fps})`;
  const videoUrl = `/videos/${videoId}#t=${startTime}`;
  elements.modalVideoPlayer.src = videoUrl;
  elements.modalOverlay.classList.remove("hidden");

  // Video Wrapper setup
  const videoWrapper = elements.modalVideoPlayer.parentElement;
  if (getComputedStyle(videoWrapper).position === "static") {
    videoWrapper.style.position = "relative";
  }

  // --- Create Timeline UI ---
  const timelineBar = document.createElement("div");
  timelineBar.className = "video-timeline";
  Object.assign(timelineBar.style, {
    position: "relative",
    height: "8px",
    background: "#444",
    marginTop: "8px",
    cursor: "pointer",
  });

  const progressFill = document.createElement("div");
  Object.assign(progressFill.style, {
    position: "absolute",
    left: "0",
    top: "0",
    bottom: "0",
    width: "0%",
    background: "#1db954",
  });
  timelineBar.appendChild(progressFill);

  const timelinePreview = document.createElement("div");
  timelinePreview.className = "timeline-preview";
  Object.assign(timelinePreview.style, {
    display: "none",
    position: "absolute",
    bottom: "120%",
    transform: "translateX(-50%)",
    zIndex: "999",
    pointerEvents: "none",
  });
  timelinePreview.innerHTML = `
        <img src="" alt="Preview" style="max-width: 150px; border: 1px solid #fff; display:none;">
        <div class="time-label" style="background: rgba(0,0,0,0.7); color: #fff; padding: 2px 5px; text-align: center;">0:00</div>
    `;
  timelineBar.appendChild(timelinePreview);
  videoWrapper.appendChild(timelineBar);

  const previewImg = timelinePreview.querySelector("img");
  const timeLabel = timelinePreview.querySelector(".time-label");

  // --- HLS Preview Setup (Hidden Video) ---
  const previewVideo = document.createElement("video");
  previewVideo.muted = true;
  previewVideo.preload = "metadata";
  previewVideo.style.display = "none";
  videoWrapper.appendChild(previewVideo);

  const hlsUrl = `/hls/${videoId}/playlist.m3u8?t=${Date.now()}`;
  let previewHls = null;

  if (Hls.isSupported()) {
    previewHls = new Hls({
      maxBufferLength: 1,
      maxMaxBufferLength: 2,
      enableWorker: true,
    });
    previewHls.loadSource(hlsUrl);
    previewHls.attachMedia(previewVideo);
  } else if (previewVideo.canPlayType("application/vnd.apple.mpegurl")) {
    previewVideo.src = hlsUrl;
  } else {
    previewVideo.src = `/videos/${videoId}`; // Fallback
  }

  // --- Hover Logic ---
  const previewCanvas = document.createElement("canvas");
  const previewCtx = previewCanvas.getContext("2d");
  let hoverTargetTime = null;
  let hoverScheduled = false;

  const runHoverPreview = () => {
    hoverScheduled = false;
    if (hoverTargetTime === null || !elements.modalVideoPlayer.duration) return;

    const targetTime = hoverTargetTime;
    hoverTargetTime = null;

    const onSeeked = () => {
      if (Math.abs(previewVideo.currentTime - targetTime) > 0.5) return;
      const vw = previewVideo.videoWidth || previewVideo.clientWidth;
      const vh = previewVideo.videoHeight || previewVideo.clientHeight;
      if (!vw || !vh) return;

      previewCanvas.width = vw;
      previewCanvas.height = vh;
      try {
        previewCtx.drawImage(previewVideo, 0, 0, vw, vh);
        previewImg.src = previewCanvas.toDataURL("image/jpeg", 0.6);
        previewImg.style.display = "block";
      } catch (err) {
        previewImg.style.display = "none";
      }
    };

    previewVideo.removeEventListener("seeked", onSeeked);
    previewVideo.addEventListener("seeked", onSeeked, { once: true });
    previewVideo.currentTime = targetTime;
  };

  const scheduleHoverPreview = () => {
    if (!hoverScheduled) {
      hoverScheduled = true;
      setTimeout(runHoverPreview, 50);
    }
  };

  const handleMouseMove = (e) => {
    if (!elements.modalVideoPlayer.duration) return;
    const rect = timelineBar.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const hoverTime = percent * elements.modalVideoPlayer.duration;

    timelinePreview.style.display = "block";
    let previewLeft = percent * rect.width - timelinePreview.offsetWidth / 2;
    previewLeft = Math.max(
      0,
      Math.min(previewLeft, rect.width - timelinePreview.offsetWidth),
    );
    timelinePreview.style.left = `${percent * 100}%`;

    const minutes = Math.floor(hoverTime / 60);
    const seconds = Math.floor(hoverTime % 60);
    timeLabel.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    hoverTargetTime = hoverTime;
    scheduleHoverPreview();
  };

  // --- Controls & Listeners ---
  const handleTimelineClick = (e) => {
    if (!elements.modalVideoPlayer.duration) return;
    const rect = timelineBar.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    elements.modalVideoPlayer.currentTime =
      percent * elements.modalVideoPlayer.duration;
  };

  const updateProgress = () => {
    if (!elements.modalVideoPlayer.duration) return;
    const p =
      (elements.modalVideoPlayer.currentTime /
        elements.modalVideoPlayer.duration) *
      100;
    progressFill.style.width = `${p}%`;
  };

  timelineBar.addEventListener("mousemove", handleMouseMove);
  timelineBar.addEventListener("mouseleave", () => {
    timelinePreview.style.display = "none";
    hoverTargetTime = null;
  });
  timelineBar.addEventListener("click", handleTimelineClick);
  elements.modalVideoPlayer.addEventListener("timeupdate", updateProgress);

  // --- Frame Controls ---
  const frameControls = document.createElement("div");
  frameControls.className = "frame-controls";
  Object.assign(frameControls.style, {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
  });
  frameControls.innerHTML = `
        <button class="frame-btn" id="prev-frame-btn" style="padding: 5px 10px;">◀ Previous Frame</button>
        <span class="frame-info" id="current-frame-info" style="line-height: 30px;">Frame: 0</span>
        <button class="frame-btn" id="next-frame-btn" style="padding: 5px 10px;">Next Frame ▶</button>
    `;
  elements.modalContent.appendChild(frameControls);

  const frameRate = fps;
  const frameDuration = 1 / frameRate;
  const frameInfo = frameControls.querySelector("#current-frame-info");

  const updateFrameInfo = () => {
    if (!elements.modalVideoPlayer.duration) return;
    const currentFrame = Math.floor(
      elements.modalVideoPlayer.currentTime * frameRate,
    );
    const totalFrames = Math.floor(
      elements.modalVideoPlayer.duration * frameRate,
    );
    frameInfo.textContent = `Frame: ${currentFrame} / ${isNaN(totalFrames) ? "..." : totalFrames}`;
  };

  elements.modalVideoPlayer.addEventListener("timeupdate", updateFrameInfo);
  elements.modalVideoPlayer.addEventListener("loadedmetadata", updateFrameInfo);

  const handleFrameStep = (direction) => {
    elements.modalVideoPlayer.pause();
    const currentFrame = Math.floor(
      elements.modalVideoPlayer.currentTime * frameRate,
    );
    elements.modalVideoPlayer.currentTime = Math.max(
      0,
      (currentFrame + direction) * frameDuration,
    );
  };

  const prevBtn = document.getElementById("prev-frame-btn");
  const nextBtn = document.getElementById("next-frame-btn");

  prevBtn.addEventListener("click", () => handleFrameStep(-1));
  nextBtn.addEventListener("click", () => handleFrameStep(1));

  const handleKeyPress = (e) => {
    if (elements.modalOverlay.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") handleFrameStep(-1);
    if (e.key === "ArrowRight") handleFrameStep(1);
    if (e.key === " ") {
      e.preventDefault();
      elements.modalVideoPlayer.paused
        ? elements.modalVideoPlayer.play()
        : elements.modalVideoPlayer.pause();
    }
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", handleKeyPress);

  // --- Store Handlers for Cleanup ---
  elements.modalOverlay.dataset.handlersAttached = "true";
  elements.modalOverlay._cleanupHandlers = {
    handleKeyPress,
    timelineBar,
    frameControls,
    previewVideo,
    previewHls,
    updateProgress,
    updateFrameInfo,
  };

  elements.modalVideoPlayer
    .play()
    .catch((err) => console.warn("Autoplay prevented:", err));
}

export function closeModal() {
  if (elements.modalOverlay.classList.contains("hidden")) return;

  if (elements.modalOverlay.dataset.handlersAttached === "true") {
    const h = elements.modalOverlay._cleanupHandlers;
    if (h) {
      document.removeEventListener("keydown", h.handleKeyPress);
      if (h.timelineBar) h.timelineBar.remove();
      if (h.frameControls) h.frameControls.remove();

      elements.modalVideoPlayer.removeEventListener(
        "timeupdate",
        h.updateProgress,
      );
      elements.modalVideoPlayer.removeEventListener(
        "timeupdate",
        h.updateFrameInfo,
      );
      elements.modalVideoPlayer.removeEventListener(
        "loadedmetadata",
        h.updateFrameInfo,
      );

      if (h.previewHls) h.previewHls.destroy();
      if (h.previewVideo) {
        h.previewVideo.removeAttribute("src");
        h.previewVideo.load();
        h.previewVideo.remove();
      }
    }
    delete elements.modalOverlay._cleanupHandlers;
    delete elements.modalOverlay.dataset.handlersAttached;
  }

  elements.modalOverlay.classList.add("hidden");
  elements.modalVideoPlayer.pause();
  elements.modalVideoPlayer.src = "";
  elements.modalVideoTitle.textContent = "";
}
