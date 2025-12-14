# 🩺 Medical Auscultation Training System

A real-time, interactive medical training platform for teaching auscultation skills using a simulated manikin with multi-speaker audio playback. Examiners can control lung, heart, and bowel sounds while students identify the anatomical locations and sound types.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [System Requirements](#system-requirements)
4. [Installation & Setup](#installation--setup)
5. [Arduino Hardware Setup](#arduino-hardware-setup)
6. [User Roles](#user-roles)
7. [User Guides](#user-guides)
   - [Admin Guide](#admin-guide)
   - [Examiner Guide](#examiner-guide)
   - [Examinee (Student) Guide](#examinee-student-guide)
8. [Troubleshooting](#troubleshooting)
9. [Technical Architecture](#technical-architecture)

---

## Overview

This application enables medical educators to conduct auscultation training sessions where:

- **Examiners** control a manikin's speakers to play various body sounds (lung, heart, bowel)
- **Students** listen and identify the correct anatomical location and sound type
- **Real-time feedback** is provided with scoring and leaderboards
- **Multi-speaker support** allows simultaneous playback from different body systems

---

## Features

### Core Features
- ✅ **Multi-Speaker Control** - Control lung, heart, and bowel sounds independently
- ✅ **Real-time Sessions** - Live synchronization between examiner and students
- ✅ **Arduino Integration** - Direct WebSerial connection to manikin hardware
- ✅ **Sound Library** - Comprehensive library of medical auscultation sounds
- ✅ **Response Tracking** - Automatic grading with detailed analytics
- ✅ **Session Management** - Create, pause, resume, and complete sessions

### User Management
- ✅ **Role-based Access** - Admin, Examiner, and Examinee roles
- ✅ **Secure Authentication** - Email/password authentication
- ✅ **Profile Management** - User profiles with role assignments

---

## System Requirements

### Software Requirements
- **Browser**: Chrome 89+, Edge 89+, or Opera 76+ (WebSerial API support required)
- **Operating System**: Windows, macOS, or Linux

### Hardware Requirements (for Manikin Control)
- Arduino-compatible microcontroller (Arduino Mega recommended)
- USB cable for Arduino connection
- Audio amplifier modules for each speaker
- Speakers mounted at anatomical locations on manikin

---

## Installation & Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd medical-auscultation-trainer

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 2. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

### 3. Create an Account

1. Click **"Sign Up"** on the login page
2. Enter your email, full name, and password
3. Verify your email if required
4. Log in with your credentials

> **Note**: New users are assigned the "Examinee" role by default. Contact an administrator to upgrade to "Examiner" or "Admin" role.

---

## Arduino Hardware Setup

### Required Components

| Component | Quantity | Purpose |
|-----------|----------|---------|
| Arduino Mega 2560 | 1 | Main controller |
| DFPlayer Mini MP3 | 3 | Audio playback modules |
| Speakers (8Ω, 3W) | 6+ | Mounted at auscultation points |
| MicroSD Cards | 3 | Store audio files |
| Amplifier modules | 3 | Audio amplification |

### Wiring Diagram

```
Arduino Mega
│
├── Serial1 (TX1/RX1) ──► DFPlayer #1 (Lungs)
│                              └── Speakers at lung positions
│
├── Serial2 (TX2/RX2) ──► DFPlayer #2 (Heart)
│                              └── Speakers at heart positions
│
└── Serial3 (TX3/RX3) ──► DFPlayer #3 (Bowel)
                               └── Speakers at bowel positions
```

### Arduino Firmware

Upload the following firmware to your Arduino:

```cpp
// Arduino Manikin Controller
// Receives commands via USB Serial and controls DFPlayer modules

#include <SoftwareSerial.h>
#include <DFRobotDFPlayerMini.h>

// DFPlayer instances for each body system
DFRobotDFPlayerMini lungPlayer;
DFRobotDFPlayerMini heartPlayer;
DFRobotDFPlayerMini bowelPlayer;

void setup() {
  Serial.begin(9600);   // USB communication
  Serial1.begin(9600);  // Lung DFPlayer
  Serial2.begin(9600);  // Heart DFPlayer
  Serial3.begin(9600);  // Bowel DFPlayer
  
  lungPlayer.begin(Serial1);
  heartPlayer.begin(Serial2);
  bowelPlayer.begin(Serial3);
  
  Serial.println("READY");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    processCommand(command);
  }
}

void processCommand(String cmd) {
  // Command format: SYSTEM:ACTION:PARAM
  // Example: LUNG:PLAY:01 or HEART:STOP or BOWEL:VOL:7
  
  int firstColon = cmd.indexOf(':');
  int secondColon = cmd.indexOf(':', firstColon + 1);
  
  String system = cmd.substring(0, firstColon);
  String action = cmd.substring(firstColon + 1, secondColon);
  String param = cmd.substring(secondColon + 1);
  
  DFRobotDFPlayerMini* player = getPlayer(system);
  if (player == NULL) {
    Serial.println("ERR:INVALID_SYSTEM");
    return;
  }
  
  if (action == "PLAY") {
    int track = param.toInt();
    player->play(track);
    Serial.println("OK:PLAYING:" + system + ":" + param);
  } 
  else if (action == "STOP") {
    player->stop();
    Serial.println("OK:STOPPED:" + system);
  }
  else if (action == "VOL") {
    int vol = param.toInt();
    player->volume(vol * 3); // Scale 1-10 to 3-30
    Serial.println("OK:VOLUME:" + system + ":" + param);
  }
}

DFRobotDFPlayerMini* getPlayer(String system) {
  if (system == "LUNG") return &lungPlayer;
  if (system == "HEART") return &heartPlayer;
  if (system == "BOWEL") return &bowelPlayer;
  return NULL;
}
```

### Connecting Arduino to the Application

1. **Connect Arduino** via USB to your computer
2. **Open the application** in Chrome, Edge, or Opera
3. **Navigate to a session control page** (Examiner role required)
4. **Click "Connect Arduino"** button
5. **Select the Arduino port** from the browser dialog (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)
6. **Verify connection** - Badge should show "Connected"

> ⚠️ **Important**: WebSerial only works in Chromium-based browsers. Firefox and Safari are not supported.

---

## User Roles

### 👨‍💼 Admin
- Full access to all features
- Manage users and assign roles
- Upload and manage sound library
- View all sessions and analytics

### 👨‍🏫 Examiner
- Create and manage training sessions
- Control manikin hardware (multi-speaker)
- View student responses in real-time
- Access session analytics

### 👨‍🎓 Examinee (Student)
- Join sessions using session codes
- Submit responses during active sessions
- View personal performance and feedback
- Access practice mode

---

## User Guides

### Admin Guide

#### Accessing Admin Dashboard
1. Log in with admin credentials
2. Navigate to `/admin` or click "Admin Dashboard" in navigation

#### Managing Users
1. Go to **Users** section in admin dashboard
2. View all registered users
3. Click on a user to change their role
4. Available roles: Admin, Examiner, Examinee

#### Managing Sound Library
1. Go to **Sounds** section in admin dashboard
2. Upload new audio files (MP3 format recommended)
3. Assign sounds to body systems (Lung, Heart, Bowel)
4. Add sound codes for Arduino mapping

---

### Examiner Guide

#### Creating a New Session

1. **Navigate** to Examiner Dashboard (`/examiner`)
2. **Click** "New Session" button
3. **Enter** session name (e.g., "Respiratory Sounds Lab 1")
4. **Click** "Create Session"
5. **Copy** the session code or join link to share with students

#### Controlling a Session

1. **Open** the session from your dashboard
2. **Connect Arduino** (if using hardware)
3. **Start** the session when students are ready

##### Multi-Speaker Control Panel

The control panel shows three independent speaker controls:

| 🫁 Lungs | ❤️ Heart | 🔊 Bowel |
|----------|----------|----------|
| Select lung sounds | Select heart sounds | Select bowel sounds |
| Choose lung location | Choose heart location | Choose bowel location |
| Adjust volume | Adjust volume | Adjust volume |
| Play/Stop | Play/Stop | Play/Stop |

**To play a sound:**
1. Select the **Sound** from the dropdown
2. Select the **Location** on the manikin
3. Adjust the **Volume** (1-10)
4. Click **Play**

**To stop a sound:**
- Click **Stop** on individual speaker, OR
- Click **Stop All** to stop all speakers

##### Session Controls

| Button | Action |
|--------|--------|
| Start Session | Begins the session, enables student responses |
| Pause | Temporarily pauses the session |
| Resume | Resumes a paused session |
| End Session | Completes the session, finalizes results |

#### Viewing Responses

- **Real-time responses** appear in the right panel
- ✅ Green check = Correct answer
- ❌ Red X = Incorrect answer
- View detailed analytics after session ends

---

### Examinee (Student) Guide

#### Joining a Session

**Method 1: Direct Link**
1. Click the join link provided by your examiner
2. Log in if prompted
3. Wait for session to start

**Method 2: Session Code**
1. Navigate to `/join` or click "Join Session"
2. Enter the 6-character session code
3. Click "Join Session"
4. Wait for session to start

#### During a Session

1. **Listen** to the sound played on the manikin
2. **Select** the anatomical location on the body diagram
3. **Choose** the sound type you identified
4. **Submit** your response
5. **View** immediate feedback (correct/incorrect)

#### Viewing Results

- After each response, see if you were correct
- View session summary when session ends
- Check leaderboard for ranking among peers

---

## Troubleshooting

### Connection Issues

| Problem | Solution |
|---------|----------|
| "WebSerial Not Supported" | Use Chrome, Edge, or Opera browser |
| Arduino not appearing in port list | Check USB cable, try different port |
| Connection fails | Ensure Arduino has correct firmware uploaded |
| Commands not working | Check Arduino serial monitor for errors |

### Session Issues

| Problem | Solution |
|---------|----------|
| Can't create session | Verify you have Examiner or Admin role |
| Students can't join | Ensure session is in "pending" or "active" status |
| Responses not recording | Check that session is "active" (not paused) |
| Real-time updates not working | Refresh page, check internet connection |

### Audio Issues

| Problem | Solution |
|---------|----------|
| No sound from manikin | Check speaker connections, verify DFPlayer has SD card |
| Wrong sound playing | Verify sound files are numbered correctly on SD card |
| Volume too low/high | Adjust volume in app and check amplifier settings |

### Browser Console Errors

Open browser DevTools (F12) and check Console tab for errors:

```
Error: infinite recursion detected in policy
→ Database policy issue - contact administrator

Error: Failed to fetch
→ Network connectivity issue - check internet connection

Error: Permission denied
→ Role/access issue - verify user role
```

---

## Technical Architecture

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/UI** - Component library
- **React Router** - Navigation

### Backend Stack
- **Supabase** - Database, Auth, Real-time
- **Edge Functions** - Arduino command formatting
- **PostgreSQL** - Data storage

### Hardware Communication
- **WebSerial API** - Browser-to-Arduino USB communication
- **Custom Protocol** - Command format for DFPlayer control

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────►│  Supabase   │────►│  Database   │
│  (Examiner) │     │  Real-time  │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │   Browser   │
       │            │  (Student)  │
       │            └─────────────┘
       ▼
┌─────────────┐     ┌─────────────┐
│  WebSerial  │────►│   Arduino   │
│     API     │     │   Manikin   │
└─────────────┘     └─────────────┘
```

---

## SD Card Audio File Setup

Each DFPlayer module requires a microSD card with audio files. Files must be named with a specific format:

### File Naming Convention

```
/01/001.mp3  - First track in folder 01
/01/002.mp3  - Second track in folder 01
/02/001.mp3  - First track in folder 02
```

### Recommended Sound Mapping

**Lung Sounds (DFPlayer #1):**
| Track | Sound Code | Description |
|-------|------------|-------------|
| 001 | NORMAL | Normal vesicular breathing |
| 002 | CRACKLES | Crackles/rales |
| 003 | WHEEZE | Wheezing |
| 004 | RHONCHI | Rhonchi |
| 005 | STRIDOR | Stridor |
| 006 | PLEURAL | Pleural friction rub |

**Heart Sounds (DFPlayer #2):**
| Track | Sound Code | Description |
|-------|------------|-------------|
| 001 | S1S2 | Normal S1/S2 |
| 002 | S3 | S3 gallop |
| 003 | S4 | S4 gallop |
| 004 | SYSTOLIC | Systolic murmur |
| 005 | DIASTOLIC | Diastolic murmur |
| 006 | PERICARDIAL | Pericardial rub |

**Bowel Sounds (DFPlayer #3):**
| Track | Sound Code | Description |
|-------|------------|-------------|
| 001 | NORMAL | Normal bowel sounds |
| 002 | HYPER | Hyperactive |
| 003 | HYPO | Hypoactive |
| 004 | ABSENT | Absent (silence) |
| 005 | BORBORYGMI | Borborygmi |

---

## Deployment

### Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy to your hosting provider (Vercel, Netlify, etc.)

3. Configure environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon key

---

## Support

For technical issues or feature requests:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Contact your system administrator

---

## License

This project is proprietary software for medical education purposes.

---

**Built with ❤️ for Medical Education**
