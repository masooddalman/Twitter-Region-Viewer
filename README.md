# Twitter Region Viewer 🌍

A Chrome extension that reveals the "Account based in" and "Connected via" information for Twitter/X users directly on their posts.

**[فارسی (Persian)](README_FA.md)**

## Before

![Before](screens/before.jpg)

## After

![After](screens/after.jpg)

## 🚀 Features

- **Region Detection**: Displays the country where the account is based (e.g., "United States 🇺🇸").
- **Connection Info**: Shows the platform used to connect (e.g., "Android 🤖", "iPhone 🍎", "Web 🌐").
- **Verification Status**: Displays a green circle 🟢 if the account has a specific verified status icon (excluding generic info icons).
- **Hover Details**: Hover over the region info to see a detailed tooltip with the full text (e.g., "USERNAME account based in COUNTRY (With VPN) Connecting via PLATFORM").
- **Data Refresh**: Includes a refresh button (🔄) to re-fetch and update the region data if it has changed.
- **Rate Limit Protection**: Uses a "Click-to-Load" (🌍) mechanism to prevent Twitter from blocking your browser due to excessive requests.
- **Caching**: Saves fetched data locally so you don't have to reload it for the same user twice.

## 🛠️ How It Works

1. **Activation**: The extension runs on `twitter.com` and `x.com`.
2. **UI Injection**: It injects a small globe icon (🌍) next to user names on your feed.
3. **Data Fetching**: When you click the icon, the extension loads the user's `/about` page in a hidden, sandboxed iframe.
4. **Bypassing Restrictions**: It uses `declarativeNetRequest` rules to strip `X-Frame-Options` and `Content-Security-Policy` headers, allowing the iframe to load successfully.
5. **Parsing**: It parses the DOM of the hidden iframe to extract specific region and connection data.
6. **Display**: The extracted data is formatted with emojis and displayed next to the user's name.

## 📦 Installation

1. Clone this repository:

    ```bash
    git clone https://github.com/masooddalman/Twitter-Region-Viewer.git
    ```

2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the directory where you cloned the repository.

## 🤝 Contributing

**This is a public project and contributions are welcome!**

If you have ideas for improvements, bug fixes, or new features (like expanding the country flag map), please feel free to open a Pull Request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## ⚠️ Disclaimer

This extension is for educational and research purposes. It relies on the current HTML structure of X.com, which may change at any time. Use it responsibly to avoid being rate-limited by the platform.
