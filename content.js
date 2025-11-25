const storageCache = {
    get: async (username) => {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([username], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn("[RegionViewer] Storage get error:", chrome.runtime.lastError);
                        resolve(null);
                        return;
                    }
                    resolve(result ? result[username] : null);
                });
            } catch (e) {
                console.warn("[RegionViewer] Storage access failed (likely context invalidated):", e);
                resolve(null);
            }
        });
    },
    set: (username, data) => {
        try {
            chrome.storage.local.set({ [username]: data }, () => {
                if (chrome.runtime.lastError) {
                    console.warn("[RegionViewer] Storage set error:", chrome.runtime.lastError);
                }
            });
        } catch (e) {
            console.warn("[RegionViewer] Storage set failed:", e);
        }
    }
};

const queue = [];
let isProcessing = false;

const countryToFlag = {
    "United States": "🇺🇸",
    "United Kingdom": "🇬🇧",
    "Canada": "🇨🇦",
    "Australia": "🇦🇺",
    "Germany": "🇩🇪",
    "France": "🇫🇷",
    "Japan": "🇯🇵",
    "China": "🇨🇳",
    "India": "🇮🇳",
    "Brazil": "🇧🇷",
    "Russia": "🇷🇺",
    "Italy": "🇮🇹",
    "Spain": "🇪🇸",
    "Mexico": "🇲🇽",
    "South Korea": "🇰🇷",
    "Indonesia": "🇮🇩",
    "Turkey": "🇹🇷",
    "Netherlands": "🇳🇱",
    "Saudi Arabia": "🇸🇦",
    "Switzerland": "🇨🇭",
    "Sweden": "🇸🇪",
    "Poland": "🇵🇱",
    "Belgium": "🇧🇪",
    "Argentina": "🇦🇷",
    "Norway": "🇳🇴",
    "Austria": "🇦🇹",
    "Iran": "🇮🇷",
    "United Arab Emirates": "🇦🇪",
    "Israel": "🇮🇱",
    "South Africa": "🇿🇦",
    "Ukraine": "🇺🇦",
    "Egypt": "🇪🇬",
    "Pakistan": "🇵🇰",
    "Malaysia": "🇲🇾",
    "Philippines": "🇵🇭",
    "Vietnam": "🇻🇳",
    "Thailand": "🇹🇭",
    "Ireland": "🇮🇪",
    "Portugal": "🇵🇹",
    "Greece": "🇬🇷",
    "Denmark": "🇩🇰",
    "Finland": "🇫🇮",
    "New Zealand": "🇳🇿",
    "Singapore": "🇸🇬",
    "Czech Republic": "🇨🇿",
    "Hungary": "🇭🇺",
    "Romania": "🇷🇴",
    "Chile": "🇨🇱",
    "Colombia": "🇨🇴",
    "Peru": "🇵🇪",
    "Venezuela": "🇻🇪"
};

const platformToEmoji = {
    "Android App": "🤖",
    "App Store": "🍎",
    "Web": "🌐"
};

function formatPlatform(text) {
    if (!text) return "";
    let result = formatWithFlag(text);
    for (const [platform, emoji] of Object.entries(platformToEmoji)) {
        if (result.includes(platform)) {
            result = result.replace(platform, emoji);
        }
    }
    return result;
}

function formatWithFlag(text) {
    if (!text) return "";
    let result = text;
    // Sort by length descending to ensure longer matches are replaced first
    const entries = Object.entries(countryToFlag).sort((a, b) => b[0].length - a[0].length);

    for (const [country, flag] of entries) {
        if (result.includes(country)) {
            result = result.replace(country, flag);
        }
    }
    return result;
}

function getUsername(userNameElement) {
    const anchors = userNameElement.querySelectorAll('a');
    for (const anchor of anchors) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
            return href.substring(1);
        }
    }
    return null;
}

function fetchUserRegionData(username) {
    // Check persistent cache first
    return storageCache.get(username).then(cached => {
        if (cached) return cached;

        return new Promise((resolve) => {
            queue.push({ username, resolve });
            processQueue();
        });
    });
}

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const { username, resolve } = queue.shift();
    console.log(`[RegionViewer] Processing ${username}... Queue length: ${queue.length}`);

    try {
        const data = await extractFromIframe(username);
        storageCache.set(username, data); // Save to persistent cache
        resolve(data);
    } catch (e) {
        console.error(`[RegionViewer] Error processing ${username}`, e);
        resolve({ basedIn: "Error", connectedVia: "Error" });
    }

    // Increased delay to 3 seconds to be safer
    setTimeout(() => {
        isProcessing = false;
        processQueue();
    }, 3000);
}

function extractFromIframe(username) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100px';
        iframe.style.height = '100px';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-1';

        iframe.src = `/${username}/about`;
        document.body.appendChild(iframe);

        let attempts = 0;
        const maxAttempts = 20;

        const interval = setInterval(() => {
            attempts++;
            try {
                const doc = iframe.contentDocument;
                if (doc && doc.readyState === 'complete') {
                    const basedInData = findValueWithIcon(doc, "Account based in");
                    const connectedViaData = findValueWithIcon(doc, "Connected via");

                    if (basedInData.text || connectedViaData.text || attempts >= maxAttempts) {
                        clearInterval(interval);
                        document.body.removeChild(iframe);

                        console.log(`[RegionViewer] Finished ${username}. Found:`, { basedInData, connectedViaData });

                        resolve({
                            basedIn: basedInData.text || "Unknown",
                            basedInHasIcon: basedInData.hasValidIcon,
                            connectedVia: connectedViaData.text || "Unknown",
                            connectedViaHasIcon: connectedViaData.hasValidIcon
                        });
                    }
                }
            } catch (err) {
                console.error("[RegionViewer] Iframe access error", err);
                clearInterval(interval);
                if (iframe.parentNode) document.body.removeChild(iframe);
                resolve({ basedIn: "Error", connectedVia: "Error" });
            }
        }, 500);
    });
}

function findValueWithIcon(doc, labelText) {
    const spans = doc.querySelectorAll('span');
    for (const span of spans) {
        if (span.textContent.trim() === labelText) {
            const labelDiv = span.closest('div[dir="ltr"]');
            if (labelDiv) {
                const valueDiv = labelDiv.nextElementSibling;
                if (valueDiv) {
                    const text = valueDiv.textContent.trim();

                    let hasValidIcon = false;
                    const parent = labelDiv.parentElement;
                    if (parent) {
                        const grandparent = parent.parentElement;
                        if (grandparent) {
                            for (const child of grandparent.children) {
                                if (child.tagName.toLowerCase() === 'svg' && child !== parent) {
                                    const path = child.querySelector('path');
                                    const d = path ? path.getAttribute('d') : "";
                                    const ignoredPath = "M13.5 8.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5S11.17 7 12 7s1.5.67 1.5 1.5zM13 17v-5h-2v5h2zm-1 5.25c5.66 0 10.25-4.59 10.25-10.25S17.66 1.75 12 1.75 1.75 6.34 1.75 12 6.34 22.25 12 22.25zM20.25 12c0 4.56-3.69 8.25-8.25 8.25S3.75 16.56 3.75 12 7.44 3.75 12 3.75s8.25 3.69 8.25 8.25z";

                                    if (d !== ignoredPath) {
                                        hasValidIcon = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    return { text, hasValidIcon };
                }
            }
        }
    }
    return { text: null, hasValidIcon: false };
}

function addTextToTweets() {
    const userNames = document.querySelectorAll('[data-testid="User-Name"]');

    userNames.forEach(async (userName) => {
        if (userName.getAttribute('data-processed-region-viewer')) return;
        userName.setAttribute('data-processed-region-viewer', 'true');

        const username = getUsername(userName);
        if (!username) return;

        // Create a container for our extension's UI
        const container = document.createElement('span');
        container.style.marginLeft = "5px";
        container.style.fontSize = "small";
        container.style.color = "#536471";

        // Create the "Load" button
        const loadBtn = document.createElement('span');
        loadBtn.textContent = " 🌍";
        loadBtn.style.cursor = "pointer";
        loadBtn.style.opacity = "0.7";
        loadBtn.title = "Click to load region info";
        loadBtn.onclick = async (e) => {
            e.stopPropagation(); // Prevent clicking the tweet
            e.preventDefault();

            loadBtn.textContent = " ⏳";
            loadBtn.style.cursor = "default";

            const data = await fetchUserRegionData(username);

            // Remove the button
            loadBtn.remove();

            // Render data
            renderData(container, data, username);
        };

        container.appendChild(loadBtn);
        userName.appendChild(container);

        // Check if we already have it in cache, if so, load immediately (no cost)
        const cached = await storageCache.get(username);
        if (cached) {
            loadBtn.remove();
            renderData(container, cached, username);
        }
    });
}

function renderData(container, data, username) {
    container.innerHTML = ""; // Clear previous content

    const basedInDisplay = formatWithFlag(data.basedIn);
    const connectedViaDisplay = formatPlatform(data.connectedVia);

    let hasData = false;

    if (data.basedIn && data.basedIn !== "Unknown" && data.basedIn !== "Error") {
        const textNode = document.createTextNode(` | 📍 ${basedInDisplay}`);
        container.appendChild(textNode);

        if (data.basedInHasIcon) {
            const iconNode = document.createTextNode(" 🟢");
            container.appendChild(iconNode);
        }
        hasData = true;
    }
    if (data.connectedVia && data.connectedVia !== "Unknown" && data.connectedVia !== "Error") {
        const textNode = document.createTextNode(` | 🔗 ${connectedViaDisplay}`);
        container.appendChild(textNode);
        hasData = true;
    }

    if (!hasData) {
        const textNode = document.createTextNode(" | ❓");
        container.appendChild(textNode);
        container.title = "No region data found";
    } else {
        // Construct tooltip text
        let tooltip = `${username} account based in ${data.basedIn}`;
        if (data.basedInHasIcon) {
            tooltip += " (using VPN)";
        }
        if (data.connectedVia && data.connectedVia !== "Unknown" && data.connectedVia !== "Error") {
            tooltip += ` Connecting via ${data.connectedVia}`;
        }

        if ((data.basedIn === "Iran" || data.basedIn === "West Asia") && !data.basedInHasIcon) {
            tooltip += "\nProbably is using white Internet💩";
        }

        container.title = tooltip;
    }

    // Add Refresh Button
    const refreshBtn = document.createElement('span');
    refreshBtn.textContent = " 🔄";
    refreshBtn.style.cursor = "pointer";
    refreshBtn.style.opacity = "0.7";
    refreshBtn.style.marginLeft = "4px";
    refreshBtn.title = "Refresh data";
    refreshBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        refreshBtn.textContent = " ⏳";
        refreshBtn.style.cursor = "default";
        refreshBtn.onclick = null; // Disable click while loading

        // Force fresh fetch by adding to queue directly
        const newData = await new Promise((resolve) => {
            queue.push({ username, resolve });
            processQueue();
        });

        renderData(container, newData, username);
    };
    container.appendChild(refreshBtn);
}

addTextToTweets();

const observer = new MutationObserver((mutations) => {
    addTextToTweets();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
