function addTextToTweets() {
    // Select all elements that contain the user name and handle
    const userNames = document.querySelectorAll('[data-testid="User-Name"]');

    userNames.forEach(userName => {
        // Avoid adding the text multiple times
        if (userName.getAttribute('data-processed-region-viewer')) return;

        const span = document.createElement('span');
        span.textContent = " This is sample text 🐦";
        span.style.marginLeft = "5px";
        span.style.fontWeight = "bold";

        // Append the text to the User-Name container
        userName.appendChild(span);

        // Mark as processed
        userName.setAttribute('data-processed-region-viewer', 'true');
    });
}

// Run initially
addTextToTweets();

// Observe the body for changes (infinite scrolling, dynamic loading)
const observer = new MutationObserver((mutations) => {
    // We could optimize this by checking mutations, but running the selector is usually fast enough for this purpose
    addTextToTweets();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
