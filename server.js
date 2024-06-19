const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const app = express();
const sslChecker = require("ssl-checker");
const port = process.env.PORT || 5006;
const DATA_FILE = "./data.json";

app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "build")));

app.get("/domains", (req, res) => {
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send("Error reading data file");
      return;
    }
    res.json(JSON.parse(data));
  });
});

app.post("/domains", (req, res) => {
  if (!req.body.fqdn || !req.body.privateIp || !req.body.owner) {
    return res.status(400).send("Missing fields");
  }

  const newDomain = req.body;
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send("Error reading data file");
      return;
    }
    const domains = JSON.parse(data || "[]");
    domains.push(newDomain);
    fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
      if (err) {
        res.status(500).send("Error writing data file");
        return;
      }
      res.status(201).send("Data added");
    });
  });
});

app.put("/domains/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index)) {
    return res.status(400).send("Invalid index");
  }

  const updatedDomain = req.body;
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send("Error reading data file");
      return;
    }
    const domains = JSON.parse(data);
    if (index >= 0 && index < domains.length) {
      domains[index] = updatedDomain;
      fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
        if (err) {
          res.status(500).send("Error writing data file");
          return;
        }
        res.send("Data updated");
      });
    } else {
      res.status(404).send("Domain not found");
    }
  });
});

app.delete("/domains/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index)) {
    return res.status(400).send("Invalid index");
  }

  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.status(500).send("Error reading data file");
      return;
    }
    let domains = JSON.parse(data);
    if (index >= 0 && index < domains.length) {
      domains = domains.filter((_, i) => i !== index);
      fs.writeFile(DATA_FILE, JSON.stringify(domains, null, 2), (err) => {
        if (err) {
          res.status(500).send("Error writing data file");
          return;
        }
        res.send("Data deleted");
      });
    } else {
      res.status(404).send("Domain not found");
    }
  });
});

const checkSsl = async (domain, port) => {
    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: domain,
        port: port,
        method: 'GET',
        rejectUnauthorized: false,
        servername: domain, // Important pour SNI (Server Name Indication)
        timeout: 120000 // Timeout de 2 minutes
      };
  
      const httpsReq = https.request(reqOptions, (response) => {
        const cert = response.socket.getPeerCertificate();
        if (cert && Object.keys(cert).length > 0) {
          const currentDate = new Date();
          const validUntilDate = new Date(cert.valid_to);
          const isValid = validUntilDate > currentDate;
  
          let certificateStatus = 'Invalid';
          if (isValid) {
            const daysRemaining = (validUntilDate - currentDate) / (1000 * 60 * 60 * 24);
            if (daysRemaining <= 7) {
              certificateStatus = 'Expiring Soon';
            } else {
              certificateStatus = 'Valid';
            }
          }
  
          resolve({
            domain,
            hasValidCertificate: isValid,
            validUntil: cert.valid_to,
            certificateStatus
          });
        } else {
          resolve({
            domain,
            hasValidCertificate: false,
            validUntil: null,
            certificateStatus: 'Invalid'
          });
        }
      });
  
      httpsReq.on('error', (err) => {
        if (port === 443) {
          // Si le port 443 échoue, essayez le port 5010
          checkSsl(domain, 5010).then(resolve).catch(reject);
        } else {
          reject(new Error('Failed to establish HTTPS connection: ' + err.message));
        }
      });
  
      httpsReq.end();
    });
  };
  
  app.get('/check-ssl', async (req, res) => {
    const domain = req.query.domain;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
  
    try {
      const result = await checkSsl(domain, 443);
      res.json(result);
    } catch (error) {
      console.error(`Error checking SSL for ${domain}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/build/index.html"));
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
