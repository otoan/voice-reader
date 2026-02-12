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
        
        // 不要な部分を削除（URL Source:, Markdown Source:などの行）
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
        
        // タイトルを抽出（最初の見出しまたは最初の行）
        const lines = cleanedText.split('\n').filter(line => line.trim());
        let title = "無題の記事";
        let contentStartIndex = 0;
        
        // # で始まる行をタイトルとして探す
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].trim();
            if (line.startsWith('#')) {
                title = line.replace(/^#+\s*/, '').substring(0, 100);
                contentStartIndex = i + 1;
                break;
            }
        }
        
        // タイトルが見つからない場合は最初の行を使用
        if (title === "無題の記事" && lines.length > 0) {
            title = lines[0].substring(0, 100);
            contentStartIndex = 1;
        }
        
        // 本文を取得
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

// 記事リストを表示
function renderArticles() {
    const listElement = docum