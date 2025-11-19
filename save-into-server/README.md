# **Youtube Restream (YT-RS) [Server Store Session]**

**YT-RS** is a self-hosted, ad-free YouTube player built for local networks. It features real-time synchronization (Watch Party), server-side state persistence (auto-resume), playlist support, and forced quality control.

Built with **Node.js**, **Socket.io**, and **SQLite**.

## **🌟 Features**

* **Real-Time Sync:** Play, pause, and seek actions are synced instantly across all connected devices (PC, Phone, Tablet).  
* **Auto-Resume:** The server remembers exactly where you left off. Close the browser, restart the PC, and it resumes at the exact second.  
* **Playlist Support:** Full sidebar support for YouTube Playlists with auto-scroll and active track highlighting.  
* **Quality Forcer:** Force playback quality (1080p, 720p) even if YouTube defaults to Auto.  
* **Glassmorphism UI:** A clean, modern, distraction-free interface.  
* **Keyboard Shortcuts:** Native YouTube-style shortcuts (K, F, M, Arrows).

## **🛠️ Prerequisites**

1. **Node.js**: You must have Node.js installed. [Download here](https://nodejs.org/).  
2. **Terminal/Command Prompt**: Basic knowledge of running commands.

## **📂 Installation & Setup**

Follow these steps to set up the project structure correctly.

### **1\. Create Project Folder**

Create a folder named StreamHost and set up the following file structure:

StreamHost/  
├── package.json       (Created automatically in Step 2\)  
├── server.js          (The Backend code)  
├── index.html         (The Frontend structure)  
└── static/            (Folder)  
    ├── style.css      (The Styles)  
    └── script.js      (The Logic)

### **2\. Initialize Project**

Open your terminal/command prompt inside the StreamHost folder and run:

npm init \-y

### **3\. Install Dependencies**

Install the required libraries for the server, database, and real-time sockets:

npm install express socket.io sqlite3 body-parser cors

## **🚀 How to Run**

1. Open your terminal in the StreamHost folder.  
2. Start the server:

node server.js

3. You should see the message:  
   \>\> StreamHost running at http://localhost:3000  
4. Open your web browser and go to:  
   http://localhost:3000

## **🎮 Usage Guide**

### **Loading Content**

1. **Copy Link:** Copy a YouTube Video URL or a Playlist URL.  
2. **Paste:** Paste it into the center input box.  
3. **Select Quality:** Choose your preferred quality (e.g., 1080p) *before* loading.  
4. **Click Load:** The player will initialize.

### **Keyboard Shortcuts**

| Key | Action |
| :---- | :---- |
| **F** | Toggle Fullscreen |
| **Space** or **K** | Play / Pause |
| **M** | Mute / Unmute |
| **Right Arrow** | Skip Forward 10s |
| **Left Arrow** | Rewind 10s |

### **Playlist Sidebar**

* The **List Icon** (bottom right) only appears if you load a Playlist link.  
* Click it to toggle the sidebar drawer.  
* Click any track to play it immediately.

## **📡 How to Watch on Other Devices (LAN)**

You can control the video from your phone or watch on your TV browser if they are on the **same Wi-Fi**.

1. Find your computer's **Local IP Address**:  
   * **Windows:** Open CMD, type ipconfig. Look for IPv4 Address (e.g., 192.168.1.15).  
   * **Mac/Linux:** Open Terminal, type ifconfig or ip a.  
2. On your phone/tablet browser, type that IP with the port 3000:  
   http://192.168.1.15:3000

**Magic:** If you press "Pause" on your phone, it will pause on your computer instantly\!

## **❓ Troubleshooting**

**1\. "Video Unavailable" Error**

* Some YouTube videos block embedding on external sites. Try a different video to confirm the player works.

**2\. "Playlist info unavailable"**

* Ensure the playlist is **Public** or **Unlisted**.