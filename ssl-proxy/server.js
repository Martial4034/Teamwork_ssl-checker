const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const app = express();
const port = 5006;
const DATA_FILE = './data.json';

// Configuration du CORS pour accepter toutes les origines et toutes les headers
app.use(cors({
  origin: '*',  // Autorise toutes les origines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Autorise toutes les méthodes
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'x-access-token', 'X-Requested-With', 'Accept'],
  credentials: true  // Permet le support des credentials
}));

app.use(express.json()); // Pour parser les requêtes JSON

// Lire les données
app.get('/domains', (req, res) => {
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send('Error reading data file');
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Ajouter une entrée
app.post('/domains', (req, res) => {
  if (!req.body.fqdn || !req.body.privateIp || !req.body.owner) {
    return res.status(400).send('Missing fields');
  }

  const newDomain = req.body;
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send('Error reading data file');
      return;
    }
    const domains = JSON.parse(data || '[]'); // Handle null data case
    domains.push(newDomain);
    fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
      if (err) {
        res.status(500).send('Error writing data file');
        return;
      }
      res.status(201).send('Data added');
    });
  });
});

// Modifier une entrée
app.put('/domains/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index)) {
    return res.status(400).send('Invalid index');
  }
  
  const updatedDomain = req.body;
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send('Error reading data file');
      return;
    }
    const domains = JSON.parse(data);
    if (index >= 0 && index < domains.length) {
      domains[index] = updatedDomain;
      fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
        if (err) {
          res.status(500).send('Error writing data file');
          return;
        }
        res.send('Data updated');
      });
    } else {
      res.status(404).send('Domain not found');
    }
  });
});

// Supprimer une entrée
app.delete('/domains/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index)) {
    return res.status(400).send('Invalid index');
  }

  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send('Error reading data file');
      return;
    }
    let domains = JSON.parse(data);
    if (index >= 0 && index < domains.length) {
      domains = domains.filter((_, i) => i !== index);
      fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
        if (err) {
          res.status(500).send('Error writing data file');
          return;
        }
        res.send('Data deleted');
      });
    } else {
      res.status(404).send('Domain not found');
    }
  });
});

// Vérifier le certificat SSL
app.get('/check-ssl', (req, res) => {
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  const reqOptions = {
    hostname: domain,
    port: 443,
    method: 'GET',
    rejectUnauthorized: false
  };

  const httpsReq = https.request(reqOptions, (response) => {
    const cert = response.socket.getPeerCertificate();
    if (cert && Object.keys(cert).length > 0) {
      return res.json({
        domain,
        hasValidCertificate: true,
        validUntil: cert.valid_to
      });
    } else {
      return res.json({
        domain,
        hasValidCertificate: false,
        validUntil: null
      });
    }
  });

  httpsReq.on('error', (err) => {
    console.error('HTTPS Request Error:', err);
    res.status(500).json({ error: 'Failed to establish HTTPS connection', details: err.message });
  });

  httpsReq.end();
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
