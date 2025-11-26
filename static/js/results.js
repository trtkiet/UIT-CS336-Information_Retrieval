import { elements } from './elements.js';
import { openModal } from './video-player.js';

export function displayResults(results) {
    if (!results || results.length === 0) {
        elements.resultsContainer.innerHTML = '<p>No results found.</p>';
        return;
    }

    // Clone results to avoid mutating source if we add sorting logic later
    const sortedResults = [...results]; 
    elements.resultsContainer.innerHTML = '';

    sortedResults.forEach(item => {
        const resultElement = document.createElement('div');
        resultElement.classList.add('result-item');
        
        // Metadata
        resultElement.dataset.videoId = item.video_id;
        resultElement.dataset.keyframeIndex = item.keyframe_index;
        resultElement.dataset.fps = item.fps; 
        resultElement.style.cursor = 'pointer';

        const imageUrl = `/keyframes/${item.video_id}/keyframe_${item.keyframe_index}.webp`;

        // Hover Preview Setup
        const previewContainer = document.createElement('div');
        previewContainer.className = 'hover-preview';
        const previewVideo = document.createElement('video');
        previewVideo.muted = true; 
        previewVideo.playsInline = true;
        Object.assign(previewVideo.style, { width: "100%", height: "100%", objectFit: "cover" });
        previewContainer.appendChild(previewVideo);

        resultElement.innerHTML = `
        <img src="${imageUrl}" alt="Frame from ${item.video_id}" class="result-item-image" onerror="this.onerror=null;this.src='/static/placeholder.png';">
        <div class="result-info">
            <h3>${item.video_id} / Frame ${item.keyframe_index}</h3>
            <div class="result-scores">
                <span>FPS: ${item.fps}</span><br>
                ${['clip_score'].map(score => {
                    const isSorted = elements.sortBySelect.value === score;
                    const val = item[score] ? item[score].toFixed(4) : 'N/A';
                    return `<span class="${isSorted ? 'sorted-by' : ''}">Clip Score: ${val}</span>`;
                }).join('<br>')}
            </div>
        </div>`;
        
        resultElement.insertBefore(previewContainer, resultElement.firstChild);

        // --- HLS Hover Logic ---
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
            hoverTimeout = setTimeout(() => {
                const videoId = item.video_id;
                const fps = item.fps || 25;
                const startTime = Math.max(0, item.keyframe_index / fps - 1.5);
                const hlsUrl = `/hls/${videoId}/playlist.m3u8`;

                if (Hls.isSupported()) {
                    cleanupHls();
                    hls = new Hls({ startPosition: startTime, capLevelToPlayerSize: true, autoStartLoad: true, maxBufferLength: 5 });
                    hls.loadSource(hlsUrl);
                    hls.attachMedia(previewVideo);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        previewVideo.play().catch(() => {});
                    });
                } else if (previewVideo.canPlayType('application/vnd.apple.mpegurl')) {
                    previewVideo.src = hlsUrl;
                    previewVideo.currentTime = startTime;
                    previewVideo.play();
                }
            }, 200);
        });

        resultElement.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            cleanupHls();
        });

        // --- Click to Open Modal ---
        resultElement.addEventListener('click', () => {
            const fps = parseFloat(item.fps) || 25;
            let startTime = item.keyframe_index / fps;
            startTime = Math.max(0, startTime - 0.5); // Context padding
            openModal(item.video_id, startTime, fps);
        });

        elements.resultsContainer.appendChild(resultElement);
    });
}
