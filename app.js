let articles = [];
let speechRate = 1.0;
const synth = window.speechSynthesis;
let voices = [];

// 1. 初期化
window.onload = () => {
    const saved = localStorage.getItem('articles');
    if (saved) {
        articles = JSON.parse(saved);
        renderArticles();
    }
    loadSettings();
    populateVoiceList();
};

// 2. 音声リスト（これがないと再生されません）
function populateVoiceList() {
    voices = synth.getVoices();
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- 音声を選択 --</option>';
    voices.forEach((voice, i) => {
        if (voice.lang.includes('ja')) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = voice.name;
            select.appendChild(opt);
        }
    });
}
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// 3. 記事追加（Jina AIを使用）
async function addArticle() {
    const input = document.getElementById('urlInput');
    const status = document.getElementById('status');
    const url = input.value.trim();
    if (!url) return;

    status.textContent = "⏳ 取得中...";
    try {
        const res = await fetch('https://r.jina.ai/' + url);
        const text = await res.text();
        const title = text.split('\n')[0].substring(0, 40) || "無題の記事";
        
        articles.unshift({ id: Date.now(), title, content: text, url });
        localStorage.setItem('articles', JSON.stringify(articles));
        renderArticles();
        input.value = '';
        status.textContent = "✅ 追加完了";
    } catch (e) {
        status.textContent = "❌ 失敗";
    }
}

// 4. 表示（あなたのCSSクラス名に合わせてボタンを作成）
function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = '';
    articles.forEach(art => {
        const div = document.createElement('div');
        div.className = 'article-card';
        div.innerHTML = `
            <h3>${art.title}</h3>
            <div class="controls" style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="speakArticle(${art.id})" style="background:#34c759; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer;">▶ 再生</button>
                <button onclick="stopSpeech()" style="background:#8e8e93; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer;">停止</button>
                <button onclick="deleteArticle(${art.id})" style="background:#ff3b30; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer;">削除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 5. 再生（ここを一番シンプルにしました）
function speakArticle(id) {
    const art = articles.find(a => a.id === id);
    if (!art) return;
    synth.cancel(); 

    const uttr = new SpeechSynthesisUtterance(art.content);
    uttr.rate = speechRate;
    const select = document.getElementById('voiceSelect');
    if (select.value !== "") {
        uttr.voice = voices[select.value];
    }
    synth.speak(uttr);
}

function stopSpeech() { synth.cancel(); }
function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
    localStorage.setItem('articles', JSON.stringify(articles));
    renderArticles();
}
function loadSettings() {
    const rate = localStorage.getItem('speechRate');
    if (rate) {
        speechRate = parseFloat(rate);
        document.getElementById('speedRange').value = speechRate;
        document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    }
}
document.getElementById('speedRange').oninput = (e) => {
    speechRate = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = speechRate.toFixed(1) + 'x';
    localStorage.setItem('speechRate', speechRate);
};
document.getElementById('addBtn').onclick = addArticle;