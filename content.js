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
                    const basedInData = findValueWithIcon(doc, "Account based in");
                    const connectedViaData = findValueWithIcon(doc, "Connected via");

                    // If we found data OR we reached max attempts
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
                // Cross-origin errors shouldn't happen on same domain, but just in case
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
                            // Check direct children of grandparent for the icon SVG
                            for (const child of grandparent.children) {
                                if (child.tagName.toLowerCase() === 'svg' && child !== parent) {
                                    // Check if this is the ignored SVG (Info icon)
                                    const path = child.querySelector('path');
                                    const d = path ? path.getAttribute('d') : "";

                                    // The ignored path from user request
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

        // Clear loading text
        span.textContent = "";

        // Only show if we have data
        if (data.basedIn && data.basedIn !== "Unknown" && data.basedIn !== "Error") {
            const textNode = document.createTextNode(` | 📍 ${basedInDisplay}`);
            span.appendChild(textNode);

            if (data.basedInHasIcon) {
                const iconNode = document.createTextNode(" 🟢");
                span.appendChild(iconNode);
            }
        }
        if (data.connectedVia && data.connectedVia !== "Unknown" && data.connectedVia !== "Error") {
            const textNode = document.createTextNode(` | 🔗 ${connectedViaDisplay}`);
            span.appendChild(textNode);
        }

        if (span.innerHTML === "") {
            span.textContent = " | ❓"; // No data found
        }
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
