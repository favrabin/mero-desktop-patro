# Mero Desktop Patro

A lightweight desktop calendar for viewing Nepali Bikram Sambat and English dates.

<p align="center">
  <strong>Mero Desktop Patro</strong><br>
  Nepali dates, right on your desktop.
</p>

## Features

- Nepali Bikram Sambat and English date display
- Compact desktop calendar widget
- Full calendar view
- Nepali date conversion and calendar data
- Settings and application information
- Windows installer

## Download

**[Download Mero Desktop Patro v1.0.0](https://github.com/favrabin/mero-desktop-patro/releases/tag/v1.0.0)**

Download the Windows installer:

`Mero Desktop Patro_1.0.0_x64-setup.exe`

Run the installer and follow the on-screen instructions.

## Technology

- Tauri 2
- JavaScript, HTML, and CSS
- Rust
- Nepali calendar data and date-conversion utilities

## Build from Source

### Requirements

- Node.js and npm
- Rust toolchain
- Tauri 2 development prerequisites for your operating system

### Setup

```bash
git clone https://github.com/favrabin/mero-desktop-patro.git
cd mero-desktop-patro/Main
npm install
```

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The Windows installer is generated in:

`src-tauri/target/release/bundle/nsis/`

## Project Structure

```text
Main/
├── scripts/       # Build and test scripts
├── src/           # Application UI, styles, and calendar logic
└── src-tauri/     # Tauri and Rust application
```

## License

The source code and bundled assets are provided as published in this repository. See the included font license at `Main/src/fonts/OFL.txt` for the Noto Sans Devanagari UI font.
