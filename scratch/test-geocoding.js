const https = require('https');

const apiKey = 'AIzaSyChXRGWTxSJ3HgNUXhJf4IUZcYw6608Jkw';
const address = 'Mendoza 2850, C1428DKX Cdad. Autónoma de Buenos Aires';

const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Geocoding API Response:", JSON.stringify(json, null, 2));
    } catch (e) {
      console.error("JSON parsing error:", e);
    }
  });
}).on('error', (err) => {
  console.error("HTTP error:", err);
});
