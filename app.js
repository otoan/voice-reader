// 記事データと設定
let articles = [];
let speechRate = 1.0;
const synth = window.speechSynthesis;
let voices = [];
let dictionary = {};
let currentUtterance = null;
let isPaused = false;
let currentArticleId = null;
let selectedLanguage = 'ja'; // デフォルトは日本語

// スプレッドシートのURL
const DICTIONARY_URL = 'https://docs.google.com/spreadsheets/d/1uDybkx1ZhTGUaqBA9K7VZsSiPuSVAb8t-E5WaUKUHyM/export?format=csv&gid=1244626711';

// ダークモード切り替え
function toggleDarkMode() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const button = document.getElementById('darkModeToggle');
    
    html.setAttribute('data-theme', newTheme);
    button.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    
    localStorage.setItem('theme', newTheme);
}

// テーマを読み込み
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const button = document.getElementById('darkModeToggle');
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (button) {
        button.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// ページ読み込み時
window.addEventListener('load', () => {
    loadTheme();
    loadArticles();
    renderArticles();
    loadSettings();
    populateVoiceList();
    loadDictionary();
    handleSharedUrl();
});

// タブ切り替え
function switchTab(tab) {
    const urlTab = document.getElementById('urlTab');
    const textTab = document.getElementById('textTab');
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'url') {
        urlTab.style.display = 'flex';
        textTab.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        urlTab.style.display = 'none';
        textTab.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

// 共有URLを処理
function handleSharedUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedUrl = urlParams.get('url') || urlParams.get('text');
    
    if (sharedUrl) {
        try {
            new URL(sharedUrl);
            document.getElementById('articleUrl').value = sharedUrl;
            setTimeout(() => {
                addArticleFromUrl();
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 500);
        } catch (e) {
            console.log('無効なURL:', sharedUrl);
            if (sharedUrl) {
                document.getElementById('articleUrl').value = sharedUrl;
            }
        }
    }
}

// 辞書を読み込む
async function loadDictionary() {
    try {
        const response = await fetch(DICTIONARY_URL);
        const csvText = await response.text();
        const lines = csvText.split('\n');
        dictionary = {};
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',');
            if (parts.length >= 2) {
                const original = parts[0].trim();
                const reading = parts[1].trim();
                if (original && reading) {
                    dictionary[original] = reading;
                }
            }
        }
        
        console.log('辞書を読み込みました:', Object.keys(dictionary).length + '件');
    } catch (error) {
        console.error('辞書の読み込みに失敗:', error);
    }
}

// テキストを辞書で置換
function applyDictionary(text) {
    let result = text;
    for (const [original, reading] of Object.entries(dictionary)) {
        const regex = new RegExp(original, 'gi');
        result = result.replace(regex, reading);
    }
    return result;
}

// テキストをクリーニング（強化版）+ 間を追加
function cleanTextForSpeech(text) {
    let cleaned = text;
    
    // ナビゲーション的な文言を除去
    const navPatterns = [
        /ホーム|トップ|メニュー|ログイン|新規登録|お問い合わせ|プライバシーポリシー|利用規約/gi,
        /フォロー|シェア|いいね|コメント|ブックマーク/gi,
        /前の記事|次の記事|関連記事|おすすめ記事/gi,
        /カテゴリー|タグ|検索/gi
    ];
    
    // 画像のMarkdown記法を削除
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');
    
    // リンクのMarkdown記法を削除
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    // URL全般を削除
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Markdown見出し記号を削除（ただし、後で間を入れるためマーカーを残す）
    cleaned = cleaned.replace(/^#{1,2}\s+(.+)$/gm, '【見出し大】$1【見出し大終】');
    cleaned = cleaned.replace(/^#{3,6}\s+(.+)$/gm, '【見出し小】$1【見出し小終】');
    
    // 太字・斜体記号を削除
    cleaned = cleaned.replace(/\*\*([^\*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^\*]+)\*/g, '$1');
    
    // コードブロックを削除
    cleaned = cleaned.replace(/```[^`]*```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    
    // 引用記号を削除
    cleaned = cleaned.replace(/^>\s*/gm, '');
    
    // 水平線を削除（ただし間を入れる）
    cleaned = cleaned.replace(/^---+$/gm, '【段落区切り】');
    cleaned = cleaned.replace(/^\*\*\*+$/gm, '【段落区切り】');
    
    // 連続する空白行（2行以上の改行）に間を入れる
    cleaned = cleaned.replace(/\n\n+/g, '【段落区切り】');
    
    // 間を入れる処理（SSMLのpauseタグは使えないので、句点と空白で代用）
    cleaned = cleaned.replace(/【見出し大】/g, '。 。 '); // 大見出しの前に長めの間
    cleaned = cleaned.replace(/【見出し大終】/g, '。 '); // 大見出しの後に間
    cleaned = cleaned.replace(/【見出し小】/g, '。 '); // 小見出しの前に間
    cleaned = cleaned.replace(/【見出し小終】/g, '。 '); // 小見出しの後に間
    cleaned = cleaned.replace(/【段落区切り】/g, '。 '); // 段落の間
    
    // 連続する句点を整理
    cleaned = cleaned.replace(/。{3,}/g, '。 。 ');
    
    // 連続する空白を整理
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    return cleaned.trim();
}

// 音声リストを読み込み
function populateVoiceList() {
    voices = synth.getVoices();
    updateVoiceSelect();
}

// 音声セレクトボックスを更新
function updateVoiceSelect() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    
    const langFilter = selectedLanguage;
    let filteredVoices = voices;
    
    if (langFilter === 'ja') {
        filteredVoices = voices.filter(voice => voice.lang.includes('ja'));
    } else if (langFilter === 'en') {
        filteredVoices = voices.filter(voice => voice.lang.includes('en'));
    } else if (langFilter === 'fr') {
        filteredVoices = voices.filter(voice => voice.lang.includes('fr'));
    }
    
    select.innerHTML = '<option value="">-- デフォルト音声 --</option>';
    filteredVoices.forEach((voice, i) => {
        const opt = document.createElement('option');
        opt.value = voices.indexOf(voice); // 全体リストのインデックスを保存
        opt.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(opt);
    });
    
    const savedVoiceIndex = localStorage.getItem('voiceIndex');
    if (savedVoiceIndex && savedVoiceIndex !== "") {
        select.value = savedVoiceIndex;
    }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// 言語選択の変更
document.getElementById('languageSelect').addEventListener('change', (e) => {
    selectedLanguage = e.target.value;
    updateVoiceSelect();
    localStorage.setItem('selectedLanguage', selectedLanguage);
});

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

// URL入力から記事を追加
document.getElementById('addUrlBtn').addEventListener('click', addArticleFromUrl);
document.getElementById('articleUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addArticleFromUrl();
});

// テキスト入力から記事を追加
document.getElementById('addTextBtn').addEventListener('click', addArticleFromText);

async function addArticleFromUrl() {
    const input = document.getElementById('articleUrl');
    const status = document.getElementById('status');
    const url = input.value.trim();
    
    if (!url) {
        alert('URLを入力してください');
        return;
    }

    status.textContent = "⏳ 記事を取得中...";
    
    try {
        const res = await fetch('https://r.jina.ai/' + url);
        const text = await res.text();
        
        let cleanedText = text
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('URL Source:') && 
                       !trimmed.startsWith('Markdown Source:') &&
                       !trimmed.startsWith('Title:') &&
                       trimmed.length > 0;
            })
            .join('\n');
        
        const lines = cleanedText.split('\n').filter(line => line.trim());
        let title = "無題の記事";
        let contentStartIndex = 0;
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].trim();
            if (line.startsWith('#')) {
                title = line.replace(/^#+\s*/, '').substring(0, 100);
                contentStartIndex = i + 1;
                break;
            }
        }
        
        if (title === "無題の記事" && lines.length > 0) {
            title = lines[0].substring(0, 100);
            contentStartIndex = 1;
        }
        
        const content = lines.slice(contentStartIndex).join('\n').trim() || "内容を取得できませんでした";
        
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

function addArticleFromText() {
    const textInput = document.getElementById('articleText');
    const titleInput = document.getElementById('articleTitle');
    const status = document.getElementById('status');
    
    const content = textInput.value.trim();
    const title = titleInput.value.trim() || "無題のテキスト";
    
    if (!content) {
        alert('テキストを入力してください');
        return;
    }
    
    const article = {
        id: Date.now(),
        title: title,
        url: '',
        content: content,
        savedDate: new Date().toISOString()
    };
    
    articles.unshift(article);
    saveArticles();
    renderArticles();
    
    textInput.value = '';
    titleInput.value = '';
    status.textContent = "✅ 追加完了！";
    
    setTimeout(() => {
        status.textContent = "";
    }, 2000);
}

// 記事リストを表示
function renderArticles() {
    const listElement = document.getElementById('articleList');
    
    if (articles.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <p>📝 No articles yet</p>
                <p style="font-size: 14px; margin-top: 8px;">Add a URL or text to get started</p>
            </div>
        `;
        return;
    }
    
    listElement.innerHTML = articles.map(article => {
        const isPlaying = currentArticleId === article.id && synth.speaking;
        const urlLink = article.url ? 
            `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="article-url">${escapeHtml(article.url)}</a>` :
            `<div class="article-url" style="color: #999;">テキスト入力</div>`;
        
        return `
            <div class="article-item" data-id="${article.id}">
                <div class="article-title">${escapeHtml(article.title)}</div>
                ${urlLink}
                <div class="article-content">${escapeHtml(article.content.substring(0, 150))}...</div>
                <div class="article-meta">
                    <small>文字数: ${article.content.length.toLocaleString()}文字</small>
                </div>
                <div class="article-controls">
                    ${isPlaying ? 
                        `<button class="btn btn-pause" onclick="pauseArticle(${article.id})">${isPaused ? '▶ 再開' : '⏸ 一時停止'}</button>` :
                        `<button class="btn btn-play" onclick="playArticle(${article.id})">▶ Play</button>`
                    }
                    <button class="btn btn-pause" onclick="stopSpeech()">⏹ Stop</button>
                    <button class="btn btn-delete" onclick="deleteArticle(${article.id})">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');
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
    if (!article) {
        console.error('記事が見つかりません:', id);
        return;
    }
    
    console.log('再生開始:', article.title);
    console.log('元の文字数:', article.content.length);
    
    synth.cancel();
    currentArticleId = id;
    isPaused = false;
    
    const maxLength = 32000;
    let textToSpeak = article.content;
    
    if (textToSpeak.length > maxLength) {
        if (!confirm(`この記事は${textToSpeak.length.toLocaleString()}文字あります。最初の${maxLength.toLocaleString()}文字のみ読み上げますか？`)) {
            return;
        }
        textToSpeak = textToSpeak.substring(0, maxLength);
    }
    
    textToSpeak = cleanTextForSpeech(textToSpeak);
    textToSpeak = applyDictionary(textToSpeak);
    
    console.log('クリーニング後の文字数:', textToSpeak.length);
    console.log('最初の100文字:', textToSpeak.substring(0, 100));
    
    if (!textToSpeak || textToSpeak.length === 0) {
        alert('読み上げるテキストがありません。記事の取得に失敗している可能性があります。');
        return;
    }
    
    currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance.lang = 'ja-JP';
    currentUtterance.rate = speechRate;
    
    console.log('音声設定:', {
        lang: currentUtterance.lang,
        rate: currentUtterance.rate,
        voice: currentUtterance.voice
    });
    
    const select = document.getElementById('voiceSelect');
    if (select.value !== "") {
        currentUtterance.voice = voices[select.value]; // 全体リストから直接取得
        console.log('選択された音声:', currentUtterance.voice);
    }
    
    currentUtterance.onstart = () => {
        console.log('✅ 読み上げ開始成功');
        const status = document.getElementById('status');
        if (status) status.textContent = "🔊 読み上げ中...";
        renderArticles();
    };
    
    currentUtterance.onend = () => {
        console.log('✅ 読み上げ完了');
        const status = document.getElementById('status');
        if (status) status.textContent = "";
        currentArticleId = null;
        renderArticles();
    };
    
    currentUtterance.onerror = (e) => {
        console.error('❌ 読み上げエラー:', e);
        console.error('エラーの種類:', e.error);
        console.error('エラー時の文字位置:', e.charIndex);
        const status = document.getElementById('status');
        if (status) status.textContent = `❌ 読み上げエラー: ${e.error}`;
        currentArticleId = null;
        renderArticles();
    };
    
    console.log('🎤 speak()を呼び出します...');
    
    // 言語に応じてlangを設定
    if (selectedLanguage === 'en') {
        currentUtterance.lang = 'en-US';
    } else if (selectedLanguage === 'fr') {
        currentUtterance.lang = 'fr-FR';
    } else if (selectedLanguage === 'ja') {
        currentUtterance.lang = 'ja-JP';
    }
    
    synth.speak(currentUtterance);
    console.log('speechSynthesis.speaking:', synth.speaking);
    console.log('speechSynthesis.pending:', synth.pending);
    renderArticles();
    
    // タイムアウトチェック（5秒経っても開始しない場合）
    setTimeout(() => {
        if (!synth.speaking && currentArticleId === id) {
            console.error('⚠️ 5秒経っても読み上げが開始されません');
            alert('読み上げが開始されませんでした。\n\n対処法:\n1. 音声を「デフォルト音声」に変更\n2. ブラウザを再読み込み(F5)\n3. 別のブラウザで試す');
            currentArticleId = null;
            renderArticles();
        }
    }, 5000);
}

// 一時停止/再開
function pauseArticle(id) {
    if (isPaused) {
        synth.resume();
        isPaused = false;
    } else {
        synth.pause();
        isPaused = true;
    }
    renderArticles();
}

function stopSpeech() {
    synth.cancel();
    currentArticleId = null;
    isPaused = false;
    const status = document.getElementById('status');
    if (status) status.textContent = "";
    renderArticles();
}

function deleteArticle(id) {
    if (!confirm('この記事を削除しますか？')) return;
    
    articles = articles.filter(a => a.id !== id);
    saveArticles();
    renderArticles();
}

function saveArticles() {
    localStorage.setItem('articles', JSON.stringify(articles));
}

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
    
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
        selectedLanguage = savedLanguage;
        document.getElementById('languageSelect').value = savedLanguage;
        updateVoiceSelect();
    }
}
