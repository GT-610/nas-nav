// 缓存常用 DOM 元素
const domCache = {
    searchInput: document.getElementById('searchInput')
};

// 安全地转义 HTML
function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// 服务状态检测 
async function checkServiceStatus() {
    const cards = Array.from(document.querySelectorAll('.nav-card'));
    const requests = cards.map(card => {
        const ipUrl = card.querySelector('.btn-ip').href;
        return fetch(ipUrl, { mode: 'cors', cache: 'no-cache' }) // 考虑使用 cors 模式
            .then(() => card.classList.remove('offline'))
            .catch(() => card.classList.add('offline'));
    });

    await Promise.allSettled(requests);
}

function filterByCategory(category) {
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', `?category=${encodeURIComponent(category)}`);
    }
}

// 新增联合过滤逻辑
function applyCombinedFilter(term) {
    const cards = document.querySelectorAll('#cardContainer > .mdui-col');
    let hasVisible = false;

    cards.forEach(card => {
        const searchMatch = card.dataset.name.includes(term) ||
            card.dataset.search.includes(term);

        const shouldShow = searchMatch;
        card.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow) hasVisible = true;
    });

    // 更新空状态提示
    handleEmptyState(hasVisible);
}

// 错误处理 
function handleLoadingError(error) {
    console.error('Error:', error);
    const container = document.getElementById('cardContainer');
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <h5 class="text-danger">⚠️ 数据加载失败</h5>
            <p class="text-muted">${escapeHtml(error.message)}</p> 
            <button class="btn btn-secondary mt-3" onclick="location.reload()">重新加载</button>
        </div>
    `;
}

// 初始化加载 
document.addEventListener('DOMContentLoaded', function () {
    const tabContainer = document.getElementById('categoryTab');
    const cardContent = document.getElementById('cardContent');

    function loadContent(category, search) {
        fetch(`/api/card-content?category=${encodeURIComponent(category)}&search=${encodeURIComponent(search || '')}`)
            .then(response => response.text())
            .then(data => {
                cardContent.innerHTML = data;
            })
            .catch(error => {
                console.error('加载内容失败:', error);
            });
    }

    // 绑定分类点击事件
    tabContainer.addEventListener('click', function (event) {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const category = event.target.dataset.category;
            const search = new URLSearchParams(window.location.search).get('search');
            loadContent(category, search);
        }
    });

    // 页面加载时默认加载“全部”分类的内容
    const initialCategory = new URLSearchParams(window.location.search).get('category') || 'all';
    const initialSearch = new URLSearchParams(window.location.search).get('search') || '';
    loadContent(initialCategory, initialSearch);
});