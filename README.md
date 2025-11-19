# **Youtube Restream (YT-RS) 📺**

**StreamHost** is a powerful, distraction-free YouTube player wrapper that gives you control over playback quality, playlists, and session persistence.

This repository contains **two versions** of the application. Choose the one that fits your needs:

1. **YT-RS (Server Side Session):** Best for local networks, multiple devices, and real-time synchronization.  
2. **YT-RS (Local / Web Browser Session):** Best for personal use, zero-setup, and hosting on GitHub Pages.

## **📊 Version Comparison**

| Feature | 🟢 Server Side Session | 🔵 Local / Web Browser Session |
| :---- | :---- | :---- |
| **Hosting** | Node.js (Self-Hosted) | Static (GitHub Pages / HTML) |
| **Resume** | Stored in Database (SQLite) | Stored in Browser (LocalStorage) |
| **Cross-Device** | ✅ Yes (Resume on any device) | ❌ No (Per device only) |
| **Watch Party** | ✅ Yes (Real-time Sync) | ❌ No |
| **Setup Difficulty** | Medium (Requires Terminal) | Easy (Drag & Drop) |

## **🟢 Option 1: (Server Side Session)**

Use this version if you want to watch videos simultaneously with others on your Wi-Fi, or start watching on your PC and finish on your phone seamlessly.

### **Prerequisites**

* [Node.js](https://nodejs.org/) installed.

### **Installation**

1. Create a folder named StreamHostServer.  
2. Place server.js, index.html inside.  
3. Create a static folder and place style.css and script.js inside it.  
4. Open your terminal in this folder and run:

npm init \-y  
npm install express socket.io sqlite3 body-parser cors

### **How to Run**

Start the server:

node server.js

* Access on your PC: http://localhost:3000  
* Access on Mobile/LAN: Find your PC's IP Address (e.g., http://192.168.1.X:3000)

## **🔵 Option 2: (Local / Web Browser Session)**

Use this version if you just want a persistent player for yourself and want to host it for free on GitHub Pages or run it locally without installing Node.js.

### **Installation**

1. Create a folder named StreamHostLite.  
2. Place index.html inside.  
3. Create a static folder and place style.css and script.js inside it.

### **How to Run (Local)**

* **VS Code:** Right-click index.html \> "Open with Live Server".  
* **Python:** Run python \-m http.server in the folder.  
* *Note: Do not simply double-click the HTML file. Browser security often blocks LocalStorage on file:// paths.*

### **How to Deploy (GitHub Pages)**

1. Upload the files to a public GitHub Repository.  
2. Go to **Settings** \> **Pages**.  
3. Select your main or your branch name  and save.

## **🎮 Usage Guide (Both Versions)**

### **1\. Loading Content**

* Copy a YouTube **Video Link** or **Playlist Link**.  
* Paste it into the center input box.  
* **Select your Quality** (e.g., Auto) *before* clicking Load.  
* Click **LOAD SOURCE**.

### **2\. Playlist Sidebar**

* If you loaded a playlist, a **List Icon** appears in the bottom right.  
* Click it to open the sidebar and see all tracks.  
* The sidebar automatically highlights the current playing video.

### **3\. Keyboard Shortcuts**

| Key | Action |
| :---- | :---- |
| **F** | Toggle Fullscreen |
| **Space** / **K** | Play / Pause |
| **M** | Mute / Unmute |
| **Right Arrow** | Skip Forward 10s |
| **Left Arrow** | Rewind 10s |

### **4\. Auto-Resume**

* **Server Version:** Remembers your spot via session.db. You can close the browser or restart the server, and it will resume exactly where you left off.  
* **Lite Version:** Remembers your spot via browser cookies/storage. If you clear your cache, the progress is lost.

## **🔧 Troubleshooting**

* **"Video Unavailable":** Some videos block embedding on external sites (CORS policy). Try a different video.  
* **Quality not changing:** YouTube forces "Auto" quality if your internet is unstable, ignoring the player's request. The player tries to force a reload to fix this.  
* **Playlist menu not showing:** Ensure you pasted a URL containing list=PL.... Standard video links do not activate the playlist drawer.