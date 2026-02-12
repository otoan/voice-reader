// 記事データを保存する配列
let articles = [];
let speechRate = 1.0;
const synth = window.speechSynthesis;
let voices = [];

// ページ読み込み時
window.addEventListener('load', () => {
    loadArticles();
    renderArticles();
    loadSettings();
    populateVoiceList();
});

// 音声リストを読み込み
function populateVoiceList() {
    voices = synth.getVoices();
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    
    // 日本語の音声のみフィルタ
    const japaneseVoices = voices.filter(voice => voice.lang.includes('ja'));
    
    select.innerHTML = '<option value="">-- Select Voice --</option>';
    japaneseVoices.forEach((voice, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(opt);
    });
}

// 音声リストの再読み込み
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// 速度変更
document.getElementById('speedRange').addEventListener('input', (e) => {
    speechRate = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    localStorage.setItem('speechRate', speechRate);
});

// 音声変更
document.getElementById('voiceSelect').addEventListener('change', (e) => {
    localStorage.setItem('voiceIndex', e.target.value);
});

// 記事を追加
document.getElementById('addBtn').addEventListener('click', addArticle);
document.getElementById('articleUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addArticle();
});

async function addArticle() {
    const input = document.getElementById('articleUrl');
    const status = document.getElementById('status');
    const url = input.value.trim();
    
    if (!url) {
        alert('URLを入力してください');
        return;
    }

    status.textContent = "⏳ 記事を取得中...";
    
    try {
        // Jina AI Readerを使用して記事内容を取得
        const res = await fetch('https://r.jina.ai/' + url);
        const text = await res.text();
        
        // タイトルを抽出（最初の行から）
        const lines = text.split('\n').filter(line => line.trim());
        const title = lines[0] ? lines[0].substring(0, 100) : "無題の記事";
        
        // 本文を取得（最初の行以降）
        const content = lines.slice(1).join('\n').trim() || "内容を取得できませんでした";
        
        const article = {
            id: Date.now(),
            title: title,
            url: url,
            content: content,
            savedDate: new Date().toISOString()
        };
        
        articles.unshift(article);
        saveArticles();
        renderArticles();
        input.value = '';
        status.textContent = "✅ 追加完了！";
        
        setTimeout(() => {
            status.textContent = "";
        }, 2000);
        
    } catch (error) {
        console.error('記事の取得に失敗:', error);
        status.textContent = "❌ 取得に失敗しました";
        
        setTimeout(() => {
            status.textContent = "";
        }, 2000);
    }
}

// 記事リストを表示
function renderArticles() {
    const listElement = document.getElementById('articleList');
    
    if (articles.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <p>📝 No articles yet</p>
                <p style="font-size: 14px; margin-top: 8px;">Add a URL to get started</p>
            </div>
        `;
        return;
    }
    
    listElement.innerHTML = articles.map(article => `
        <div class="article-item" data-id="${article.id}">
            <div class="article-title">${escapeHtml(article.title)}</div>
            <div class="article-url">${escapeHtml(article.url)}</div>
            <div class="article-content">${escapeHtml(article.content.substring(0, 150))}...</div>
            <div class="article-controls">
                <button class="btn btn-play" onclick="playArticle(${article.id})">▶ Play</button>
                <button class="btn btn-pause" onclick="stopSpeech()">⏹ Stop</button>
                <button class="btn btn-delete" onclick="deleteArticle(${article.id})">🗑 Delete</button>
            </div>
        </div>
    `).join('');
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 記事を再生
function playArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    
    synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(article.content);
    utterance.lang = 'ja-JP';
    utterance.rate = speechRate;
    
    // 選択された音声を適用
    const select = document.getElementById('voiceSelect');
    if (select.value !== "") {
        const japaneseVoices = voices.filter(v => v.lang.includes('ja'));
        utterance.voice = japaneseVoices[select.value];
    }
    
    utterance.onend = () => {
        console.log('読み上げ完了');
    };
    
    utterance.onerror = (e) => {
        console.error('読み上げエラー:', e);
    };
    
    synth.speak(utterance);
}

// 停止
function stopSpeech() {
    synth.cancel();
}

// 記事を削除
function deleteArticle(id) {
    if (!confirm('この記事を削除しますか？')) return;
    
    articles = articles.filter(a => a.id !== id);
    saveArticles();
    renderArticles();
}

// LocalStorageに保存
function saveArticles() {
    localStorage.setItem('articles', JSON.stringify(articles));
}

// LocalStorageから読み込み
function loadArticles() {
    const saved = localStorage.getItem('articles');
    if (saved) {
        try {
            articles = JSON.parse(saved);
        } catch (e) {
            console.error('記事の読み込みに失敗:', e);
            articles = [];
        }
    }
}

// 設定を読み込み
function loadSettings() {
    const savedRate = localStorage.getItem('speechRate');
    if (savedRate) {
        speechRate = parseFloat(savedRate);
        document.getElementById('speedRange').value = speechRate;
        document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    }
    
    const savedVoiceIndex = localStorage.getItem('voiceIndex');
    if (savedVoiceIndex) {
        document.getElementById('voiceSelect').value = savedVoiceIndex;
    }
}
