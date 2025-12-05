const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from the project root (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Specifically handle JSON files with proper content-type headers
app.get('*.json', (req, res, next) => {
  res.type('application/json');
  next();
}, express.static(__dirname));

// Serve index.html as the default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`CityGame2 server is running on http://localhost:${PORT}`);
  console.log(`Open your browser and navigate to http://localhost:${PORT} to play the game.`);
});

