# **Youtube Restream (YT-RS) \[Local Browser Store Session\]**

A persistent, self-hosted YouTube player that runs entirely in the browser.

**Features:**

* Auto-Resume (Remembers position via LocalStorage)  
* Force High Quality  
* Playlist Sidebar  
* 12-Hour Clock  
* Fullscreen (Press 'F')

## **📦 How to Deploy to GitHub Pages**

1. **Create a Repository:**  
   * Go to GitHub and create a new public repository (e.g., my-Youtube Restream (YT-RS)).  
2. **Upload Files:**  
   * Upload the index.html file to the root.  
   * Create a folder named static.  
   * Upload style.css and script.js into the static folder.  
3. **Enable Pages:**  
   * Go to repository **Settings** \-\> **Pages**.  
   * Under **Build and deployment** \-\> **Branch**, select your branch and your location code.  
   * Click **Save**.  
4. **Visit your Site:**  
   * Wait 1-2 minutes.  
   * Your site will be live at: https://yourusername.github.io/my-Youtube Restream (YT-RS)/

## **🖥️ Local Usage**

You can also run this on your computer without internet (except for the YouTube video itself).

1. Download the files.  
2. **Do not just double click index.html**. Browsers often block localStorage on file:// protocols.  
3. Instead, use a simple local server:  
   * **Python:** python \-m http.server \-\> Go to localhost:8000  
   * **VS Code:** Right click index.html \-\> "Open with Live Server".