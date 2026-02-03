// ===== State Management =====
const state = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    recognition: null,
    startTime: null,
    timerInterval: null,
    recordedBlob: null,
    selectedAPI: 'webspeech',
    groqApiKey: localStorage.getItem('groqApiKey') || '',
    autoDownload: localStorage.getItem('autoDownload') === 'true'
};

// ===== DOM Elements =====
const elements = {
    recordBtn: document.getElementById('recordBtn'),
    recordStatus: document.getElementById('recordStatus'),
    timer: document.getElementById('timer'),
    apiStatus: document.getElementById('apiStatus'),
    transcription: document.getElementById('transcription'),
    charCount: document.getElementById('charCount'),
    clearBtn: document.getElementById('clearBtn'),
    downloadSection: document.getElementById('downloadSection'),
    downloadMarkdown: document.getElementById('downloadMarkdown'),
    downloadAudio: document.getElementById('downloadAudio'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeModal: document.getElementById('closeModal'),
    groqApiKey: document.getElementById('groqApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    autoDownloadCheckbox: document.getElementById('autoDownload'),
    saveSettings: document.getElementById('saveSettings'),
    toast: document.getElementById('toast'),
    apiWebSpeech: document.getElementById('apiWebSpeech'),
    apiGroq: document.getElementById('apiGroq')
};

// ===== Utility Functions =====
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return {
        filename: `${year}-${month}-${day}_${hour}-${minute}`,
        dateString: `${year}-${month}-${day}`,
        timeString: `${hour}:${minute}`
    };
}

function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, duration);
}

function updateCharCount() {
    const count = elements.transcription.value.length;
    elements.charCount.textContent = `${count}文字`;
}

// ===== API Selection =====
function updateAPISelection() {
    state.selectedAPI = elements.apiWebSpeech.checked ? 'webspeech' : 'groq';

    if (state.selectedAPI === 'groq' && !state.groqApiKey) {
        showToast('⚠️ Groq APIキーを設定してください');
        elements.apiStatus.textContent = 'APIキーが未設定です';
    } else {
        elements.apiStatus.textContent = '';
    }
}

elements.apiWebSpeech.addEventListener('change', updateAPISelection);
elements.apiGroq.addEventListener('change', updateAPISelection);

// ===== Web Speech API =====
function initializeSpeechRecognition() {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showToast('⚠️ このブラウザは音声認識に対応していません。Chrome/Edgeをお試しください。');
        elements.apiStatus.textContent = '❌ 音声認識非対応';
        return null;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onstart = () => {
        console.log('Speech recognition started');
        elements.apiStatus.textContent = '🎤 音声認識開始';
    };

    recognition.onresult = (event) => {
        interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        elements.transcription.value = finalTranscript + (interimTranscript ? `\n[認識中: ${interimTranscript}]` : '');
        updateCharCount();
        elements.apiStatus.textContent = '🎯 リアルタイム認識中...';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        // エラー種類に応じた詳細なメッセージ
        let errorMessage = '';
        switch (event.error) {
            case 'no-speech':
                elements.apiStatus.textContent = 'ℹ️ 音声が検出されませんでした';
                return; // トーストは表示しない
            case 'audio-capture':
                errorMessage = 'マイクにアクセスできません。マイクが接続されているか確認してください。';
                break;
            case 'not-allowed':
                errorMessage = 'マイクアクセスが拒否されました。ブラウザの設定でマイクを許可してください。';
                break;
            case 'network':
                errorMessage = 'ネットワークエラー。インターネット接続を確認してください。';
                break;
            case 'aborted':
                errorMessage = '音声認識が中断されました。';
                break;
            case 'service-not-allowed':
                errorMessage = 'このページではWeb Speech APIが利用できません。HTTPSでアクセスしてください。';
                break;
            default:
                errorMessage = `音声認識エラー: ${event.error}`;
        }

        showToast(`⚠️ ${errorMessage}`);
        elements.apiStatus.textContent = `❌ ${event.error}`;
    };

    recognition.onend = () => {
        console.log('Speech recognition ended');

        if (state.isRecording) {
            // 録音中なら再起動を試みる
            try {
                console.log('Restarting speech recognition...');
                recognition.start();
            } catch (e) {
                console.error('Recognition restart failed:', e);
                elements.apiStatus.textContent = '⚠️ 音声認識を再開できませんでした';
            }
        } else {
            // Clean up interim results
            const text = elements.transcription.value.replace(/\n\[認識中:.*?\]/g, '');
            elements.transcription.value = text.trim();
            updateCharCount();
            elements.apiStatus.textContent = '';
        }
    };

    return recognition;
}


// ===== Groq Whisper API =====
async function transcribeWithGroq(audioBlob) {
    if (!state.groqApiKey) {
        showToast('⚠️ Groq APIキーが設定されていません');
        return null;
    }

    elements.apiStatus.innerHTML = '<span class="loading"></span> Groq Whisperで文字起こし中...';

    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'ja');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.groqApiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        elements.apiStatus.textContent = '✅ 文字起こし完了';
        return data.text;
    } catch (error) {
        console.error('Groq API error:', error);
        showToast(`⚠️ Groq APIエラー: ${error.message}`);
        elements.apiStatus.textContent = '❌ 文字起こし失敗';
        return null;
    }
}

// ===== Recording Functions =====
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // MediaRecorder setup
        const options = { mimeType: 'audio/webm' };
        state.mediaRecorder = new MediaRecorder(stream, options);
        state.audioChunks = [];

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
            state.recordedBlob = audioBlob;

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Groq API transcription
            if (state.selectedAPI === 'groq') {
                const transcript = await transcribeWithGroq(audioBlob);
                if (transcript) {
                    elements.transcription.value = transcript;
                    updateCharCount();
                }
            }

            // Show download section
            elements.downloadSection.style.display = 'block';

            // Auto download if enabled
            if (state.autoDownload) {
                downloadMarkdown();
                downloadAudio();
            }

            showToast('✅ 録音完了');
        };

        // Start recording
        state.mediaRecorder.start();
        state.isRecording = true;
        state.startTime = Date.now();

        // UI updates
        elements.recordBtn.classList.add('recording');
        elements.recordStatus.textContent = '録音中...';

        // Start timer
        state.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            elements.timer.textContent = formatTime(elapsed);
        }, 1000);

        // Web Speech API
        if (state.selectedAPI === 'webspeech') {
            state.recognition = initializeSpeechRecognition();
            if (state.recognition) {
                try {
                    state.recognition.start();
                    elements.apiStatus.textContent = '🎤 音声認識開始';
                } catch (error) {
                    console.error('Failed to start speech recognition:', error);
                    showToast('⚠️ 音声認識を開始できませんでした');
                    elements.apiStatus.textContent = '❌ 音声認識開始失敗';
                }
            } else {
                elements.apiStatus.textContent = '❌ Web Speech API 非対応';
            }
        } else {
            elements.apiStatus.textContent = '録音中 - 完了後にGroq Whisperで文字起こしします';
        }

    } catch (error) {
        console.error('Error starting recording:', error);
        showToast('⚠️ マイクへのアクセスが拒否されました');
    }
}

function stopRecording() {
    if (!state.isRecording) return;

    state.isRecording = false;

    // Stop media recorder
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
    }

    // Stop speech recognition
    if (state.recognition) {
        state.recognition.stop();
        state.recognition = null;
    }

    // Stop timer
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    // UI updates
    elements.recordBtn.classList.remove('recording');
    elements.recordStatus.textContent = '録音停止';
}

// ===== Download Functions =====
function downloadMarkdown() {
    const { filename, dateString, timeString } = formatDate();
    const transcriptText = elements.transcription.value || '(文字起こしなし)';

    const markdown = `---
作成日: ${dateString}
時刻: ${timeString}
タイトル: 音声メモ
タグ: [音声メモ, 文字起こし]
---

# 文字起こし結果

${transcriptText}

## 音声ファイル
![[${filename}_recording.webm]]
`;

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_recording.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('📄 Markdownファイルをダウンロードしました');
}

function downloadAudio() {
    if (!state.recordedBlob) {
        showToast('⚠️ 録音データがありません');
        return;
    }

    const { filename } = formatDate();
    const url = URL.createObjectURL(state.recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_recording.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('🎵 音声ファイルをダウンロードしました');
}

// ===== Settings =====
function openSettings() {
    elements.settingsModal.classList.add('active');
    elements.groqApiKey.value = state.groqApiKey;
    elements.autoDownloadCheckbox.checked = state.autoDownload;
    updateAPIKeyStatus();
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

function updateAPIKeyStatus() {
    if (state.groqApiKey) {
        const masked = state.groqApiKey.substring(0, 8) + '...' + state.groqApiKey.substring(state.groqApiKey.length - 4);
        elements.apiKeyStatus.textContent = `✅ APIキー設定済み (${masked})`;
        elements.apiKeyStatus.className = 'api-key-status success';
    } else {
        elements.apiKeyStatus.textContent = '';
        elements.apiKeyStatus.className = 'api-key-status';
    }
}

function saveSettings() {
    const apiKey = elements.groqApiKey.value.trim();
    const autoDownload = elements.autoDownloadCheckbox.checked;

    if (apiKey) {
        // Basic validation
        if (!apiKey.startsWith('gsk_')) {
            showToast('⚠️ Groq APIキーは "gsk_" で始まる必要があります');
            return;
        }
        state.groqApiKey = apiKey;
        localStorage.setItem('groqApiKey', apiKey);
    } else {
        state.groqApiKey = '';
        localStorage.removeItem('groqApiKey');
    }

    state.autoDownload = autoDownload;
    localStorage.setItem('autoDownload', autoDownload);

    updateAPIKeyStatus();
    closeSettings();
    showToast('✅ 設定を保存しました');
}

// ===== Event Listeners =====
elements.recordBtn.addEventListener('click', () => {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

elements.clearBtn.addEventListener('click', () => {
    if (confirm('文字起こし結果をクリアしますか？')) {
        elements.transcription.value = '';
        updateCharCount();
    }
});

elements.downloadMarkdown.addEventListener('click', downloadMarkdown);
elements.downloadAudio.addEventListener('click', downloadAudio);

elements.settingsBtn.addEventListener('click', openSettings);
elements.closeModal.addEventListener('click', closeSettings);
elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
        closeSettings();
    }
});

elements.saveSettings.addEventListener('click', saveSettings);

elements.transcription.addEventListener('input', updateCharCount);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape' && elements.settingsModal.classList.contains('active')) {
        closeSettings();
    }
});

// ===== PWA Installation =====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showToast('💡 このアプリをホーム画面に追加できます', 5000);
});

window.addEventListener('appinstalled', () => {
    showToast('✅ アプリをインストールしました');
    deferredPrompt = null;
});

// ===== Service Worker Registration =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// ===== Initialize =====
updateCharCount();
updateAPISelection();
updateAPIKeyStatus();

console.log('🎤 音声メモアプリ初期化完了');
