// ===== StakeVault NFT Staking Platform - REAL WEB3 INTEGRATION =====

// Configuration - UPDATE THESE FOR YOUR DEPLOYMENT
const CONFIG = {
    // Supported Networks
    NETWORKS: {
        1: { name: 'Ethereum Mainnet', currency: 'ETH', explorer: 'https://etherscan.io' },
        5: { name: 'Goerli Testnet', currency: 'ETH', explorer: 'https://goerli.etherscan.io' },
        11155111: { name: 'Sepolia Testnet', currency: 'ETH', explorer: 'https://sepolia.etherscan.io' },
        137: { name: 'Polygon', currency: 'MATIC', explorer: 'https://polygonscan.com' },
        80001: { name: 'Mumbai Testnet', currency: 'MATIC', explorer: 'https://mumbai.polygonscan.com' },
        56: { name: 'BSC Mainnet', currency: 'BNB', explorer: 'https://bscscan.com' },
        42161: { name: 'Arbitrum One', currency: 'ETH', explorer: 'https://arbiscan.io' },
        10: { name: 'Optimism', currency: 'ETH', explorer: 'https://optimistic.etherscan.io' },
        8453: { name: 'Base', currency: 'ETH', explorer: 'https://basescan.org' },
    },
    // OpenSea API for fetching real NFTs (free tier)
    OPENSEA_API: 'https://api.opensea.io/api/v2',
    // Alchemy API (for better NFT fetching - get free key at alchemy.com)
    ALCHEMY_API_KEY: '', // Add your Alchemy API key here
    // Supported NFT contract addresses (add real collection addresses)
    SUPPORTED_COLLECTIONS: [
        // Example: Bored Ape Yacht Club on Ethereum
        // { address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', name: 'BAYC', chain: 1 }
    ]
};

// State Management
const state = {
    provider: null,
    signer: null,
    walletAddress: null,
    chainId: null,
    isConnected: false,
    walletNfts: [],
    stakedNfts: [],
    selectedWalletNfts: [],
    selectedStakedNfts: [],
    rewards: {
        claimable: 0,
        daily: 0,
        total: 0,
        daysStaked: 0
    },
    balance: '0'
};

// DOM Elements
const elements = {
    connectWalletBtn: document.getElementById('connectWallet'),
    walletModal: document.getElementById('walletModal'),
    closeModal: document.getElementById('closeModal'),
    walletOptions: document.querySelectorAll('.wallet-option'),
    walletNftsGrid: document.getElementById('walletNfts'),
    stakedNftsGrid: document.getElementById('stakedNfts'),
    walletCount: document.getElementById('walletCount'),
    stakedCount: document.getElementById('stakedCount'),
    stakeBtn: document.getElementById('stakeSelected'),
    unstakeBtn: document.getElementById('unstakeSelected'),
    claimBtn: document.getElementById('claimRewards'),
    claimableRewards: document.getElementById('claimableRewards'),
    dailyRate: document.getElementById('dailyRate'),
    totalEarned: document.getElementById('totalEarned'),
    timeStaked: document.getElementById('timeStaked'),
    toastContainer: document.getElementById('toastContainer'),
    faqItems: document.querySelectorAll('.faq-item'),
    emptyWallet: document.getElementById('emptyWallet'),
    emptyStaked: document.getElementById('emptyStaked')
};

// ===== Utility Functions =====
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
    `;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkName(chainId) {
    return CONFIG.NETWORKS[chainId]?.name || `Chain ${chainId}`;
}

// ===== REAL WALLET CONNECTION FUNCTIONS =====

// Check if MetaMask or other wallet is installed
function isWalletInstalled() {
    return typeof window.ethereum !== 'undefined';
}

// Connect to MetaMask
async function connectMetaMask() {
    if (!isWalletInstalled()) {
        showToast('MetaMask is not installed! Please install MetaMask.', 'error');
        window.open('https://metamask.io/download/', '_blank');
        return false;
    }

    try {
        closeWalletModal();
        showToast('Connecting to MetaMask...', 'info');

        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts.length === 0) {
            showToast('No accounts found. Please unlock MetaMask.', 'error');
            return false;
        }

        // Create ethers provider
        state.provider = new ethers.providers.Web3Provider(window.ethereum);
        state.signer = state.provider.getSigner();
        state.walletAddress = accounts[0];
        state.isConnected = true;

        // Get chain ID
        const network = await state.provider.getNetwork();
        state.chainId = network.chainId;

        // Get balance
        const balance = await state.provider.getBalance(state.walletAddress);
        state.balance = ethers.utils.formatEther(balance);

        // Update UI
        updateWalletUI();

        // Subscribe to account/network changes
        setupWalletListeners();

        // Fetch user's NFTs
        await fetchUserNFTs();

        showToast(`Connected to ${getNetworkName(state.chainId)}!`, 'success');
        return true;

    } catch (error) {
        console.error('MetaMask connection error:', error);
        if (error.code === 4001) {
            showToast('Connection rejected by user.', 'error');
        } else {
            showToast(`Connection failed: ${error.message}`, 'error');
        }
        return false;
    }
}

// Connect via WalletConnect (opens QR code for mobile wallets)
async function connectWalletConnect() {
    showToast('WalletConnect requires additional setup. Use MetaMask for now.', 'warning');
    // WalletConnect v2 requires project ID from cloud.walletconnect.com
    // Implement when you have a project ID
}

// Connect Coinbase Wallet
async function connectCoinbaseWallet() {
    if (!window.ethereum?.isCoinbaseWallet && !window.coinbaseWalletExtension) {
        showToast('Coinbase Wallet not detected. Please install it.', 'error');
        window.open('https://www.coinbase.com/wallet', '_blank');
        return;
    }
    // Use same flow as MetaMask since Coinbase injects ethereum provider
    await connectMetaMask();
}

// Setup listeners for wallet events
function setupWalletListeners() {
    if (!window.ethereum) return;

    // Account changed
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
            showToast('Wallet disconnected', 'info');
        } else {
            state.walletAddress = accounts[0];
            const balance = await state.provider.getBalance(state.walletAddress);
            state.balance = ethers.utils.formatEther(balance);
            updateWalletUI();
            await fetchUserNFTs();
            showToast('Account changed', 'info');
        }
    });

    // Chain changed
    window.ethereum.on('chainChanged', async (chainIdHex) => {
        state.chainId = parseInt(chainIdHex, 16);
        showToast(`Switched to ${getNetworkName(state.chainId)}`, 'info');
        await fetchUserNFTs();
    });

    // Disconnect
    window.ethereum.on('disconnect', () => {
        disconnectWallet();
        showToast('Wallet disconnected', 'info');
    });
}

// Update wallet button UI
function updateWalletUI() {
    if (state.isConnected && state.walletAddress) {
        const networkName = getNetworkName(state.chainId);
        elements.connectWalletBtn.innerHTML = `
            <span class="wallet-connected">
                <span class="network-dot"></span>
                <span class="btn-text">${shortenAddress(state.walletAddress)}</span>
            </span>
        `;
        elements.connectWalletBtn.classList.add('connected');
    } else {
        elements.connectWalletBtn.innerHTML = `
            <span class="btn-glow"></span>
            <span class="btn-text">Connect Wallet</span>
        `;
        elements.connectWalletBtn.classList.remove('connected');
    }
}

// Disconnect wallet
function disconnectWallet() {
    state.provider = null;
    state.signer = null;
    state.walletAddress = null;
    state.chainId = null;
    state.isConnected = false;
    state.walletNfts = [];
    state.stakedNfts = [];
    state.selectedWalletNfts = [];
    state.selectedStakedNfts = [];
    state.balance = '0';

    updateWalletUI();
    renderWalletNfts();
    renderStakedNfts();
    updateRewardsUI();
}

// ===== FETCH REAL NFTs =====

async function fetchUserNFTs() {
    if (!state.walletAddress) return;

    showToast('Fetching your NFTs...', 'info');
    elements.walletNftsGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading NFTs...</p></div>';

    try {
        // Method 1: Use Alchemy API (recommended - get free key at alchemy.com)
        if (CONFIG.ALCHEMY_API_KEY) {
            await fetchNFTsViaAlchemy();
        }
        // Method 2: Direct blockchain query for known collections
        else {
            await fetchNFTsDirectly();
        }

    } catch (error) {
        console.error('Error fetching NFTs:', error);
        showToast('Could not fetch NFTs. Check console for details.', 'error');
        renderWalletNfts();
    }
}

// Fetch NFTs using Alchemy API
async function fetchNFTsViaAlchemy() {
    const chainNetworks = {
        1: 'eth-mainnet',
        5: 'eth-goerli',
        11155111: 'eth-sepolia',
        137: 'polygon-mainnet',
        80001: 'polygon-mumbai',
        42161: 'arb-mainnet',
        10: 'opt-mainnet',
        8453: 'base-mainnet'
    };

    const network = chainNetworks[state.chainId] || 'eth-mainnet';
    const baseURL = `https://${network}.g.alchemy.com/v2/${CONFIG.ALCHEMY_API_KEY}`;

    const response = await fetch(`${baseURL}/getNFTs?owner=${state.walletAddress}`);
    const data = await response.json();

    if (data.ownedNfts) {
        state.walletNfts = data.ownedNfts.map((nft, index) => ({
            id: `${nft.contract.address}-${nft.id.tokenId}`,
            tokenId: nft.id.tokenId,
            contractAddress: nft.contract.address,
            name: nft.title || `NFT #${nft.id.tokenId}`,
            collection: nft.contract.name || 'Unknown Collection',
            image: nft.media[0]?.gateway || nft.media[0]?.raw || 'https://via.placeholder.com/200?text=NFT',
            description: nft.description || ''
        }));

        showToast(`Found ${state.walletNfts.length} NFTs!`, 'success');
    }

    renderWalletNfts();
}

// Fetch NFTs directly from blockchain (works without API key)
async function fetchNFTsDirectly() {
    // ERC-721 ABI for basic NFT queries
    const ERC721_ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function symbol() view returns (string)'
    ];

    const foundNfts = [];

    // Query each supported collection
    for (const collection of CONFIG.SUPPORTED_COLLECTIONS) {
        if (collection.chain !== state.chainId) continue;

        try {
            const contract = new ethers.Contract(collection.address, ERC721_ABI, state.provider);
            const balance = await contract.balanceOf(state.walletAddress);

            for (let i = 0; i < balance.toNumber(); i++) {
                const tokenId = await contract.tokenOfOwnerByIndex(state.walletAddress, i);
                let metadata = { name: `${collection.name} #${tokenId}`, image: '' };

                try {
                    const tokenURI = await contract.tokenURI(tokenId);
                    const metadataResponse = await fetch(tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/'));
                    metadata = await metadataResponse.json();
                } catch (e) {
                    console.log('Could not fetch metadata for token', tokenId);
                }

                foundNfts.push({
                    id: `${collection.address}-${tokenId}`,
                    tokenId: tokenId.toString(),
                    contractAddress: collection.address,
                    name: metadata.name || `${collection.name} #${tokenId}`,
                    collection: collection.name,
                    image: metadata.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || 'https://via.placeholder.com/200?text=NFT'
                });
            }
        } catch (error) {
            console.error(`Error fetching from ${collection.name}:`, error);
        }
    }

    state.walletNfts = foundNfts;

    if (foundNfts.length === 0) {
        showToast('No NFTs found from supported collections. Add collection addresses in CONFIG.', 'info');
    } else {
        showToast(`Found ${foundNfts.length} NFTs!`, 'success');
    }

    renderWalletNfts();
}

// ===== NFT Rendering =====
function createNftCard(nft, isStaked = false) {
    const div = document.createElement('div');
    div.className = 'nft-item';
    div.dataset.id = nft.id;
    div.innerHTML = `
        <img src="${nft.image}" alt="${nft.name}" onerror="this.src='https://via.placeholder.com/200?text=NFT'">
        <div class="nft-overlay">
            <span class="nft-name">${nft.name}</span>
        </div>
        <div class="check-mark">✓</div>
    `;

    div.addEventListener('click', () => toggleNftSelection(nft.id, isStaked));

    return div;
}

function renderWalletNfts() {
    elements.walletNftsGrid.innerHTML = '';

    if (!state.isConnected) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <div class="empty-icon">🔗</div>
            <p>Connect your wallet to view NFTs</p>
        `;
        elements.walletNftsGrid.appendChild(emptyDiv);
        elements.walletCount.textContent = '0 NFTs';
        return;
    }

    if (state.walletNfts.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <div class="empty-icon">🎨</div>
            <p>No stakeable NFTs found in wallet</p>
            <small>Make sure you're on the right network</small>
        `;
        elements.walletNftsGrid.appendChild(emptyDiv);
    } else {
        state.walletNfts.forEach(nft => {
            elements.walletNftsGrid.appendChild(createNftCard(nft, false));
        });
    }

    elements.walletCount.textContent = `${state.walletNfts.length} NFTs`;
}

function renderStakedNfts() {
    elements.stakedNftsGrid.innerHTML = '';

    if (state.stakedNfts.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <div class="empty-icon">📦</div>
            <p>No NFTs staked yet</p>
        `;
        elements.stakedNftsGrid.appendChild(emptyDiv);
    } else {
        state.stakedNfts.forEach(nft => {
            elements.stakedNftsGrid.appendChild(createNftCard(nft, true));
        });
    }

    elements.stakedCount.textContent = `${state.stakedNfts.length} NFTs`;
}

function toggleNftSelection(nftId, isStaked) {
    const selectedArray = isStaked ? state.selectedStakedNfts : state.selectedWalletNfts;
    const index = selectedArray.indexOf(nftId);

    if (index > -1) {
        selectedArray.splice(index, 1);
    } else {
        selectedArray.push(nftId);
    }

    const grid = isStaked ? elements.stakedNftsGrid : elements.walletNftsGrid;
    const nftItem = grid.querySelector(`[data-id="${nftId}"]`);
    if (nftItem) {
        nftItem.classList.toggle('selected', selectedArray.includes(nftId));
    }

    updateButtonStates();
}

function updateButtonStates() {
    const walletSelected = state.selectedWalletNfts.length;
    const stakedSelected = state.selectedStakedNfts.length;

    elements.stakeBtn.disabled = walletSelected === 0 || !state.isConnected;
    elements.stakeBtn.textContent = `Stake Selected (${walletSelected})`;

    elements.unstakeBtn.disabled = stakedSelected === 0 || !state.isConnected;
    elements.unstakeBtn.textContent = `Unstake Selected (${stakedSelected})`;
}

// ===== Staking Functions (Frontend Demo - Connect to your smart contract) =====
async function stakeSelected() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first!', 'error');
        return;
    }

    if (state.selectedWalletNfts.length === 0) return;

    showToast('⚠️ Smart contract integration required for real staking!', 'warning');
    showToast('Demo mode: Moving NFTs to staked panel...', 'info');

    // In a real implementation, you would:
    // 1. Call approve() on the NFT contract to approve the staking contract
    // 2. Call stake() on your staking contract with the token IDs

    /*
    // Example real staking code:
    const STAKING_CONTRACT_ABI = [...]; // Your staking contract ABI
    const STAKING_CONTRACT_ADDRESS = '0x...'; // Your staking contract address
    
    const stakingContract = new ethers.Contract(
        STAKING_CONTRACT_ADDRESS, 
        STAKING_CONTRACT_ABI, 
        state.signer
    );
    
    // First approve the staking contract to transfer NFTs
    for (const nftId of state.selectedWalletNfts) {
        const nft = state.walletNfts.find(n => n.id === nftId);
        const nftContract = new ethers.Contract(nft.contractAddress, ERC721_ABI, state.signer);
        await nftContract.approve(STAKING_CONTRACT_ADDRESS, nft.tokenId);
    }
    
    // Then stake
    const tokenIds = state.selectedWalletNfts.map(id => {
        const nft = state.walletNfts.find(n => n.id === id);
        return nft.tokenId;
    });
    const tx = await stakingContract.stake(tokenIds);
    await tx.wait();
    */

    // Demo: Move to staked
    state.selectedWalletNfts.forEach(id => {
        const nftIndex = state.walletNfts.findIndex(n => n.id === id);
        if (nftIndex > -1) {
            const nft = state.walletNfts.splice(nftIndex, 1)[0];
            nft.stakedAt = Date.now();
            state.stakedNfts.push(nft);
        }
    });

    state.selectedWalletNfts = [];
    renderWalletNfts();
    renderStakedNfts();
    updateButtonStates();

    showToast('NFTs staked! (Demo mode)', 'success');
}

async function unstakeSelected() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first!', 'error');
        return;
    }

    if (state.selectedStakedNfts.length === 0) return;

    showToast('Demo mode: Unstaking NFTs...', 'info');

    // Demo: Move back to wallet
    state.selectedStakedNfts.forEach(id => {
        const nftIndex = state.stakedNfts.findIndex(n => n.id === id);
        if (nftIndex > -1) {
            const nft = state.stakedNfts.splice(nftIndex, 1)[0];
            delete nft.stakedAt;
            state.walletNfts.push(nft);
        }
    });

    state.selectedStakedNfts = [];
    renderWalletNfts();
    renderStakedNfts();
    updateButtonStates();

    showToast('NFTs unstaked! (Demo mode)', 'success');
}

// ===== Rewards (Demo) =====
function updateRewardsUI() {
    const claimable = state.rewards.claimable.toFixed(4);
    const daily = state.rewards.daily.toFixed(2);
    const total = state.rewards.total.toFixed(4);

    elements.claimableRewards.textContent = `${claimable} VAULT`;
    elements.dailyRate.textContent = `${daily} VAULT`;
    elements.totalEarned.textContent = `${total} VAULT`;
    elements.timeStaked.textContent = `${state.rewards.daysStaked} days`;

    elements.claimBtn.disabled = state.rewards.claimable < 0.001 || !state.isConnected;
}

async function claimRewards() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first!', 'error');
        return;
    }
    showToast('Smart contract required for real reward claims!', 'warning');
}

// ===== Modal Functions =====
function openWalletModal() {
    elements.walletModal.classList.add('active');
}

function closeWalletModal() {
    elements.walletModal.classList.remove('active');
}

// ===== FAQ Accordion =====
function initFaq() {
    elements.faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const wasActive = item.classList.contains('active');
            elements.faqItems.forEach(i => i.classList.remove('active'));
            if (!wasActive) {
                item.classList.add('active');
            }
        });
    });
}

// ===== Counter Animation =====
function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');

    counters.forEach(counter => {
        const target = parseInt(counter.dataset.count);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = formatNumber(Math.floor(current));
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = formatNumber(target);
            }
        };

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCounter();
                    observer.disconnect();
                }
            });
        });

        observer.observe(counter);
    });
}

// ===== Event Listeners =====
function initEventListeners() {
    // Wallet button - open modal or disconnect
    elements.connectWalletBtn.addEventListener('click', () => {
        if (state.isConnected) {
            if (confirm('Disconnect wallet?')) {
                disconnectWallet();
                showToast('Wallet disconnected', 'info');
            }
        } else {
            openWalletModal();
        }
    });

    // Modal controls
    elements.closeModal.addEventListener('click', closeWalletModal);
    elements.walletModal.querySelector('.modal-overlay').addEventListener('click', closeWalletModal);

    // Wallet options
    elements.walletOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const walletType = option.dataset.wallet;

            switch (walletType) {
                case 'metamask':
                    await connectMetaMask();
                    break;
                case 'walletconnect':
                    await connectWalletConnect();
                    break;
                case 'coinbase':
                    await connectCoinbaseWallet();
                    break;
                case 'phantom':
                    showToast('Phantom is for Solana. Use MetaMask for EVM chains.', 'info');
                    break;
            }
        });
    });

    // Staking actions
    elements.stakeBtn.addEventListener('click', stakeSelected);
    elements.unstakeBtn.addEventListener('click', unstakeSelected);
    elements.claimBtn.addEventListener('click', claimRewards);

    // Escape to close modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeWalletModal();
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ===== Navbar Scroll =====
function initNavScroll() {
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.padding = '12px 0';
            navbar.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            navbar.style.padding = '16px 0';
            navbar.style.background = 'rgba(10, 10, 15, 0.8)';
        }
    });
}

// ===== Check for existing connection =====
async function checkExistingConnection() {
    if (isWalletInstalled() && window.ethereum.selectedAddress) {
        try {
            state.provider = new ethers.providers.Web3Provider(window.ethereum);
            state.signer = state.provider.getSigner();
            state.walletAddress = window.ethereum.selectedAddress;
            state.isConnected = true;

            const network = await state.provider.getNetwork();
            state.chainId = network.chainId;

            const balance = await state.provider.getBalance(state.walletAddress);
            state.balance = ethers.utils.formatEther(balance);

            updateWalletUI();
            setupWalletListeners();
            await fetchUserNFTs();

            showToast('Wallet reconnected!', 'success');
        } catch (error) {
            console.log('No existing connection');
        }
    }
}

// ===== Initialize =====
function init() {
    initEventListeners();
    initFaq();
    animateCounters();
    initNavScroll();
    renderWalletNfts();
    renderStakedNfts();
    updateButtonStates();
    updateRewardsUI();

    // Check if already connected
    checkExistingConnection();

    console.log('🚀 StakeVault NFT Staking Platform initialized with REAL Web3!');
    console.log('📝 To fetch NFTs, add your Alchemy API key in CONFIG.ALCHEMY_API_KEY');
}

document.addEventListener('DOMContentLoaded', init);
window.scrollToSection = scrollToSection;
