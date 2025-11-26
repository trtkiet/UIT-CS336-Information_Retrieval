// File: static/script.js

document.addEventListener('DOMContentLoaded', () => {
    // ... (Giữ nguyên phần khai báo DOM elements như cũ) ...
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

    let currentResults = [];

    // ... (Giữ nguyên các Event Listeners cho Search Form, Filter, Sort) ...

    searchForm.addEventListener('submit', (e) => {
        // (Giữ nguyên code submit form cũ)
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
        performSearch(query_data);
    });
    
    sortBySelect.addEventListener('change', () => {
        displayResults(currentResults);
    });

    toggleFiltersBtn.addEventListener('click', () => {
        advancedFilters.classList.toggle('hidden');
        toggleFiltersBtn.textContent = advancedFilters.classList.contains('hidden') ? '▼ Advanced Filters' : '▲ Hide Filters';
    });

    addObjectBtn.addEventListener('click', () => {
         // (Giữ nguyên code thêm object)
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

    // --- SỬA LỖI CLICK EVENT ---
    resultsContainer.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.result-item');

        if (resultItem) {
            const videoId = resultItem.dataset.videoId;
            const keyframeIndex = parseInt(resultItem.dataset.keyframeIndex);
            // Lấy FPS từ dataset đã được render
            const fps = parseFloat(resultItem.dataset.fps) || 25; 

            if (!videoId || isNaN(keyframeIndex)) return;

            // Tính thời gian dựa trên FPS thực tế của video
            let startTime = keyframeIndex / fps;
            startTime = Math.max(0, startTime - 0.5); // Lùi lại 0.5s để lấy ngữ cảnh

            openModal(videoId, startTime, fps); // Truyền FPS vào modal
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // ... (Giữ nguyên performSearch) ...
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

    // --- SỬA LOGIC DISPLAY RESULTS ---
    function displayResults(results) {
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p>No results found.</p>';
            return;
        }

        const sortBy = sortBySelect.value;
        const sortedResults = [...results]; 

        resultsContainer.innerHTML = '';
        
        sortedResults.forEach(item => {
            const resultElement = document.createElement('div');
            resultElement.classList.add('result-item');

            // --- LƯU METADATA ---
            resultElement.dataset.videoId = item.video_id;
            resultElement.dataset.keyframeIndex = item.keyframe_index;
            // Lấy FPS gốc từ server trả về (quan trọng để tính time chính xác)
            resultElement.dataset.fps = item.fps; 

            resultElement.style.cursor = 'pointer';

            const imageUrl = `/keyframes/${item.video_id}/keyframe_${item.keyframe_index}.webp`;

            const previewContainer = document.createElement('div');
            previewContainer.classList.add('hover-preview');

            // Tạo thẻ video
            const previewVideo = document.createElement('video');
            previewVideo.muted = true; // Bắt buộc mute
            previewVideo.playsInline = true; 
            previewVideo.style.width = "100%";
            previewVideo.style.height = "100%";
            previewVideo.style.objectFit = "cover";

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
                     <span>FPS: ${item.fps}</span><br>
                    ${['clip_score'].map(score_name => {
                        const isSorted = sortBySelect.value === score_name;
                        const value = item[score_name] ? item[score_name].toFixed(4) : 'N/A';
                        return `<span class="${isSorted ? 'sorted-by' : ''}">Clip Score: ${value}</span>`;
                    }).join('<br>')}
                </div>
            </div>
            `;
            
            previewContainer.appendChild(previewVideo);
            resultElement.insertBefore(previewContainer, resultElement.firstChild);

            // --- LOGIC HLS HOVER ---
            let hls = null;
            let hoverTimeout;
            
            const cleanupHls = () => {
                if (hls) {
                    hls.destroy();
                    hls = null;
                }
                previewVideo.pause();
                previewVideo.removeAttribute('src'); 
                previewVideo.load();
            };

            resultElement.addEventListener('mouseenter', () => {
                // Delay 400ms để tránh load rác khi lướt nhanh
                hoverTimeout = setTimeout(() => {
                    const videoId = item.video_id;
                    const videoFps = item.fps || 25; 
                    
                    // TÍNH TOÁN THỜI GIAN START
                    // Công thức: (Keyframe Index / FPS) - 1.5 giây (để xem ngữ cảnh trước đó)
                    const startTime = Math.max(0, item.keyframe_index / videoFps - 1.5);

                    const hlsUrl = `/hls/${videoId}/playlist.m3u8`;

                    if (Hls.isSupported()) {
                        cleanupHls(); 
                        hls = new Hls({
                            startPosition: startTime, // Nhảy ngay tới giây cần xem
                            capLevelToPlayerSize: true, 
                            autoStartLoad: true,
                            maxBufferLength: 5, // Buffer ít cho nhẹ RAM
                        });
                        
                        hls.loadSource(hlsUrl);
                        hls.attachMedia(previewVideo);
                        
                        hls.on(Hls.Events.MANIFEST_PARSED, function() {
                            const playPromise = previewVideo.play();
                            if (playPromise !== undefined) {
                                playPromise.catch(error => {});
                            }
                        });
                    }
                    else if (previewVideo.canPlayType('application/vnd.apple.mpegurl')) {
                        previewVideo.src = hlsUrl;
                        previewVideo.currentTime = startTime;
                        previewVideo.play();
                    }
                }, 400); 
            });

            resultElement.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                cleanupHls(); 
            });

            resultsContainer.appendChild(resultElement);
        });
    }
    
    function openModal(videoId, startTime, fps) {
        closeModal();
        modalVideoTitle.textContent = `Playing: ${videoId} (FPS: ${fps})`;
        
        // Thời gian start chính xác
        const videoUrl = `/videos/${videoId}#t=${startTime}`;
        modalVideoPlayer.src = videoUrl;
        modalOverlay.classList.remove('hidden');

        const videoWrapper = modalVideoPlayer.parentElement;
        if (getComputedStyle(videoWrapper).position === 'static') {
            videoWrapper.style.position = 'relative';
        }

        const timelineBar = document.createElement('div');
        timelineBar.classList.add('video-timeline');
        // ... (Style timelineBar giữ nguyên) ...
        timelineBar.style.position = 'relative';
        timelineBar.style.height = '8px';
        timelineBar.style.background = '#444';
        timelineBar.style.marginTop = '8px';
        timelineBar.style.cursor = 'pointer';

        const progressFill = document.createElement('div');
        // ... (Style progressFill giữ nguyên) ...
        progressFill.style.position = 'absolute';
        progressFill.style.left = '0';
        progressFill.style.top = '0';
        progressFill.style.bottom = '0';
        progressFill.style.width = '0%';
        progressFill.style.background = '#1db954';

        timelineBar.appendChild(progressFill);

        const timelinePreview = document.createElement('div');
        timelinePreview.classList.add('timeline-preview');
        // ... (Style timelinePreview giữ nguyên) ...
        timelinePreview.style.display = 'none';
        timelinePreview.style.position = 'absolute';
        timelinePreview.style.bottom = '120%'; 
        timelinePreview.style.transform = 'translateX(-50%)';
        timelinePreview.style.zIndex = '999';
        timelinePreview.style.pointerEvents = 'none';
        
        timelinePreview.innerHTML = `
        <img src="" alt="Preview" style="max-width: 150px; border: 1px solid #fff; display:none;">
        <div class="time-label" style="background: rgba(0,0,0,0.7); color: #fff; padding: 2px 5px; text-align: center;">0:00</div>
        `;
        timelineBar.appendChild(timelinePreview);

        const previewImg = timelinePreview.querySelector('img');
        const timeLabel = timelinePreview.querySelector('.time-label');
        const previewVideo = document.createElement('video');
        previewVideo.src = `/videos/${videoId}`;
        previewVideo.muted = true;
        previewVideo.preload = 'metadata';
        previewVideo.style.display = 'none';
        videoWrapper.appendChild(previewVideo);

        // Canvas logic (giữ nguyên)
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        let hoverTargetTime = null;
        let hoverScheduled = false;

        const runHoverPreview = () => {
            hoverScheduled = false;
            if (hoverTargetTime === null || !previewVideo.duration) return;
            const targetTime = hoverTargetTime;
            hoverTargetTime = null;

            const video = previewVideo;
            const onSeeked = () => {
                if (hoverTargetTime !== null && Math.abs(video.currentTime - targetTime) > 0.1) return;
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
                    previewImg.style.display = 'none';
                }
            };
            video.addEventListener('seeked', onSeeked, {once: true});
            video.currentTime = targetTime;
        };

        const scheduleHoverPreview = () => {
            if (!hoverScheduled) {
                hoverScheduled = true;
                setTimeout(runHoverPreview, 80);
            }
        };

        const handleMouseMove = (e) => {
             // (Logic hover giữ nguyên)
            if (!previewVideo.duration) return;
            const rect = timelineBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const hoverTime = percent * previewVideo.duration;
            timelinePreview.style.display = 'block';
            let previewLeft = percent * rect.width - (timelinePreview.offsetWidth / 2);
            previewLeft = Math.max(0, Math.min(previewLeft, rect.width - timelinePreview.offsetWidth));
            timelinePreview.style.left = `${percent * 100}%`;
            const minutes = Math.floor(hoverTime / 60);
            const seconds = Math.floor(hoverTime % 60);
            timeLabel.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            hoverTargetTime = hoverTime;
            scheduleHoverPreview();
        };

        // ... (MouseLeave, Click handler giữ nguyên) ...
        const handleMouseLeave = () => {
            timelinePreview.style.display = 'none';
            hoverTargetTime = null;
        };

        const handleTimelineClick = (e) => {
            if (!modalVideoPlayer.duration) return;
            const rect = timelineBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const newTime = percent * modalVideoPlayer.duration;
            modalVideoPlayer.currentTime = newTime;
        };

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

        const frameControls = document.createElement('div');
        frameControls.classList.add('frame-controls');
        // ... (Style frameControls giữ nguyên) ...
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

        // --- QUAN TRỌNG: Sử dụng FPS động ---
        const frameRate = fps; 
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

    // ... (Giữ nguyên closeModal) ...
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
