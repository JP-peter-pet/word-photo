const imageInput = document.getElementById('imageInput');
const processBtn = document.getElementById('processBtn');
const statusDiv = document.getElementById('status');
const statusP = statusDiv.querySelector('p');
const imagePreview = document.getElementById('imagePreview');

let selectedFile = null;

// The label for the file input is now the image preview itself or the initial text
imageInput.addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = ''; // Clear previous content
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '250px';
            imagePreview.appendChild(img);
        };
        reader.readAsDataURL(selectedFile);
        
        statusP.textContent = `Selected: ${selectedFile.name}`;
        processBtn.disabled = false;
        processBtn.classList.remove('disabled');
    } else {
        imagePreview.innerHTML = '<p>Click to select an image</p>';
        statusP.textContent = 'Please select an image.';
        processBtn.disabled = true;
        processBtn.classList.add('disabled');
    }
});

processBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        statusP.textContent = 'Error: No image selected!';
        return;
    }

    statusP.textContent = 'Starting...';
    processBtn.disabled = true;
    processBtn.classList.add('disabled');

    try {
        const { data: { text } } = await Tesseract.recognize(
            selectedFile,
            'eng',
            {
                logger: m => {
                    console.log(m); // For debugging
                    if (m.status === 'initializing api') {
                        statusP.textContent = 'Initializing OCR engine...';
                    } else if (m.status === 'loading language model') {
                        statusP.textContent = 'Loading language files...';
                    } else if (m.status === 'recognizing text') {
                        const progress = (m.progress * 100).toFixed(0);
                        statusP.textContent = `Recognizing text... ${progress}%`;
                    } else {
                        statusP.textContent = `Processing: ${m.status}...`;
                    }
                }
            }
        );

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
        // Re-enable the button so the user can try another image
        processBtn.disabled = false;
        processBtn.classList.remove('disabled');
    }
});

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
        statusP.textContent = 'Sorry, your browser does not support text-to-speech.';
    }
}
