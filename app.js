// 状態管理
let articles = [];
let currentUtterance = null;
let speechRate = 1.0;
let selectedVoice = null;

// 1. ページ読み込み時の処理
window.addEventListener('load', async () => {
    loadArticles();
    renderArticles();
    setupVoices();
    loadSettings();

    // iPhoneの共有（Share Target）から送られてきたURLをチェック
    const parsedUrl = new URL(window.location.href);
    const sharedUrl = parsedUrl.searchParams.get('url') || parsedUrl.searchParams.get('text');
    
    if (sharedUrl) {
        // URLらしき文字列が含まれているか確認
        const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            document.getElementById('articleUrl').value = urlMatch[0];
            addArticle(); // 自動で追加処理を開始
            // URLパラメータを消して、リロードしても二重追加されないようにする
            window.history.replaceState({}, document.title, "/");
        }
    }
});

// 2. 音声設定（iOS/Safari対応）
function setupVoices() {
    const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const voiceSelect = document.getElementById('voiceSelect');
        
        // 日本語音声を抽出
        const japaneseVoices = voices.filter(v => v.lang.includes('ja') || v.lang.includes('JP'));
        
        if (japaneseVoices.length > 0) {
            voiceSelect.innerHTML = japaneseVoices.map((v, i) => 
                `<option value="${i}">${v.name}</option>`
            ).join('');
            selectedVoice = japaneseVoices[0];
        }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

// 3. 記事追加とスクレイピング
async function addArticle() {
    const urlInput = document.getElementById('articleUrl');
    const url = urlInput.value.trim();
    const status = document.getElementById('statusMessage');
    
    if (!url) return;
    
    const id = Date.now();
    const newArticle = {
        id: id,
        title: "読込中...",
        url: url,
        content: "内容を取得しています...",
        savedDate: new Date().toISOString()
    };

    articles.unshift(newArticle);
    renderArticles();
    urlInput.value = '';
    status.textContent = "⌛ 記事を解析しています...";

    try {
        // CORS回避のためプロキシを経由してHTMLを取得
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const html = data.contents;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // タイトル取得（titleタグまたはOGP）
        const title = doc.querySelector('title')?.innerText || 
                      doc.querySelector('meta[property="og:title"]')?.content || "No Title";

        // 本文取得（articleタグ、またはメインっぽいところを抽出）
        const mainContent = doc.querySelector('article') || doc.querySelector('main') || doc.body;
        
        // 不要なタグ（script, style, navなど）を削除してテキスト抽出
        const scripts = mainContent.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach(s => s.remove());
        
        const text = mainContent.innerText
            .replace(/\s+/g, ' ') // 余分な空白・改行を整理
            .trim()
            .substring(0, 3000); // 読み上げ用に適度な長さで切る

        // データの更新
        const article = articles.find(a => a.id === id);
        article.title = title;
        article.content = text;
        
        status.textContent = "✅ 読み込み完了";
        setTimeout(() => status.textContent = "", 3000);

    } catch (error) {
        console.error(error);
        const article = articles.find(a => a.id === id);
        article.title = "取得失敗 (CORS制限など)";
        article.content = "この記事の内容は自動取得できませんでした。";
        status.textContent = "❌ 取得に失敗しました";
    }

    saveArticles();
    renderArticles();
}

// 4. 読み上げ機能
function playArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;

    speechSynthesis.cancel(); // 前の読み上げを停止

    const uttr = new SpeechSynthesisUtterance(article.content);
    uttr.lang = 'ja-JP';
    uttr.rate = speechRate;
    
    // 選択された音声を設定
    const voiceIndex = document.getElementById('voiceSelect').value;
    const voices = speechSynthesis.getVoices().filter(v => v.lang.includes('ja'));
    if (voices[voiceIndex]) {
        uttr.voice = voices[voiceIndex];
    }

    speechSynthesis.speak(uttr);
}

// --- 以下、補助関数（保存・表示など） ---

function renderArticles() {
    const list = document.getElementById('articleList');
    if (articles.length === 0) {
        list.innerHTML = '<div class="empty-state">記事がありません</div>';
        return;
    }
    list.innerHTML = articles.map(a => `
        <div class="article-item">
            <div class="article-title">${a.title}</div>
            <div class="article-url">${a.url}</div>
            <div class="article-controls">
                <button class="btn btn-play" onclick="playArticle(${a.id})">▶ 再生</button>
                <button class="btn btn-delete" onclick="deleteArticle(${a.id})">🗑 削除</button>
            </div>
        </div>
    `).join('');
}

function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
    saveArticles();
    renderArticles();
}

function saveArticles() { localStorage.setItem('articles', JSON.stringify(articles)); }
function loadArticles() {
    const saved = localStorage.getItem('articles');
    if (saved) articles = JSON.parse(saved);
}

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