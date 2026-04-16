// ============================================
// KryptoHlídač - Hlavní aplikace
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

// Konfigurace API
const API_BASE = 'https://api.coingecko.com/api/v3';
const VS_CURRENCY = 'czk'; // Měna: CZK

// Store sledovaných kryptoměn (ukládáme do localStorage)
let watchedCryptos = [];

// ============================================
// 1. NAČTENÍ Z LOCALSTORAGE
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

    // Pokud je prázdné, přidáme defaultní kryptoměny
    if (watchedCryptos.length === 0) {
        watchedCryptos = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
            { id: 'cardano', name: 'Cardano', symbol: 'ada' }
        ];
        saveToStorage();
    }
}

function saveToStorage() {
    localStorage.setItem('kryptoHlidac', JSON.stringify(watchedCryptos));
}

// ============================================
// 2. FETCH API - ZÍSKÁNÍ DAT O KYPTOMĚNĚ
// ============================================
async function fetchCryptoData(cryptoId) {
    try {
        const url = `${API_BASE}/simple/price?ids=${cryptoId}&vs_currencies=${VS_CURRENCY}&include_24hr_change=true&include_market_cap=true`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Příliš mnoho požadavků. Počkejte prosím chvíli.');
            }
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

// ============================================
// 3. ZÍSKÁNÍ DETAILŮ KRYTPOMĚNY (pro validaci)
// ============================================
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
// 4. VALIDACE FORMULÁŘE
// ============================================
function validateForm(inputValue) {
    // Prázdné pole
    if (!inputValue || inputValue.trim() === '') {
        formError.textContent = '❌ Prosím zadejte název kryptoměny.';
        formError.classList.add('show');
        return false;
    }

    // Minimální délka
    if (inputValue.trim().length < 2) {
        formError.textContent = '❌ Název musí mít alespoň 2 znaky.';
        formError.classList.add('show');
        return false;
    }

    formError.classList.remove('show');
    return true;
}

// ============================================
// 5. PŘIDÁNÍ NOVÉ KRYPTOMĚNY
// ============================================
async function addCrypto(cryptoQuery) {
    // Validace
    if (!validateForm(cryptoQuery)) return false;

    // Zobrazení načítání
    showLoadingState(true);

    try {
        // Vyhledání kryptoměny
        const cryptoInfo = await searchCrypto(cryptoQuery);

        if (!cryptoInfo) {
            formError.textContent = `❌ Kryptoměna "${cryptoQuery}" nebyla nalezena. Zkuste: bitcoin, ethereum, dogecoin...`;
            formError.classList.add('show');
            showLoadingState(false);
            return false;
        }

        // Kontrola, zda už není sledovaná
        const exists = watchedCryptos.some(c => c.id === cryptoInfo.id);
        if (exists) {
            formError.textContent = `⚠️ Kryptoměna ${cryptoInfo.name} již je v seznamu.`;
            formError.classList.add('show');
            showLoadingState(false);
            return false;
        }

        // Přidání do seznamu
        watchedCryptos.push({
            id: cryptoInfo.id,
            name: cryptoInfo.name,
            symbol: cryptoInfo.symbol
        });
        saveToStorage();

        // Vyčištění formuláře
        cryptoInput.value = '';
        formError.classList.remove('show');

        // Obnovení zobrazení
        await renderCryptos();

        return true;
    } catch (error) {
        formError.textContent = `❌ Chyba: ${error.message}`;
        formError.classList.add('show');
        return false;
    } finally {
        showLoadingState(false);
    }
}

// ============================================
// 6. SMAZÁNÍ KRYPTOMĚNY
// ============================================
function removeCrypto(cryptoId) {
    watchedCryptos = watchedCryptos.filter(c => c.id !== cryptoId);
    saveToStorage();
    renderCryptos();
}

// ============================================
// 7. SMAZÁNÍ VŠECH
// ============================================
function clearAllCryptos() {
    if (confirm('Opravdu chcete smazat všechny sledované kryptoměny?')) {
        watchedCryptos = [];
        saveToStorage();
        renderCryptos();
    }
}

// ============================================
// 8. RENDEROVÁNÍ KARET S ANIMACEMI
// ============================================
async function renderCryptos() {
    // Zobrazení spinneru při prázdném seznamu
    if (watchedCryptos.length === 0) {
        cryptoGrid.innerHTML = `
            <div class="card" style="grid-column: 1/-1; text-align: center;">
                <i class="fas fa-database" style="font-size: 3rem; color: #f7931a;"></i>
                <p style="margin-top: 15px;">Zatím nemáte žádné sledované kryptoměny.</p>
                <p>Přidejte nějakou pomocí formuláře výše!</p>
            </div>
        `;
        updateLastUpdateTime();
        return;
    }

    // Dočasně zobrazíme stará data s načítacími efekty
    const currentCards = document.querySelectorAll('.crypto-card');
    currentCards.forEach(card => {
        card.classList.add('updating');
    });

    // Načtení dat pro všechny kryptoměny
    const cryptoDataPromises = watchedCryptos.map(async (crypto) => {
        try {
            const data = await fetchCryptoData(crypto.id);
            return { ...crypto, data, error: null };
        } catch (error) {
            return { ...crypto, data: null, error: error.message };
        }
    });

    const cryptosWithData = await Promise.all(cryptoDataPromises);

    // Vytvoření HTML
    let html = '';

    for (const crypto of cryptosWithData) {
        const price = crypto.data?.price || 0;
        const change24h = crypto.data?.change24h || 0;
        const marketCap = crypto.data?.marketCap || 0;
        const isPositive = change24h >= 0;
        const errorMsg = crypto.error;

        // Formátování ceny
        const formattedPrice = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);

        // Formátování market cap
        const formattedMarketCap = new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(marketCap);

        // Změna v procentech
        const changePercent = change24h.toFixed(2);
        const changeSymbol = isPositive ? '▲' : '▼';

        // Ikona (jednoduchý fallback)
        const iconSymbol = crypto.symbol.substring(0, 2).toUpperCase();

        html += `
            <div class="crypto-card" data-id="${crypto.id}">
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
                    <div class="error" style="color: #e74c3c; padding: 10px;">
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

    // Odstranění animační třídy po krátké době
    setTimeout(() => {
        document.querySelectorAll('.crypto-card').forEach(card => {
            card.classList.remove('updating');
        });
    }, 500);

    // Přidání event listenerů pro tlačítka smazání
    document.querySelectorAll('.delete-crypto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cryptoId = btn.getAttribute('data-id');
            removeCrypto(cryptoId);
        });
    });

    updateLastUpdateTime();
}

// Helper pro escapování HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// 9. OBNOVENÍ VŠECH DAT
// ============================================
async function refreshAllData() {
    if (watchedCryptos.length === 0) return;

    refreshAllBtn.disabled = true;
    refreshAllBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Aktualizuji...';

    await renderCryptos();

    refreshAllBtn.disabled = false;
    refreshAllBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Obnovit všechny kurzy';
}

// ============================================
// 10. DARK MODE TOGGLE
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
// 11. AKTUALIZACE ČASU POSLEDNÍ OBNOVY
// ============================================
function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('cs-CZ', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    lastUpdateSpan.innerHTML = `<i class="far fa-clock"></i> Poslední aktualizace: ${formattedTime}`;
}

// ============================================
// 12. ZOBRAZENÍ STAVU NAČÍTÁNÍ
// ============================================
function showLoadingState(isLoading) {
    if (isLoading) {
        // Neměníme celý grid, jen přidáme indikátor
        const submitBtn = document.querySelector('#cryptoForm button');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Vyhledávám...';
        }
    } else {
        const submitBtn = document.querySelector('#cryptoForm button');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-search"></i> Přidat';
        }
    }
}

// ============================================
// 13. INICIALIZACE APLIKACE
// ============================================
async function init() {
    // Načtení z localStorage
    loadFromStorage();

    // Inicializace dark mode
    initDarkMode();

    // Render kryptoměn
    await renderCryptos();

    // Event listenery
    cryptoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = cryptoInput.value.trim();
        await addCrypto(value);
    });

    refreshAllBtn.addEventListener('click', refreshAllData);
    clearAllBtn.addEventListener('click', clearAllCryptos);

    // Automatická obnova každých 60 sekund
    setInterval(() => {
        if (watchedCryptos.length > 0) {
            refreshAllData();
        }
    }, 60000);

    console.log('✅ Aplikace KryptoHlídač inicializována');
}

// Spuštění po načtení DOM
document.addEventListener('DOMContentLoaded', init);