// ============================================
// KRYPTOHLÍDAČ - HLAVNÍ APLIKACE
// S vylepšeními: řazení, export CSV, neon glow, hodiny, skeleton
// ============================================

// DOM elementy
const cryptoGrid = document.getElementById('cryptoGrid');
const cryptoForm = document.getElementById('cryptoForm');
const cryptoInput = document.getElementById('cryptoInput');
const formError = document.getElementById('formError');
const darkModeToggle = document.getElementById('darkModeToggle');
const refreshAllBtn = document.getElementById('refreshAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const lastUpdateSpan = document.getElementById('lastUpdate');
const exportBtn = document.getElementById('exportBtn');
const liveClockSpan = document.getElementById('liveClock');

// Konfigurace
const API_BASE = 'https://api.coingecko.com/api/v3';
const VS_CURRENCY = 'czk';

// Store
let watchedCryptos = [];
let currentSort = 'name'; // name, price, change
let sortDirection = 'asc';

// ============================================
// LIVE HODINY
// ============================================
function updateClock() {
    if (liveClockSpan) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('cs-CZ', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        liveClockSpan.innerHTML = `<i class="far fa-clock"></i> <span>${timeString}</span>`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// ============================================
// SKELETON LOADING
// ============================================
function showSkeletonLoading() {
    cryptoGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        cryptoGrid.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-icon"></div>
                    <div class="skeleton-text">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-subtitle"></div>
                    </div>
                </div>
                <div class="skeleton-price"></div>
                <div class="skeleton-change"></div>
                <div class="skeleton-cap"></div>
            </div>
        `;
    }
}

// ============================================
// LOCALSTORAGE
// ============================================
function loadFromStorage() {
    const stored = localStorage.getItem('kryptoHlidac');
    if (stored) {
        try {
            watchedCryptos = JSON.parse(stored);
        } catch (e) {
            watchedCryptos = [];
        }
    }

    if (watchedCryptos.length === 0) {
        watchedCryptos = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
            { id: 'cardano', name: 'Cardano', symbol: 'ada' },
            { id: 'solana', name: 'Solana', symbol: 'sol' }
        ];
        saveToStorage();
    }
}

function saveToStorage() {
    localStorage.setItem('kryptoHlidac', JSON.stringify(watchedCryptos));
}

// ============================================
// API VOLÁNÍ
// ============================================
async function fetchCryptoData(cryptoId) {
    try {
        const url = `${API_BASE}/simple/price?ids=${cryptoId}&vs_currencies=${VS_CURRENCY}&include_24hr_change=true&include_market_cap=true`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) throw new Error('Příliš mnoho požadavků. Počkejte chvíli.');
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data[cryptoId]) {
            throw new Error(`Kryptoměna "${cryptoId}" nebyla nalezena.`);
        }

        return {
            price: data[cryptoId][VS_CURRENCY],
            change24h: data[cryptoId][`${VS_CURRENCY}_24h_change`],
            marketCap: data[cryptoId][`${VS_CURRENCY}_market_cap`]
        };
    } catch (error) {
        console.error('Chyba při fetch:', error);
        throw error;
    }
}

async function searchCrypto(query) {
    try {
        const url = `${API_BASE}/search?query=${encodeURIComponent(query.toLowerCase())}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Vyhledávání selhalo');
        const data = await response.json();

        if (data.coins && data.coins.length > 0) {
            const firstResult = data.coins[0];
            return {
                id: firstResult.id,
                name: firstResult.name,
                symbol: firstResult.symbol
            };
        }
        return null;
    } catch (error) {
        console.error('Chyba při vyhledávání:', error);
        throw error;
    }
}

// ============================================
// VALIDACE
// ============================================
function validateForm(inputValue) {
    if (!inputValue || inputValue.trim() === '') {
        formError.textContent = '❌ Prosím zadejte název kryptoměny.';
        formError.classList.add('show');
        return false;
    }

    if (inputValue.trim().length < 2) {
        formError.textContent = '❌ Název musí mít alespoň 2 znaky.';
        formError.classList.add('show');
        return false;
    }

    formError.classList.remove('show');
    return true;
}

// ============================================
// PŘIDÁNÍ KRYPTOMĚNY
// ============================================
async function addCrypto(cryptoQuery) {
    if (!validateForm(cryptoQuery)) return false;

    const submitBtn = document.querySelector('#cryptoForm button');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Vyhledávám...';
    }

    try {
        const cryptoInfo = await searchCrypto(cryptoQuery);

        if (!cryptoInfo) {
            formError.textContent = `❌ Kryptoměna "${cryptoQuery}" nebyla nalezena.`;
            formError.classList.add('show');
            return false;
        }

        const exists = watchedCryptos.some(c => c.id === cryptoInfo.id);
        if (exists) {
            formError.textContent = `⚠️ Kryptoměna ${cryptoInfo.name} již je v seznamu.`;
            formError.classList.add('show');
            return false;
        }

        watchedCryptos.push({
            id: cryptoInfo.id,
            name: cryptoInfo.name,
            symbol: cryptoInfo.symbol
        });
        saveToStorage();

        cryptoInput.value = '';
        formError.classList.remove('show');

        await renderCryptos();
        return true;
    } catch (error) {
        formError.textContent = `❌ Chyba: ${error.message}`;
        formError.classList.add('show');
        return false;
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-search"></i> Přidat';
        }
    }
}

// ============================================
// SMAZÁNÍ
// ============================================
function removeCrypto(cryptoId) {
    watchedCryptos = watchedCryptos.filter(c => c.id !== cryptoId);
    saveToStorage();
    renderCryptos();
}

function clearAllCryptos() {
    if (confirm('Opravdu chcete smazat všechny sledované kryptoměny?')) {
        watchedCryptos = [];
        saveToStorage();
        renderCryptos();
    }
}

// ============================================
// ŘAZENÍ
// ============================================
function sortCryptos(cryptosWithData, sortBy, direction) {
    const sorted = [...cryptosWithData];

    sorted.sort((a, b) => {
        let valA, valB;

        switch (sortBy) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'price':
                valA = a.data?.price || 0;
                valB = b.data?.price || 0;
                break;
            case 'change':
                valA = a.data?.change24h || -999;
                valB = b.data?.change24h || -999;
                break;
            default:
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
        }

        if (typeof valA === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return direction === 'asc' ? valA - valB : valB - valA;
        }
    });

    return sorted;
}

// ============================================
// EXPORT CSV
// ============================================
function exportToCSV() {
    const cards = document.querySelectorAll('.crypto-card');
    if (cards.length === 0) {
        alert('Žádná data k exportu.');
        return;
    }

    let csv = '\uFEFFNázev;Symbol;Cena (CZK);24h změna (%);Tržní kapitalizace (CZK)\n';

    cards.forEach(card => {
        const name = card.querySelector('h3')?.innerText || '';
        const symbol = card.querySelector('.crypto-name p')?.innerText || '';
        let price = card.querySelector('.price')?.innerText || '';
        price = price.replace(' Kč', '').replace(/\s/g, '');
        let change = card.querySelector('.change')?.innerText || '';
        change = change.replace('▲', '').replace('▼', '').replace('%', '').trim();
        let marketCap = card.querySelector('.market-cap')?.innerText || '';
        marketCap = marketCap.replace('Tržní kapitalizace: ', '').replace(' Kč', '').replace(/\s/g, '');

        csv += `"${name}";"${symbol}";${price};${change};${marketCap}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krypto-hlidac-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// RENDER KRYPTOMĚN
// ============================================
async function renderCryptos() {
    if (watchedCryptos.length === 0) {
        cryptoGrid.innerHTML = `
            <div class="card" style="grid-column: 1/-1; text-align: center;">
                <i class="fas fa-database" style="font-size: 3rem; color: #f59e0b;"></i>
                <p style="margin-top: 15px;">Zatím nemáte žádné sledované kryptoměny.</p>
                <p>Přidejte nějakou pomocí formuláře výše!</p>
            </div>
        `;
        updateLastUpdateTime();
        return;
    }

    showSkeletonLoading();

    const cryptoDataPromises = watchedCryptos.map(async (crypto) => {
        try {
            const data = await fetchCryptoData(crypto.id);
            return { ...crypto, data, error: null };
        } catch (error) {
            return { ...crypto, data: null, error: error.message };
        }
    });

    let cryptosWithData = await Promise.all(cryptoDataPromises);
    cryptosWithData = sortCryptos(cryptosWithData, currentSort, sortDirection);

    let html = '';

    for (const crypto of cryptosWithData) {
        const price = crypto.data?.price || 0;
        const change24h = crypto.data?.change24h || 0;
        const marketCap = crypto.data?.marketCap || 0;
        const isPositive = change24h >= 0;
        const errorMsg = crypto.error;

        const formattedPrice = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);

        const formattedMarketCap = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(marketCap);

        const changePercent = Math.abs(change24h).toFixed(2);
        const changeSymbol = isPositive ? '▲' : '▼';
        const iconSymbol = crypto.symbol.substring(0, 2).toUpperCase();

        html += `
            <div class="crypto-card" data-id="${crypto.id}" data-price="${price}" data-change="${change24h}">
                <div class="crypto-header">
                    <div class="crypto-icon">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="crypto-name">
                        <h3>${escapeHtml(crypto.name)}</h3>
                        <p>${escapeHtml(crypto.symbol.toUpperCase())}</p>
                    </div>
                    <button class="delete-crypto" data-id="${crypto.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ${errorMsg ? `
                    <div class="error" style="color: #ef4444; padding: 10px;">
                        <i class="fas fa-exclamation-triangle"></i> ${escapeHtml(errorMsg)}
                    </div>
                ` : `
                    <div class="price ${isPositive ? 'positive' : 'negative'}">
                        ${formattedPrice}
                    </div>
                    <div class="change ${isPositive ? 'positive' : 'negative'}">
                        <i class="fas ${isPositive ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                        ${changeSymbol} ${changePercent}%
                    </div>
                    <div class="market-cap">
                        <i class="fas fa-chart-simple"></i> Tržní kapitalizace: ${formattedMarketCap}
                    </div>
                `}
            </div>
        `;
    }

    cryptoGrid.innerHTML = html;

    document.querySelectorAll('.delete-crypto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cryptoId = btn.getAttribute('data-id');
            removeCrypto(cryptoId);
        });
    });

    updateLastUpdateTime();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================
// OBNOVENÍ
// ============================================
async function refreshAllData() {
    if (watchedCryptos.length === 0) return;

    refreshAllBtn.disabled = true;
    refreshAllBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Aktualizuji...';

    await renderCryptos();

    refreshAllBtn.disabled = false;
    refreshAllBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Obnovit';
}

// ============================================
// DARK MODE
// ============================================
function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Light mode</span>';
    }

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');

        if (isDark) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Light mode</span>';
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i><span>Dark mode</span>';
        }
    });
}

// ============================================
// ČAS AKTUALIZACE
// ============================================
function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('cs-CZ', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    if (lastUpdateSpan) {
        lastUpdateSpan.innerHTML = `<i class="far fa-clock"></i> Poslední aktualizace: ${formattedTime}`;
    }
}

// ============================================
// INICIALIZACE ŘAZENÍ
// ============================================
function initSorting() {
    const sortBtns = document.querySelectorAll('.sort-btn');

    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sortType = btn.getAttribute('data-sort');

            if (currentSort === sortType) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = sortType;
                sortDirection = 'asc';
            }

            sortBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            renderCryptos();
        });
    });
}

// ============================================
// INICIALIZACE
// ============================================
async function init() {
    loadFromStorage();
    initDarkMode();
    await renderCryptos();
    initSorting();

    cryptoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = cryptoInput.value.trim();
        await addCrypto(value);
    });

    if (refreshAllBtn) refreshAllBtn.addEventListener('click', refreshAllData);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllCryptos);
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

    setInterval(() => {
        if (watchedCryptos.length > 0) {
            refreshAllData();
        }
    }, 60000);

    console.log('✅ KryptoHlídač inicializován s vylepšeními!');
}

document.addEventListener('DOMContentLoaded', init);