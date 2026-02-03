// DOM要素の取得
const setupMode = document.getElementById('setup-mode');
const typingMode = document.getElementById('typing-mode');
const completeMode = document.getElementById('complete-mode');
const textInput = document.getElementById('text-input');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const retryBtn = document.getElementById('retry-btn');
const targetText = document.getElementById('target-text');
const typedText = document.getElementById('typed-text');
const typingInput = document.getElementById('typing-input');
const lineProgress = document.getElementById('line-progress');

// 統計情報のDOM要素
const timeDisplay = document.getElementById('time');
const bpmDisplay = document.getElementById('bpm');
const keystrokesDisplay = document.getElementById('keystrokes');
const finalTimeDisplay = document.getElementById('final-time');
const finalBpmDisplay = document.getElementById('final-bpm');
const finalKeystrokesDisplay = document.getElementById('final-keystrokes');

// 状態管理
let lines = [];
let currentLineIndex = 0;
let startTime = null;
let timerInterval = null;
let totalKeystrokes = 0;

// 初期化
function init() {
    startBtn.addEventListener('click', handleStart);
    resetBtn.addEventListener('click', handleReset);
    retryBtn.addEventListener('click', handleRetry);
    typingInput.addEventListener('input', handleTyping);
}

// スタートボタンの処理
function handleStart() {
    const text = textInput.value.trim();

    if (!text) {
        alert('テキストを入力してください！');
        return;
    }

    // テキストをまず行ごとに分割
    const lineArray = text.split('\n').filter(line => line.trim() !== '');

    // 各行をさらに「。」で分割
    lines = [];
    lineArray.forEach(line => {
        // 各行を「。」で分割し、空でない部分のみを取得
        const sentences = line.split('。').filter(s => s.trim() !== '');

        // 「。」を末尾に追加（最後の文以外）
        sentences.forEach((sentence, index) => {
            if (index < sentences.length - 1 || line.endsWith('。')) {
                lines.push(sentence + '。');
            } else {
                // 元々「。」で終わっていない場合はそのまま
                lines.push(sentence);
            }
        });
    });

    if (lines.length === 0) {
        alert('有効なテキストを入力してください！');
        return;
    }

    // 初期化
    currentLineIndex = 0;
    totalKeystrokes = 0;
    startTime = Date.now();

    // UI切り替え
    setupMode.style.display = 'none';
    typingMode.style.display = 'block';

    // 最初の行を表示
    displayCurrentLine();

    // タイマー開始
    startTimer();

    // 入力欄にフォーカス
    typingInput.focus();
}

// 現在の行を表示
function displayCurrentLine() {
    targetText.textContent = lines[currentLineIndex];
    typedText.textContent = '';
    typingInput.value = '';
    lineProgress.textContent = `${currentLineIndex + 1} / ${lines.length}`;
}

// タイピング処理
function handleTyping(e) {
    const inputValue = e.target.value;
    const currentLine = lines[currentLineIndex];

    // 打鍵数をカウント（入力が増えた場合のみ）
    totalKeystrokes++;
    updateStats();

    // 入力内容を可視化
    visualizeTyping(inputValue, currentLine);

    // 一行完全一致チェック
    if (inputValue === currentLine) {
        // 次の行へ
        currentLineIndex++;

        // すべての行が完了したか確認
        if (currentLineIndex >= lines.length) {
            completeTyping();
        } else {
            // 次の行を表示
            setTimeout(() => {
                displayCurrentLine();
            }, 300); // 少し遅延を入れて達成感を演出
        }
    }
}

// 入力内容の可視化
function visualizeTyping(inputValue, targetLine) {
    let html = '';

    for (let i = 0; i < inputValue.length; i++) {
        const char = inputValue[i];
        const targetChar = targetLine[i];

        if (char === targetChar) {
            html += `<span class="char-correct">${escapeHtml(char)}</span>`;
        } else {
            html += `<span class="char-incorrect">${escapeHtml(char)}</span>`;
        }
    }

    typedText.innerHTML = html;
}

// HTML特殊文字のエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// タイマー開始
function startTimer() {
    timerInterval = setInterval(() => {
        updateStats();
    }, 100); // 100msごとに更新
}

// 統計情報の更新
function updateStats() {
    if (!startTime) return;

    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = elapsedMs / 1000;
    const elapsedMinutes = elapsedSeconds / 60;

    // タイム表示（mm:ss形式）
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // BPM計算（Beats Per Minute = 1分あたりの打鍵数）
    const bpm = elapsedMinutes > 0 ? Math.round(totalKeystrokes / elapsedMinutes) : 0;
    bpmDisplay.textContent = bpm;

    // 打鍵数
    keystrokesDisplay.textContent = totalKeystrokes;
}

// タイピング完了
function completeTyping() {
    // タイマー停止
    clearInterval(timerInterval);

    // 最終統計を表示
    finalTimeDisplay.textContent = timeDisplay.textContent;
    finalBpmDisplay.textContent = bpmDisplay.textContent;
    finalKeystrokesDisplay.textContent = keystrokesDisplay.textContent;

    // UI切り替え
    typingMode.style.display = 'none';
    completeMode.style.display = 'block';
}

// リセット処理
function handleReset() {
    if (confirm('本当にリセットしますか？')) {
        clearInterval(timerInterval);
        resetStats();

        typingMode.style.display = 'none';
        setupMode.style.display = 'block';
    }
}

// もう一度処理
function handleRetry() {
    resetStats();

    completeMode.style.display = 'none';
    setupMode.style.display = 'block';

    textInput.value = '';
    textInput.focus();
}

// 統計情報のリセット
function resetStats() {
    startTime = null;
    totalKeystrokes = 0;
    currentLineIndex = 0;
    lines = [];

    timeDisplay.textContent = '00:00';
    bpmDisplay.textContent = '0';
    keystrokesDisplay.textContent = '0';
}

// 初期化実行
init();
