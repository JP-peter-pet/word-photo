document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const uploadBtn = document.getElementById('uploadBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    const processBtn = document.getElementById('processBtn');
    const statusP = document.querySelector('#status p');
    const imagePreview = document.getElementById('imagePreview');
    const videoFeed = document.getElementById('videoFeed');
    const canvas = document.getElementById('canvas');

    // Hidden file input, triggered by the upload button
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';
    document.body.appendChild(imageInput);

    let selectedFile = null;
    let stream = null; // To hold the camera stream

    // --- Event Listeners ---
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => imageInput.click());
    }
    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
    }
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }
    if (processBtn) {
        processBtn.addEventListener('click', processImage);
    }
    imageInput.addEventListener('change', (event) => {
        if (stream) stopCamera();
        handleFile(event.target.files[0]);
    });

    // --- Core Functions ---

    function handleFile(file) {
        if (!file) return;
        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            imagePreview.classList.remove('found-word'); // Reset class on new image
            videoFeed.style.display = 'none';
            imagePreview.style.display = 'flex';
        };
        reader.readAsDataURL(selectedFile);

        statusP.textContent = `Ready to process: ${file.name}`;
        enableProcessButton();
    }

    async function startCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                videoFeed.srcObject = stream;
                videoFeed.style.display = 'block';
                imagePreview.style.display = 'none';
                
                uploadBtn.style.display = 'none';
                cameraBtn.style.display = 'none';
                captureBtn.style.display = 'block';

                statusP.textContent = 'Position the word in the frame.';
                disableProcessButton();
            } catch (error) {
                console.error('Camera Error:', error);
                statusP.textContent = 'Could not access the camera.';
            }
        } else {
            statusP.textContent = 'Camera not supported by your browser.';
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        uploadBtn.style.display = 'flex';
        cameraBtn.style.display = 'flex';
        captureBtn.style.display = 'none';
        videoFeed.style.display = 'none';
    }

    function capturePhoto() {
        const context = canvas.getContext('2d');
        canvas.width = videoFeed.videoWidth;
        canvas.height = videoFeed.videoHeight;
        context.setTransform(-1, 0, 0, 1, canvas.width, 0); // Mirror horizontally
        context.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

        canvas.toBlob((blob) => {
            const file = new File([blob], 'capture.png', { type: 'image/png' });
            stopCamera();
            handleFile(file);
        });
    }

    async function processImage() {
        if (!selectedFile) {
            statusP.textContent = 'Error: No image selected!';
            return;
        }

        statusP.textContent = 'Initializing OCR engine...';
        disableProcessButton();
        let worker;

        try {
            worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = (m.progress * 100).toFixed(0);
                        statusP.textContent = `Recognizing text... ${progress}%`;
                    } else {
                        const statusText = m.status.charAt(0).toUpperCase() + m.status.slice(1).replace(/_/g, ' ');
                        statusP.textContent = `${statusText}...`;
                    }
                }
            });

            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const { data: { text } } = await worker.recognize(selectedFile);
            
            const words = text.trim().split(/\s+/);
            const singleWord = words.find(w => /^[a-zA-Z]{3,}$/.test(w)); // Find a word with 3+ letters

            if (singleWord) {
                // 핵심 수정: 인식된 단어를 미리보기 영역에 표시하고 음성 재생
                imagePreview.innerHTML = `<span>${singleWord}</span>`;
                imagePreview.classList.add('found-word');
                statusP.textContent = `Found word: "${singleWord}". Reading it out loud.`;
                speakWord(singleWord, 5, 2000); // Read 5 times
            } else {
                // 단어를 찾지 못하면 이전처럼 메시지 표시
                imagePreview.innerHTML = `<p>No distinct word found. Please try another image.</p>`;
                imagePreview.classList.remove('found-word');
                statusP.textContent = 'Could not find a distinct word in the image.';
            }

        } catch (error) {
            console.error("OCR Error:", error);
            statusP.textContent = 'An error occurred during processing.';
        } finally {
            if (worker) {
                await worker.terminate();
            }
            // 처리가 끝나면 버튼을 다시 활성화할 수 있으나, 연속적인 요청을 막기 위해 여기서는 비활성화 상태 유지
            // enableProcessButton();
        }
    }

    function speakWord(word, times, interval) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            let count = 0;

            const speak = () => {
                if (count < times) {
                    window.speechSynthesis.speak(utterance);
                    count++;
                    if (count < times) {
                       setTimeout(speak, interval);
                    }
                }
            };
            speak();
        } else {
            statusP.textContent = 'Text-to-speech is not supported by your browser.';
        }
    }

    function enableProcessButton() {
        processBtn.disabled = false;
        processBtn.classList.remove('disabled');
    }

    function disableProcessButton() {
        processBtn.disabled = true;
        processBtn.classList.add('disabled');
    }
});
