let articles = [];
let speechRate = 1.0;
let synth = window.speechSynthesis;
let voices = [];

window.onload = () => {
    const savedArticles = localStorage.getItem('articles');
    if (savedArticles) {
        articles = JSON.parse(savedArticles);
        renderArticles();
    }
    loadSettings();
    populateVoiceList();
};

function populateVoiceList() {
    voices = synth.getVoices();
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;
    voiceSelect.innerHTML = '<option value="">-- 音声を選択 --</option>';
    voices.forEach((voice, i) => {
        if (voice.lang.includes('ja') || voice.lang.includes('JP')) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        }
    });
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// 記事追加
async function addArticle() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    const status = document.getElementById('status');
    if (!url) return;
    status.innerHTML = "⏳ 取得中...";

    try {
        const response = await fetch('https://r.jina.ai/' + url);
        if (!response.ok) throw new Error();
        const text = await response.text();
        const title = text.split('\n')[0].substring(0, 50) || "無題の記事";
        
        const newArticle = { id: Date.now(), title: title, content: text, url: url };
        articles.unshift(newArticle);
        localStorage.setItem('articles', JSON.stringify(articles));
        renderArticles();
        urlInput.value = '';
        status.innerHTML = "✅ 記事を追加しました";
    } catch (e) {
        status.innerHTML = "❌ 取得失敗";
    }
}

// 表示更新（ボタンのクラス名を style.css に合わせました）
function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = '';
    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card'; // CSSの枠線を適用
        card.innerHTML = `
            <h3>${article.title}</h3>
            <p style="font-size:12px; color:gray; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${article.url}</p>
            <div class="controls">
                <button class="play-btn" onclick="speakArticle(${article.id})">▶ 再生</button>
                <button class="stop-btn" onclick="stopSpeech()">停止</button>
                <button class="delete-btn" onclick="deleteArticle(${article.id})">🗑 削除</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// 読み上げ実行（ここを修正しました）
function speakArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    synth.cancel(); // 二重再生防止

    const utterance = new SpeechSynthesisUtterance(article.content);
    utterance.rate = speechRate;
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect.value !== "") {
        utterance.voice = voices[voiceSelect.value];
    }
    synth.speak(utterance);
}

function stopSpeech() { synth.cancel(); }
function deleteArticle(id) {
    articles = articles.filter(a => a.id !== id);
    localStorage.setItem('articles', JSON.stringify(articles));
    renderArticles();
}

function loadSettings() {
    const savedRate = localStorage.getItem('speechRate');
    if (savedRate) {
        speechRate = parseFloat(savedRate);
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
