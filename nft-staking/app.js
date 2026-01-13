// ===== StakeVault - Web3Modal Integration =====
// Get your FREE Project ID at: https://cloud.walletconnect.com

import { createWeb3Modal, defaultConfig } from 'https://cdn.jsdelivr.net/npm/@web3modal/ethers@5.1.11/+esm';

// ⚠️ IMPORTANT: Replace with YOUR Project ID from https://cloud.walletconnect.com (FREE)
const projectId = 'bd3be74b534af2c489b1367f49dca9ce';

// Supported chains
const mainnet = {
    chainId: 1,
    name: 'Ethereum',
    currency: 'ETH',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: 'https://eth.llamarpc.com'
};

const polygon = {
    chainId: 137,
    name: 'Polygon',
    currency: 'MATIC',
    explorerUrl: 'https://polygonscan.com',
    rpcUrl: 'https://polygon.llamarpc.com'
};

const arbitrum = {
    chainId: 42161,
    name: 'Arbitrum',
    currency: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    rpcUrl: 'https://arb1.arbitrum.io/rpc'
};

const base = {
    chainId: 8453,
    name: 'Base',
    currency: 'ETH',
    explorerUrl: 'https://basescan.org',
    rpcUrl: 'https://mainnet.base.org'
};

const sepolia = {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://rpc.sepolia.org'
};

// Web3Modal metadata
const metadata = {
    name: 'StakeVault',
    description: 'NFT Staking Platform',
    url: window.location.origin,
    icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Create modal
const ethersConfig = defaultConfig({
    metadata,
    enableEIP6963: true,
    enableInjected: true,
    enableCoinbase: true,
});

const modal = createWeb3Modal({
    ethersConfig,
    chains: [mainnet, polygon, arbitrum, base, sepolia],
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#8b5cf6',
        '--w3m-border-radius-master': '12px'
    }
});

// ===== State =====
const state = {
    walletAddress: null,
    chainId: null,
    isConnected: false,
    walletNfts: [],
    stakedNfts: [],
    selectedWalletNfts: [],
    selectedStakedNfts: []
};

// ===== DOM Elements =====
const elements = {
    walletNftsGrid: document.getElementById('walletNfts'),
    stakedNftsGrid: document.getElementById('stakedNfts'),
    walletCount: document.getElementById('walletCount'),
    stakedCount: document.getElementById('stakedCount'),
    stakeBtn: document.getElementById('stakeSelected'),
    unstakeBtn: document.getElementById('unstakeSelected'),
    claimBtn: document.getElementById('claimRewards'),
    toastContainer: document.getElementById('toastContainer'),
    faqItems: document.querySelectorAll('.faq-item')
};

// ===== Utility Functions =====
window.scrollToSection = function (sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function shortenAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

// ===== Web3Modal Event Listeners =====
modal.subscribeProvider(({ address, chainId, isConnected }) => {
    state.walletAddress = address;
    state.chainId = chainId;
    state.isConnected = isConnected;

    if (isConnected && address) {
        showToast(`Connected: ${shortenAddress(address)}`, 'success');
        fetchUserNFTs();
    } else {
        state.walletNfts = [];
        state.stakedNfts = [];
        renderWalletNfts();
        renderStakedNfts();
    }
});

// ===== Fetch NFTs (using Alchemy) =====
async function fetchUserNFTs() {
    if (!state.walletAddress) return;

    showToast('Fetching your NFTs...', 'info');

    // For demo - show loading then empty state
    // In production, use Alchemy API:
    // const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY/getNFTs?owner=${state.walletAddress}`);

    elements.walletNftsGrid.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🎨</div>
            <p>Connected! Add your Alchemy API key to fetch NFTs.</p>
            <small>Wallet: ${shortenAddress(state.walletAddress)}</small>
        </div>
    `;
    elements.walletCount.textContent = '0 NFTs';
}

// ===== Render Functions =====
function renderWalletNfts() {
    if (!state.isConnected) {
        elements.walletNftsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔗</div>
                <p>Connect your wallet to view NFTs</p>
            </div>
        `;
        elements.walletCount.textContent = '0 NFTs';
    }
}

function renderStakedNfts() {
    elements.stakedNftsGrid.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📦</div>
            <p>No NFTs staked yet</p>
        </div>
    `;
    elements.stakedCount.textContent = '0 NFTs';
}

// ===== FAQ =====
function initFaq() {
    elements.faqItems.forEach(item => {
        item.querySelector('.faq-question').addEventListener('click', () => {
            const wasActive = item.classList.contains('active');
            elements.faqItems.forEach(i => i.classList.remove('active'));
            if (!wasActive) item.classList.add('active');
        });
    });
}

// ===== Counter Animation =====
function animateCounters() {
    document.querySelectorAll('[data-count]').forEach(counter => {
        const target = parseInt(counter.dataset.count);
        let current = 0;
        const step = target / 100;
        const update = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(update);
            } else {
                counter.textContent = target.toLocaleString();
            }
        };
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                update();
                observer.disconnect();
            }
        });
        observer.observe(counter);
    });
}

// ===== Navbar Scroll =====
function initNavScroll() {
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        navbar.style.padding = window.scrollY > 50 ? '12px 0' : '16px 0';
        navbar.style.background = window.scrollY > 50 ? 'rgba(10, 10, 15, 0.95)' : 'rgba(10, 10, 15, 0.8)';
    });
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initFaq();
    animateCounters();
    initNavScroll();
    renderWalletNfts();
    renderStakedNfts();

    console.log('🚀 StakeVault initialized with Web3Modal!');
    console.log('📝 Get your Project ID at: https://cloud.walletconnect.com');
});
