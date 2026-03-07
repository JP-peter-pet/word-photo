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

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';
    document.body.appendChild(imageInput);

    let selectedFile = null;
    let stream = null;
    let recognizedWord = null; // To store the word between OCR and TTS

    // --- Event Listeners ---
    uploadBtn.addEventListener('click', () => imageInput.click());
    cameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', capturePhoto);
    processBtn.addEventListener('click', speakRecognizedWord);
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
            videoFeed.style.display = 'none';
            imagePreview.style.display = 'flex';
            
            // Automatically run OCR after displaying the image
            runOcrAndDisplay();
        };
        reader.readAsDataURL(file);
        disableProcessButton(); // Disable button until OCR is complete
    }

    async function startCamera() {
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
        context.setTransform(-1, 0, 0, 1, canvas.width, 0);
        context.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0);

        canvas.toBlob((blob) => {
            const file = new File([blob], 'capture.png', { type: 'image/png' });
            stopCamera();
            handleFile(file);
        });
    }

    async function runOcrAndDisplay() {
        if (!selectedFile) return;

        statusP.textContent = 'Initializing OCR engine...';
        recognizedWord = null;
        let worker;

        try {
            worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        statusP.textContent = `Recognizing text... ${(m.progress * 100).toFixed(0)}%`;
                    } else {
                        statusP.textContent = `${m.status.replace(/_/g, ' ')}...`;
                    }
                }
            });

            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const { data } = await worker.recognize(selectedFile);
            
            // Find a line with exactly one word
            const singleWordLine = data.lines.find(line => line.words.length === 1);
            const wordText = singleWordLine ? singleWordLine.words[0].text.trim() : null;
            const finalWord = wordText && /^[a-zA-Z]{3,}$/.test(wordText) ? wordText : null;

            if (finalWord) {
                recognizedWord = finalWord;
                imagePreview.innerHTML = `<span class="found-word">${recognizedWord}</span>`;
                statusP.textContent = `Word found: "${recognizedWord}". Press Process to listen.`;
                enableProcessButton();
            } else {
                imagePreview.innerHTML = `<p>No single word found. Try another image.</p>`;
                statusP.textContent = 'Could not find a distinct word in the image.';
                disableProcessButton();
            }

        } catch (error) {
            console.error("OCR Error:", error);
            statusP.textContent = 'An error occurred during OCR.';
            disableProcessButton();
        } finally {
            if (worker) await worker.terminate();
        }
    }

    function speakRecognizedWord() {
        if (recognizedWord) {
            statusP.textContent = `Reading "${recognizedWord}" aloud...`;
            speakWord(recognizedWord, 5, 2000);
        } else {
            statusP.textContent = 'No word to speak. Upload an image first.';
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
                    if (count < times) setTimeout(speak, interval);
                }
            };
            speak();
        } else {
            statusP.textContent = 'TTS not supported by your browser.';
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
    
    // Initial State
    disableProcessButton();
});
