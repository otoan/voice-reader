// 記事データを保存する配列
let articles = [];
let speechRate = 1.0;
let synth = window.speechSynthesis;

// ページ読み込み時の処理
window.onload = () => {
    const savedArticles = localStorage.getItem('articles');
    if (savedArticles) {
        articles = JSON.parse(savedArticles);
        renderArticles();
    }
    loadSettings();
};

// 共有ターゲット（PWA）からのデータ受け取り
window.addEventListener('DOMContentLoaded', () => {
    const parsedUrl = new URL(window.location);
    const sharedTitle = parsedUrl.searchParams.get('title');
    const sharedText = parsedUrl.searchParams.get('text');
    const sharedUrl = parsedUrl.searchParams.get('url');

    if (sharedUrl || sharedText) {
        const urlToFetch = sharedUrl || sharedText;
        document.getElementById('urlInput').value = urlToFetch;
        addArticle(); // 自動で取得を開始
    }
});

// 記事を追加・取得するメイン関数
async function addArticle() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    const status = document.getElementById('status');

    if (!url) return;

    status.textContent = "⏳ 記事を解析しています...";

    try {
        // jina.ai プロキシを使用してCORS制限を回避し、本文を抽出
        const proxyUrl = 'https://r.jina.ai/' + url;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('取得に失敗しました');
        
        const text = await response.text();

        // 簡易的なタイトル抽出（1行目をタイトルとする）
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const title = lines[0] || "無題の記事";
        const content = text;

        const newArticle = {
            id: Date.now(),
            title: title,
            content: content,
            url: url
        };

        articles.unshift(newArticle);
        saveArticles();
        renderArticles();
        urlInput.value = '';
        status.textContent = "✅ 記事を追加しました";

    } catch (error) {
        console.error(error);
        status.textContent = "❌ 取得に失敗しました（URLを確認してください）";
    }
}

// 記事一覧を表示
function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = '';

    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `
            <h3>${article.title}</h3>
            <p style="font-size: 0.8rem; color: #666;">${article.url}</p>
            <div class="controls">
                <button onclick="speakArticle(${article.id})" class="play-btn">▶ 再生</button>
                <button onclick="stopSpeech()" class="stop-btn">停止</button>
                <button onclick="deleteArticle(${article.id})" class="delete-btn">🗑 削除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// 音声読み上げ
function speakArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;

    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(article.content);
    utterance.rate = speechRate;
    utterance.lang = 'ja-JP';
    
    // 音声の選択（iOS対策）
    const voices = synth.getVoices();
    const japaneseVoice = voices.find(v => v.lang.includes('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;

    synth.speak(utterance);
}

function stopSpeech() {
    synth.cancel();
}

function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
    saveArticles();
    renderArticles();
}

function saveArticles() {
    localStorage.setItem('articles', JSON.stringify(articles));
}

function loadSettings() {
    const savedRate = localStorage.getItem('speechRate');
    if (savedRate) {
        speechRate = parseFloat(savedRate);
        document.getElementById('speedRange').value = speechRate;
        document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    }
}

// 設定変更のイベント
document.getElementById('speedRange').addEventListener('input', (e) => {
    speechRate = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    localStorage.setItem('speechRate', speechRate);
});

document.getElementById('addBtn').addEventListener('click', addArticle);