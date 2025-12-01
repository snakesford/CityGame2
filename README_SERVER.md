# CityGame2 Server Setup

This server is required to run the game properly, as it resolves CORS issues when loading JSON files (like `quests.json`) that cannot be loaded via the `file://` protocol.

## Installation

1. Make sure you have Node.js installed on your system. You can download it from [nodejs.org](https://nodejs.org/).

2. Install the required dependencies:
   ```bash
   npm install
   ```

## Running the Server

To start the server, run:
```bash
npm start
```

Or directly with Node.js:
```bash
node server.js
```

The server will start on **http://localhost:3000** by default.

You can change the port by setting the `PORT` environment variable:
```bash
PORT=8080 npm start
```

## Using the Game

Once the server is running, open your web browser and navigate to:
```
http://localhost:3000
```

The game will now be able to load `quests.json` and other JSON files without CORS errors.

## What the Server Does

- Serves all static files (HTML, CSS, JavaScript, images)
- Handles JSON files with proper content-type headers
- Enables CORS to allow cross-origin requests
- Serves `index.html` as the default route

## Troubleshooting

- **Port already in use**: If port 3000 is already in use, set a different port using the `PORT` environment variable.
- **Cannot find module 'express'**: Make sure you've run `npm install` to install dependencies.
- **Game still shows errors**: Make sure you're accessing the game through the server URL (http://localhost:3000) and not via the file:// protocol.

