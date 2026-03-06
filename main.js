const imageInput = document.getElementById('imageInput');
const processBtn = document.getElementById('processBtn');
const statusP = document.querySelector('#status p');
const imagePreview = document.getElementById('imagePreview');

// Buttons
const uploadBtn = document.getElementById('uploadBtn');
const cameraBtn = document.getElementById('cameraBtn');
const captureBtn = document.getElementById('captureBtn');

// Media Elements
const videoFeed = document.getElementById('videoFeed');
const canvas = document.getElementById('canvas');

let selectedFile = null;
let stream = null; // To hold the camera stream

// --- Event Listeners ---

// Trigger hidden file input
uploadBtn.addEventListener('click', () => imageInput.click());

// Handle file selection
imageInput.addEventListener('change', (event) => {
    if (stream) stopCamera();
    handleFile(event.target.files[0]);
});

// Start camera
cameraBtn.addEventListener('click', startCamera);

// Capture photo from camera
captureBtn.addEventListener('click', capturePhoto);

// Process the selected image
processBtn.addEventListener('click', processImage);

// --- Functions ---

function handleFile(file) {
    if (!file) return;
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        imagePreview.style.display = 'flex';
        videoFeed.style.display = 'none';
    };
    reader.readAsDataURL(selectedFile);

    statusP.textContent = `Selected: ${selectedFile.name}`;
    enableProcessButton();
}

async function startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoFeed.srcObject = stream;
            videoFeed.style.display = 'block';
            imagePreview.style.display = 'none';
            
            // Toggle buttons
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
    // Toggle buttons back
    uploadBtn.style.display = 'flex';
    cameraBtn.style.display = 'flex';
    captureBtn.style.display = 'none';
}

function capturePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = videoFeed.videoWidth;
    canvas.height = videoFeed.videoHeight;
    context.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        selectedFile = new File([blob], 'capture.png', { type: 'image/png' });
        handleFile(selectedFile);
        stopCamera();
    });
}

async function processImage() {
    if (!selectedFile) {
        statusP.textContent = 'Error: No image selected!';
        return;
    }

    statusP.textContent = 'Starting...';
    disableProcessButton();

    try {
        const worker = await Tesseract.createWorker({
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = (m.progress * 100).toFixed(0);
                    statusP.textContent = `Recognizing text... ${progress}%`;
                } else {
                    statusP.textContent = `${m.status.replace(/_/g, ' ')}...`;
                }
            }
        });

        const { data: { text } } = await worker.recognize(selectedFile);
        await worker.terminate();
        
        const words = text.trim().split(/\s+/);
        const singleWord = words.find(w => /^[a-zA-Z]+$/.test(w));

        if (singleWord) {
            statusP.textContent = `Found word: "${singleWord}". Reading it out loud.`;
            speakWord(singleWord, 5, 2000);
        } else {
            statusP.textContent = 'Could not find a distinct word in the image.';
        }

    } catch (error) {
        console.error(error);
        statusP.textContent = 'An error occurred during image processing.';
    } finally {
        enableProcessButton();
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
                setTimeout(speak, interval);
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
