document.addEventListener('DOMContentLoaded', () => {
    // ====================================================================
    // 1. GET ALL DOM ELEMENTS
    // ====================================================================
    const searchForm = document.getElementById('search-form');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    const advancedFilters = document.getElementById('advanced-filters');
    const addObjectBtn = document.getElementById('add-object-btn');
    const objectList = document.getElementById('object-list');
    const objectSelect = document.getElementById('object-select');
    const objectMin = document.getElementById('object-min');
    const objectMax = document.getElementById('object-max');
    const objectConfidence = document.getElementById('object-confidence');
    const resultsContainer = document.getElementById('results-container');
    const sortBySelect = document.getElementById('sort-by-select');

    // Elements for the Video Modal
    const modalOverlay = document.getElementById('video-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalVideoPlayer = document.getElementById('modal-video-player');
    const modalVideoTitle = document.getElementById('modal-video-title');

    // ====================================================================
    // 2. STATE MANAGEMENT (Client-side cache for results)
    // ====================================================================
    let currentResults = [];

    // ====================================================================
    // 3. EVENT LISTENERS
    // ====================================================================

    /**
     * Main listener for the search form submission.
     */
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(searchForm);
        const query_data = {
            description: formData.get('description'),
            objects: [],
            audio: formData.get('audio')
        };

        document.querySelectorAll('.object-item').forEach(item => {
            const objectQuery = {
                label: item.getAttribute('data-label'),
                confidence: parseFloat(item.getAttribute('data-confidence')),
                min_instances: parseInt(item.getAttribute('data-min'), 10)
            };

            const maxInstancesValue = item.getAttribute('data-max');
            if (maxInstancesValue) {
                objectQuery.max_instances = parseInt(maxInstancesValue, 10);
            }

            query_data.objects.push(objectQuery);
        });

        console.log('Sending search request to backend:', query_data);
        performSearch(query_data);
    });

    /**
     * Listener for the sort dropdown to re-render results.
     */
    sortBySelect.addEventListener('change', () => {
        displayResults(currentResults);
    });

    /**
     * [QUAN TRỌNG] SỬA LỖI CLICK:
     * Listener to open the video modal when a result item is clicked.
     * Bây giờ bắt sự kiện vào .result-item thay vì .result-item-image
     */
    resultsContainer.addEventListener('click', (e) => {
        // Tìm thẻ cha .result-item gần nhất (bất kể click vào ảnh, text hay video preview)
        const resultItem = e.target.closest('.result-item');

        if (resultItem) {
            const videoId = resultItem.dataset.videoId;
            const keyframeIndex = parseInt(resultItem.dataset.keyframeIndex);

            if (!videoId || isNaN(keyframeIndex)) return;

            // Assuming 1 keyframe per second. Adjust if your rate is different.
            const frameRate = 25;
            let startTime = keyframeIndex / frameRate;
            startTime = Math.max(0, startTime - 0.5); // Start 0.5s before for context

            openModal(videoId, startTime);
        }
    });

    /**
     * Listeners for UI interactions (filters, objects, closing modal).
     */
    toggleFiltersBtn.addEventListener('click', () => {
        advancedFilters.classList.toggle('hidden');
        toggleFiltersBtn.textContent = advancedFilters.classList.contains('hidden') ? '▼ Advanced Filters' : '▲ Hide Filters';
    });

    addObjectBtn.addEventListener('click', () => {
        const label = objectSelect.value;
        const min = objectMin.value;
        const max = objectMax.value;
        const confidence = objectConfidence.value;

        if (document.querySelector(`.object-item[data-label="${label}"]`)) {
            alert('Object already added.');
            return;
        }

        const objectItem = document.createElement('div');
        objectItem.classList.add('object-item');
        objectItem.setAttribute('data-label', label);
        objectItem.setAttribute('data-min', min);
        objectItem.setAttribute('data-max', max);
        objectItem.setAttribute('data-confidence', confidence);

        let countText;
        if (!max || max.trim() === '') {
            countText = `Count: >= ${min}`;
        } else {
            countText = `Count: [${min}, ${max}]`;
        }

        objectItem.innerHTML = `<span>${label} (Confidence: >= ${confidence}, ${countText})</span><button type="button" class="remove-obj-btn">X</button>`;
        objectList.appendChild(objectItem);
    });

    objectList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-obj-btn')) {
            e.target.parentElement.remove();
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // ====================================================================
    // 4. CORE FUNCTIONS
    // ====================================================================

    /**
     * Calls the backend API to perform a search and stores the results.
     */
    async function performSearch(query_data) {
        resultsContainer.innerHTML = '<p>Searching...</p>';

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(query_data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            currentResults = results;
            displayResults(currentResults);

        } catch (error) {
            console.error('Search failed:', error);
            currentResults = [];
            resultsContainer.innerHTML = `<p style="color: red;">An error occurred: ${error}</p>`;
        }
    }

    /**
     * Sorts and renders the search results into the UI.
     */
    function displayResults(results) {
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p>No results found.</p>';
            return;
        }

        // --- Sorting Logic ---
        const sortBy = sortBySelect.value;
        const sortedResults = [...results];

        sortedResults.sort((a, b) => {
            if (sortBy === 'clip_score') {
                const scoreA = a[sortBy] === null ? Infinity : a[sortBy];
                const scoreB = b[sortBy] === null ? Infinity : b[sortBy];
                return scoreA - scoreB;
            } else {
                const scoreA = a[sortBy] === null ? -Infinity : a[sortBy];
                const scoreB = b[sortBy] === null ? -Infinity : b[sortBy];
                return scoreB - scoreA;
            }
        });

        // --- Rendering Logic ---
        resultsContainer.innerHTML = '';

        sortedResults.forEach(item => {
            const resultElement = document.createElement('div');
            resultElement.classList.add('result-item');

            // [QUAN TRỌNG] Lưu ID vào thẻ cha (result-item) để dễ bắt sự kiện click
            resultElement.dataset.videoId = item.video_id;
            resultElement.dataset.keyframeIndex = item.keyframe_index;
            // Thêm style cursor pointer để người dùng biết có thể click
            resultElement.style.cursor = 'pointer';

            const imageUrl = `/keyframes/${item.video_id}/keyframe_${item.keyframe_index}.webp`;

            // Tạo container cho preview
            const previewContainer = document.createElement('div');
            previewContainer.classList.add('hover-preview');

            const previewVideo = document.createElement('video');
            previewVideo.muted = true;
            previewVideo.loop = true;
            previewVideo.preload = 'none';

            // [QUAN TRỌNG] Thêm css pointer-events: none cho video nếu muốn click xuyên qua
            // Tuy nhiên vì ta đã bắt sự kiện ở cha (.result-item) nên không cần thiết lắm,
            // nhưng tốt nhất nên set width/height 100% trong CSS.

            resultElement.innerHTML = `
            <img 
                src="${imageUrl}" 
                alt="Frame from ${item.video_id}" 
                class="result-item-image" 
                onerror="this.onerror=null;this.src='/static/placeholder.png';"
            >
            <div class="result-info">
                <h3>${item.video_id} / Frame ${item.keyframe_index}</h3>
                <div class="result-scores">
                    ${['clip_score'].map(score_name => {
                const isSorted = sortBySelect.value === score_name;
                const value = item[score_name] ? item[score_name].toFixed(4) : 'N/A';
                return `<span class="${isSorted ? 'sorted-by' : ''}">Clip Score: ${value}</span>`;
            }).join('<br>')}
                </div>
            </div>
            `;

            // Thêm preview video vào DOM (Insert before image)
            previewContainer.appendChild(previewVideo);
            resultElement.insertBefore(previewContainer, resultElement.firstChild);

            // XỬ LÝ HOVER: Load và play video preview
            let hoverTimeout;
            resultElement.addEventListener('mouseenter', () => {
                hoverTimeout = setTimeout(() => {
                    const frameRate = 25;
                    // Tính toán thời gian start cho preview (khoảng 2s trước keyframe)
                    const startTime = Math.max(0, item.keyframe_index / frameRate - 2);

                    // Load video segment (5s duration)
                    previewVideo.src = `/video-segment/${item.video_id}?start=${startTime}&duration=3`;
                    previewVideo.play().catch(e => console.warn('Preview autoplay blocked:', e));
                }, 1000);
            });

            resultElement.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                previewVideo.pause();
                previewVideo.src = ''; // Dừng load và giải phóng resource
            });

            resultsContainer.appendChild(resultElement);
        });
    }

    /**
     * Opens the video player modal.
     */
    // javascript
function openModal(videoId, startTime) {
    // Dọn sạch modal cũ
    closeModal();

    modalVideoTitle.textContent = `Playing: ${videoId}`;
    const videoUrl = `/videos/${videoId}#t=${startTime}`;
    modalVideoPlayer.src = videoUrl;
    modalOverlay.classList.remove('hidden');

    const videoWrapper = modalVideoPlayer.parentElement;
    if (getComputedStyle(videoWrapper).position === 'static') {
        videoWrapper.style.position = 'relative';
    }

    // --- Thanh timeline riêng ---
    const timelineBar = document.createElement('div');
    timelineBar.classList.add('video-timeline');
    timelineBar.style.position = 'relative';
    timelineBar.style.height = '8px';
    timelineBar.style.background = '#444';
    timelineBar.style.marginTop = '8px';
    timelineBar.style.cursor = 'pointer';

    const progressFill = document.createElement('div');
    progressFill.style.position = 'absolute';
    progressFill.style.left = '0';
    progressFill.style.top = '0';
    progressFill.style.bottom = '0';
    progressFill.style.width = '0%';
    progressFill.style.background = '#1db954';
    timelineBar.appendChild(progressFill);

    // --- Timeline hover preview box ---
    const timelinePreview = document.createElement('div');
    timelinePreview.classList.add('timeline-preview');
    timelinePreview.style.display = 'none';
    timelinePreview.style.position = 'absolute';
    timelinePreview.style.bottom = '100%';
    timelinePreview.style.zIndex = '100';
    timelinePreview.style.pointerEvents = 'none';

    timelinePreview.innerHTML = `
        <img src="" alt="Preview" style="max-width: 150px; border: 1px solid #fff; display:none;">
        <div class="time-label" style="background: rgba(0,0,0,0.7); color: #fff; padding: 2px 5px; text-align: center;">0:00</div>
    `;
    videoWrapper.appendChild(timelinePreview);

    const previewImg = timelinePreview.querySelector('img');
    const timeLabel = timelinePreview.querySelector('.time-label');

    // Video ẩn để render frame preview (không ảnh hưởng video chính)
    const previewVideo = document.createElement('video');
    previewVideo.src = `/videos/${videoId}`;
    previewVideo.muted = true;
    previewVideo.preload = 'metadata';
    previewVideo.style.display = 'none';
    videoWrapper.appendChild(previewVideo);

    // Biến cho throttle hover
    let hoverTargetTime = null;
    let hoverScheduled = false;

    // Tạo canvas share cho tất cả lần vẽ
    const previewCanvas = document.createElement('canvas');
    const previewCtx = previewCanvas.getContext('2d');

    // Hàm thực thi seek + vẽ frame (throttle)
    const runHoverPreview = () => {
        hoverScheduled = false;
        if (hoverTargetTime === null || !previewVideo.duration) return;

        const targetTime = hoverTargetTime;
        hoverTargetTime = null;

        const video = previewVideo;

        const onSeeked = () => {
            // Nếu trong lúc seek user đã hover chỗ khác, bỏ frame này
            if (hoverTargetTime !== null && Math.abs(video.currentTime - targetTime) > 0.1) {
                return;
            }

            const vw = video.videoWidth || video.clientWidth;
            const vh = video.videoHeight || video.clientHeight;
            if (!vw || !vh) return;

            previewCanvas.width = vw;
            previewCanvas.height = vh;

            try {
                previewCtx.drawImage(video, 0, 0, vw, vh);
                const dataUrl = previewCanvas.toDataURL('image/jpeg', 0.7);
                previewImg.style.display = 'block';
                previewImg.src = dataUrl;
            } catch (err) {
                console.warn('Cannot draw video frame to canvas:', err);
                previewImg.style.display = 'none';
            }
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = targetTime;
    };

    // Throttle bằng setTimeout 80ms
    const scheduleHoverPreview = () => {
        if (!hoverScheduled) {
            hoverScheduled = true;
            setTimeout(runHoverPreview, 80);
        }
    };

    const handleMouseMove = (e) => {
        if (!previewVideo.duration) return;

        const rect = timelineBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const hoverTime = percent * previewVideo.duration;

        // Hiển thị box preview
        timelinePreview.style.display = 'block';
        let previewLeft = percent * rect.width - (timelinePreview.offsetWidth / 2);
        previewLeft = Math.max(0, Math.min(previewLeft, rect.width - timelinePreview.offsetWidth));
        timelinePreview.style.left = `${previewLeft}px`;

        const minutes = Math.floor(hoverTime / 60);
        const seconds = Math.floor(hoverTime % 60);
        timeLabel.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Cập nhật target time và schedule vẽ
        hoverTargetTime = hoverTime;
        scheduleHoverPreview();
    };

    const handleMouseLeave = () => {
        timelinePreview.style.display = 'none';
        hoverTargetTime = null;
    };

    const handleTimelineClick = (e) => {
        if (!modalVideoPlayer.duration) return;

        const rect = timelineBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = percent * modalVideoPlayer.duration;

        modalVideoPlayer.currentTime = newTime; // Seek thật khi click
    };

    // Cập nhật progressFill theo thời gian thực
    const updateProgress = () => {
        if (!modalVideoPlayer.duration) return;
        const p = (modalVideoPlayer.currentTime / modalVideoPlayer.duration) * 100;
        progressFill.style.width = `${p}%`;
    };

    timelineBar.addEventListener('mousemove', handleMouseMove);
    timelineBar.addEventListener('mouseleave', handleMouseLeave);
    timelineBar.addEventListener('click', handleTimelineClick);
    modalVideoPlayer.addEventListener('timeupdate', updateProgress);

    videoWrapper.appendChild(timelineBar);

    // --- Frame controls ---
    const frameControls = document.createElement('div');
    frameControls.classList.add('frame-controls');
    frameControls.style.marginTop = '10px';
    frameControls.style.display = 'flex';
    frameControls.style.justifyContent = 'center';
    frameControls.style.gap = '15px';

    frameControls.innerHTML = `
        <button class="frame-btn" id="prev-frame-btn" style="padding: 5px 10px;">◀ Previous Frame</button>
        <span class="frame-info" id="current-frame-info" style="line-height: 30px;">Frame: 0</span>
        <button class="frame-btn" id="next-frame-btn" style="padding: 5px 10px;">Next Frame ▶</button>
    `;

    const modalContent = document.querySelector('.modal-content');
    modalContent.appendChild(frameControls);

    const prevBtn = document.getElementById('prev-frame-btn');
    const nextBtn = document.getElementById('next-frame-btn');
    const frameInfo = document.getElementById('current-frame-info');

    const frameRate = 25;
    const frameDuration = 1 / frameRate;

    const updateFrameInfo = () => {
        if (!modalVideoPlayer.duration) {
            frameInfo.textContent = 'Frame: 0 / ...';
            return;
        }
        const currentFrame = Math.floor(modalVideoPlayer.currentTime * frameRate);
        const totalFrames = Math.floor(modalVideoPlayer.duration * frameRate);
        frameInfo.textContent = `Frame: ${currentFrame} / ${isNaN(totalFrames) ? '...' : totalFrames}`;
    };

    modalVideoPlayer.addEventListener('timeupdate', updateFrameInfo);
    modalVideoPlayer.addEventListener('loadedmetadata', updateFrameInfo);

    const handlePrevFrame = () => {
        modalVideoPlayer.pause();
        const currentFrame = Math.floor(modalVideoPlayer.currentTime * frameRate);
        modalVideoPlayer.currentTime = Math.max(0, (currentFrame - 1) * frameDuration);
    };

    const handleNextFrame = () => {
        modalVideoPlayer.pause();
        const currentFrame = Math.floor(modalVideoPlayer.currentTime * frameRate);
        modalVideoPlayer.currentTime = (currentFrame + 1) * frameDuration;
    };

    prevBtn.addEventListener('click', handlePrevFrame);
    nextBtn.addEventListener('click', handleNextFrame);

    const handleKeyPress = (e) => {
        if (modalOverlay.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') handlePrevFrame();
        if (e.key === 'ArrowRight') handleNextFrame();
        if (e.key === ' ') {
            e.preventDefault();
            modalVideoPlayer.paused ? modalVideoPlayer.play() : modalVideoPlayer.pause();
        }
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeyPress);

    // Lưu mọi handler/element để cleanup
    modalOverlay.dataset.handlersAttached = 'true';
    modalOverlay._cleanupHandlers = {
        handleKeyPress,
        handleMouseMove,
        handleMouseLeave,
        handleTimelineClick,
        updateFrameInfo,
        updateProgress,
        timelinePreview,
        frameControls,
        timelineBar,
        previewVideo
    };

    modalVideoPlayer.play().catch(err => console.warn('Autoplay prevented:', err));
}

function closeModal() {
    if (modalOverlay.classList.contains('hidden')) return;

    if (modalOverlay.dataset.handlersAttached === 'true') {
        const h = modalOverlay._cleanupHandlers;
        if (h) {
            document.removeEventListener('keydown', h.handleKeyPress);
            if (h.timelineBar) {
                h.timelineBar.removeEventListener('mousemove', h.handleMouseMove);
                h.timelineBar.removeEventListener('mouseleave', h.handleMouseLeave);
                h.timelineBar.removeEventListener('click', h.handleTimelineClick);
                h.timelineBar.remove();
            }
            modalVideoPlayer.removeEventListener('timeupdate', h.updateFrameInfo);
            modalVideoPlayer.removeEventListener('timeupdate', h.updateProgress);
            modalVideoPlayer.removeEventListener('loadedmetadata', h.updateFrameInfo);

            if (h.timelinePreview) h.timelinePreview.remove();
            if (h.frameControls) h.frameControls.remove();
            if (h.previewVideo) h.previewVideo.remove();
        }
        delete modalOverlay._cleanupHandlers;
        delete modalOverlay.dataset.handlersAttached;
    }

    modalOverlay.classList.add('hidden');
    modalVideoPlayer.pause();
    modalVideoPlayer.src = '';
    modalVideoTitle.textContent = '';
}
});