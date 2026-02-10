let articles = [];
let speechRate = 1.0;
let synth = window.speechSynthesis;
let voices = [];

// ページ読み込み時の処理
window.onload = () => {
    const savedArticles = localStorage.getItem('articles');
    if (savedArticles) {
        articles = JSON.parse(savedArticles);
        renderArticles();
    }
    loadSettings();
    populateVoiceList(); // 音声リスト作成
};

// 【重要】音声リストを作成する関数（これがないと選べません）
function populateVoiceList() {
    voices = synth.getVoices();
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    voiceSelect.innerHTML = '<option value="">-- 音声を選択 --</option>';
    
    // 日本語の音声を優先的に追加
    voices.forEach((voice, i) => {
        if (voice.lang.includes('ja') || voice.lang.includes('JP')) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        }
    });
}

// iOS/Safari対策：音声がロードされたらリストを更新
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// 共有ターゲットからのデータ受け取り
window.addEventListener('DOMContentLoaded', () => {
    const parsedUrl = new URL(window.location);
    const sharedUrl = parsedUrl.searchParams.get('url') || parsedUrl.searchParams.get('text');

    if (sharedUrl) {
        document.getElementById('urlInput').value = sharedUrl;
        addArticle();
    }
});

async function addArticle() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    const status = document.getElementById('status');

    if (!url) return;
    status.textContent = "⏳ 記事を解析しています...";

    try {
        const proxyUrl = 'https://r.jina.ai/' + url;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('取得失敗');
        const text = await response.text();

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const title = lines[0] || "無題の記事";

        const newArticle = {
            id: Date.now(),
            title: title,
            content: text,
            url: url
        };

        articles.unshift(newArticle);
        saveArticles();
        renderArticles();
        urlInput.value = '';
        status.textContent = "✅ 記事を追加しました";
    } catch (error) {
        status.textContent = "❌ 取得に失敗しました";
    }
}

function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = '';
    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `
            <h3>${article.title}</h3>
            <div class="controls">
                <button onclick="speakArticle(${article.id})" class="play-btn">▶ 再生</button>
                <button onclick="stopSpeech()" class="stop-btn">停止</button>
                <button onclick="deleteArticle(${article.id})" class="delete-btn">🗑 削除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function speakArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(article.content);
    utterance.rate = speechRate;
    
    // 選択された音声を設定
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect.value !== "") {
        utterance.voice = voices[voiceSelect.value];
    }
    
    synth.speak(utterance);
}

function stopSpeech() { synth.cancel(); }
function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
    saveArticles();
    renderArticles();
}
function saveArticles() { localStorage.setItem('articles', JSON.stringify(articles)); }
function loadSettings() {
    const savedRate = localStorage.getItem('speechRate');
    if (savedRate) {
        speechRate = parseFloat(savedRate);
        document.getElementById('speedRange').value = speechRate;
        document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    }
}

document.getElementById('speedRange').addEventListener('input', (e) => {
    speechRate = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    localStorage.setItem('speechRate', speechRate);
});
document.getElementById('addBtn').addEventListener('click', addArticle);