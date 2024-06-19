import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState({ fqdn: '', privateIp: '', owner: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const pendingRequests = useRef({});

  const updateDomainData = (index, newInfo) => {
    setDomains(prevDomains => {
      const updatedDomains = [...prevDomains];
      updatedDomains[index] = {
        ...updatedDomains[index],
        certificate: {
          valid: newInfo.hasValidCertificate ? 'Valid' : 'Invalid',
          expires: newInfo.validUntil || 'Unknown'
        }
      };
      return updatedDomains;
    });
  };

  const checkCertificate = useCallback((domain, index) => {
    if (pendingRequests.current[domain.fqdn]) {
      return;
    }

    pendingRequests.current[domain.fqdn] = true;

    setIsLoading(true); // Commencer le chargement

    axios.get(`/check-ssl?domain=${domain.fqdn}`)
      .then(response => {
        console.log(`Received response for ${domain.fqdn}:`, response.data);
        updateDomainData(index, response.data);
      })
      .catch(error => {
        console.error(`Error fetching SSL info for ${domain.fqdn}:`, error);
        updateDomainData(index, {
          hasValidCertificate: false,
          validUntil: 'Error fetching data'
        });
      })
      .finally(() => {
        delete pendingRequests.current[domain.fqdn];
        setIsLoading(false); // Terminer le chargement
      });
  }, []);

  useEffect(() => {
    const fetchDomains = () => {
      axios.get('/domains')
        .then(response => {
          const loadedDomains = response.data.map(domain => ({
            ...domain,
            certificate: { valid: 'Validating...', expires: 'Validating...' }
          }));
          setDomains(loadedDomains);
          loadedDomains.forEach((domain, index) => checkCertificate(domain, index));
        })
        .catch(error => {
          console.error('Error fetching domains:', error);
          setError('Failed to fetch domains');
        })
        .finally(() => setIsLoading(false));
    };
    fetchDomains();
  }, [checkCertificate]);

  const handleAddDomain = () => {
    if (!newDomain.fqdn || !newDomain.privateIp || !newDomain.owner) {
      setError('All fields must be filled!');
      return;
    }

    setIsLoading(true);
    axios.post('/domains', newDomain)
      .then(response => {
        const updatedDomains = [...domains, { ...newDomain, certificate: { valid: 'Validating...', expires: 'Validating...' } }];
        setDomains(updatedDomains);
        checkCertificate(newDomain, updatedDomains.length - 1); // Check the newly added domain
      })
      .catch(error => {
        console.error('Error adding domain:', error);
        setError('Failed to add domain');
      })
      .finally(() => {
        setIsLoading(false);
        setNewDomain({ fqdn: '', privateIp: '', owner: '' }); // Reset form
      });
  };

  const handleDelete = (index) => {
    axios.delete(`/domains/${index}`)
      .then(response => {
        setDomains(domains.filter((_, i) => i !== index));
      })
      .catch(error => console.error('Error deleting domain:', error));
  };

  const handleUpdate = (index) => {
    const updatedOwner = prompt("Enter new owner name:", domains[index].owner);
    if (updatedOwner !== null) {
      const updatedDomain = { ...domains[index], owner: updatedOwner };
      axios.put(`/domains/${index}`, updatedDomain)
        .then(response => {
          const newDomains = [...domains];
          newDomains[index] = updatedDomain;
          setDomains(newDomains);
        })
        .catch(error => console.error('Error updating domain:', error));
    }
  };

  return (
    <div className="container mx-auto p-4">
      {isLoading && <div>Loading...</div>}
      <input
        type="text"
        placeholder="FQDN"
        value={newDomain.fqdn}
        onChange={(e) => setNewDomain({ ...newDomain, fqdn: e.target.value })}
      />
      <input
        type="text"
        placeholder="Private IP"
        value={newDomain.privateIp}
        onChange={(e) => setNewDomain({ ...newDomain, privateIp: e.target.value })}
      />
      <input
        type="text"
        placeholder="Owner"
        value={newDomain.owner}
        onChange={(e) => setNewDomain({ ...newDomain, owner: e.target.value })}
      />
      <button onClick={handleAddDomain}>Add Domain</button>

      <div className="overflow-x-auto relative">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="py-3 px-6">FQDN</th>
              <th scope="col" className="py-3 px-6">Private IP</th>
              <th scope="col" className="py-3 px-6">Owner</th>
              <th scope="col" className="py-3 px-6">Actions</th>
              <th scope="col" className="py-3 px-6">Certificate Status</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain, index) => (
              <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                <td className="py-4 px-6">{domain.fqdn}</td>
                <td className="py-4 px-6">{domain.privateIp}</td>
                <td className="py-4 px-6">{domain.owner}</td>
                <td className="py-4 px-6">
                  <button onClick={() => handleUpdate(index)}>Update</button>
                  <button onClick={() => handleDelete(index)}>Delete</button>
                </td>
                <td className="py-4 px-6">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${domain.certificate.valid === 'Valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {domain.certificate.valid} (Expires: {domain.certificate.expires})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
