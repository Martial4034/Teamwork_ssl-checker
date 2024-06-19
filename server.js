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

// Fonction pour introduire un délai
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const checkSsl = async (domain) => {
  try {
    // Première tentative de vérification sur le port 443
    let result = await sslChecker(domain, { method: 'GET', port: 443 });

    if (!result.valid || !result.validTo) {
      // Introduire un délai avant la deuxième tentative
      await delay(5000); // Délai de 5 secondes

      // Deuxième tentative de vérification sur le port 443
      result = await sslChecker(domain, { method: 'GET', port: 443 });
    }

    if (!result.valid || !result.validTo) {
      // Si le certificat n'est toujours pas valide ou aucune date de validité n'est fournie, vérifier le port 5010
      result = await sslChecker(domain, { method: 'GET', port: 5010 });
    }

    if (result.valid && result.validTo) {
      const currentDate = new Date();
      const validUntilDate = new Date(result.validTo);
      const daysRemaining = (validUntilDate - currentDate) / (1000 * 60 * 60 * 24);

      let certificateStatus = 'Invalid';
      if (daysRemaining > 0) {
        if (daysRemaining <= 7) {
          certificateStatus = 'Expiring Soon';
        } else {
          certificateStatus = 'Valid';
        }
      }

      return {
        domain,
        hasValidCertificate: certificateStatus !== 'Invalid',
        validUntil: result.validTo,
        certificateStatus
      };
    } else {
      return {
        domain,
        hasValidCertificate: false,
        validUntil: null,
        certificateStatus: 'Invalid'
      };
    }
  } catch (error) {
    console.error(`Error checking SSL for ${domain}:`, error);
    return {
      domain,
      hasValidCertificate: false,
      validUntil: null,
      certificateStatus: 'Invalid'
    };
  }
};

app.get('/check-ssl', async (req, res) => {
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const result = await checkSsl(domain);
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
