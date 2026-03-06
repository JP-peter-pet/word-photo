const imageInput = document.getElementById('imageInput');
const processBtn = document.getElementById('processBtn');
const statusDiv = document.getElementById('status');
const statusP = statusDiv.querySelector('p');

let selectedFile = null;

// Add a label for the file input to make it stylable
const inputLabel = document.createElement('label');
inputLabel.setAttribute('for', 'imageInput');
inputLabel.textContent = 'Choose an Image';
imageInput.parentNode.insertBefore(inputLabel, imageInput);

imageInput.addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        statusP.textContent = `Selected: ${selectedFile.name}`;
        inputLabel.textContent = 'Change Image';
    } else {
        statusP.textContent = 'Please select an image.';
        inputLabel.textContent = 'Choose an Image';
    }
});

processBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        statusP.textContent = 'Error: No image selected!';
        return;
    }

    statusP.textContent = 'Processing... Please wait.';
    processBtn.disabled = true;

    try {
        const { data: { text } } = await Tesseract.recognize(
            selectedFile,
            'eng',
            {
                logger: m => console.log(m) // Optional: Log progress
            }
        );

        // Filter for a single word, trying to match the "in a box" concept
        const words = text.trim().split(/\s+/);
        const singleWord = words.find(w => /^[a-zA-Z]+$/.test(w)); // Find the first purely alphabetical word

        if (singleWord) {
            statusP.textContent = `Found word: "${singleWord}". Starting TTS...`;
            speakWord(singleWord, 5, 2000);
        } else {
            statusP.textContent = 'Could not find a single word in the image.';
        }

    } catch (error) {
        console.error(error);
        statusP.textContent = 'An error occurred during image processing.';
    } finally {
        processBtn.disabled = false;
    }
});

function speakWord(word, times, interval) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US'; // Set to American English for native-like pronunciation
        utterance.rate = 0.9; // Slightly slower for clarity

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
