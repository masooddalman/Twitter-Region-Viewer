const userCache = new Map();
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

function formatWithFlag(text) {
    if (!text) return "";
    let result = text;
    // Sort by length descending to ensure longer matches are replaced first (e.g. "South Africa" before "Africa")
    const entries = Object.entries(countryToFlag).sort((a, b) => b[0].length - a[0].length);

    for (const [country, flag] of entries) {
        if (result.includes(country)) {
            result = result.replace(country, flag);
        }
    }
    return result;
}

function getUsername(userNameElement) {
    // Find the first anchor tag that links to a profile (not a status)
    const anchors = userNameElement.querySelectorAll('a');
    for (const anchor of anchors) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
            // Remove leading slash to get username
            return href.substring(1);
        }
    }
    return null;
}

function fetchUserRegionData(username) {
    if (userCache.has(username)) {
        return Promise.resolve(userCache.get(username));
    }

    return new Promise((resolve) => {
        queue.push({ username, resolve });
        processQueue();
    });
}

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const { username, resolve } = queue.shift();
    console.log(`[RegionViewer] Processing ${username}... Queue length: ${queue.length}`);

    try {
        const data = await extractFromIframe(username);
        userCache.set(username, data);
        resolve(data);
    } catch (e) {
        console.error(`[RegionViewer] Error processing ${username}`, e);
        resolve({ basedIn: "Error", connectedVia: "Error" });
    }

    // Delay between requests to avoid rate limiting and UI lag
    setTimeout(() => {
        isProcessing = false;
        processQueue();
    }, 1500);
}

function extractFromIframe(username) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        // Position off-screen but keep visible to ensuring rendering
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
        // Wait up to 10 seconds (20 * 500ms)
        const maxAttempts = 20;

        const interval = setInterval(() => {
            attempts++;
            try {
                const doc = iframe.contentDocument;
                if (doc && doc.readyState === 'complete') {
                    const basedIn = findValue(doc, "Account based in");
                    const connectedVia = findValue(doc, "Connected via");

                    // If we found data OR we reached max attempts
                    if (basedIn || connectedVia || attempts >= maxAttempts) {
                        clearInterval(interval);
                        document.body.removeChild(iframe);

                        console.log(`[RegionViewer] Finished ${username}. Found:`, { basedIn, connectedVia });

                        resolve({
                            basedIn: basedIn || "Unknown",
                            connectedVia: connectedVia || "Unknown"
                        });
                    }
                }
            } catch (err) {
                // Cross-origin errors shouldn't happen on same domain, but just in case
                console.error("[RegionViewer] Iframe access error", err);
                clearInterval(interval);
                if (iframe.parentNode) document.body.removeChild(iframe);
                resolve({ basedIn: "Error", connectedVia: "Error" });
            }
        }, 500);
    });
}

function findValue(doc, labelText) {
    const spans = doc.querySelectorAll('span');
    for (const span of spans) {
        if (span.textContent.trim() === labelText) {
            // Navigate up to the container div
            const labelDiv = span.closest('div[dir="ltr"]');
            if (labelDiv) {
                // The value is in the next sibling div
                const valueDiv = labelDiv.nextElementSibling;
                if (valueDiv) {
                    return valueDiv.textContent.trim();
                }
            }
        }
    }
    return null;
}

function addTextToTweets() {
    const userNames = document.querySelectorAll('[data-testid="User-Name"]');

    userNames.forEach(async (userName) => {
        if (userName.getAttribute('data-processed-region-viewer')) return;

        // Mark as processed immediately
        userName.setAttribute('data-processed-region-viewer', 'true');

        const username = getUsername(userName);
        if (!username) return;

        const span = document.createElement('span');
        span.style.marginLeft = "5px";
        span.style.fontSize = "small";
        span.style.color = "#536471";
        span.textContent = " ⏳"; // Short loading indicator

        userName.appendChild(span);

        const data = await fetchUserRegionData(username);

        const basedInDisplay = formatWithFlag(data.basedIn);
        const connectedViaDisplay = formatWithFlag(data.connectedVia);

        // Only show if we have data
        let text = "";
        if (data.basedIn && data.basedIn !== "Unknown" && data.basedIn !== "Error") {
            text += ` | 📍 ${basedInDisplay}`;
        }
        if (data.connectedVia && data.connectedVia !== "Unknown" && data.connectedVia !== "Error") {
            text += ` | 🔗 ${connectedViaDisplay}`;
        }

        if (text === "") {
            text = " | ❓"; // No data found
        }

        span.textContent = text;
    });
}

// Run initially
addTextToTweets();

// Observe the body for changes
const observer = new MutationObserver((mutations) => {
    addTextToTweets();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
