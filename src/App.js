import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState({ fqdn: '', privateIp: '', owner: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to update domain data with certificate information
  const updateDomainData = (index, newInfo) => {
    setDomains(prevDomains => {
      const updatedDomains = [...prevDomains];
      updatedDomains[index] = {
        ...updatedDomains[index],
        publicIp: newInfo.ipAddress || 'Not available',
        owner: newInfo.serverName || 'Not available',
        certificate: {
          valid: newInfo.hasValidCertificate ? 'Valid' : 'Invalid',
          expires: newInfo.validUntil || 'Unknown'
        }
      };
      return updatedDomains;
    });
  };

  // Function to check SSL certificate for a given domain
  const checkCertificate = (domain, index) => {
    axios.get(`/check-ssl?domain=${domain.fqdn}`)
      .then(response => {
        setDomains(prevDomains => {
          const updatedDomains = [...prevDomains];
          updatedDomains[index] = {
            ...updatedDomains[index],
            certificate: {
              hasValidCertificate: response.data.hasValidCertificate,
              validUntil: response.data.validUntil || 'Unknown'
            }
          };
          return updatedDomains;
        });
      })
      .catch(error => {
        console.error('Error fetching SSL info:', error);
        setDomains(prevDomains => {
          const updatedDomains = [...prevDomains];
          updatedDomains[index] = {
            ...updatedDomains[index],
            certificate: { hasValidCertificate: false, validUntil: 'Error fetching data' }
          };
          return updatedDomains;
        });
      });
  };
  

  // Fetch domains and their SSL status on mount
  useEffect(() => {
    const fetchDomains = () => {
      setIsLoading(true);
      axios.get('/domains')
        .then(response => {
          const loadedDomains = response.data;
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
  }, []);

  // Handle new domain addition
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

  // Delete a domain
  const handleDelete = (index) => {
    setIsLoading(true);
    axios.delete(`/domains/${index}`)
      .then(response => {
        setDomains(domains.filter((_, i) => i !== index));
      })
      .catch(error => {
        console.error('Error deleting domain:', error);
        setError('Failed to delete domain');
      })
      .finally(() => setIsLoading(false));
  };

  // Update a domain
  const handleUpdate = (index) => {
    const updatedOwner = prompt("Enter new owner name:", domains[index].owner);
    if (updatedOwner && updatedOwner !== domains[index].owner) {
      setIsLoading(true);
      const updatedDomain = { ...domains[index], owner: updatedOwner };
      axios.put(`/domains/${index}`, updatedDomain)
        .then(response => {
          const updatedDomains = [...domains];
          updatedDomains[index] = updatedDomain;
          setDomains(updatedDomains);
        })
        .catch(error => {
          console.error('Error updating domain:', error);
          setError('Failed to update domain');
        })
        .finally(() => setIsLoading(false));
    }
  };

  return (
    <div className="container mx-auto p-4">
      {error && <p className="text-red-500">{error}</p>}
      {isLoading && <p>Loading...</p>}
      <div className="mb-4">
        <input type="text" placeholder="FQDN" value={newDomain.fqdn} onChange={(e) => setNewDomain({ ...newDomain, fqdn: e.target.value })} />
        <input type="text" placeholder="Private IP" value={newDomain.privateIp} onChange={(e) => setNewDomain({ ...newDomain, privateIp: e.target.value })} />
        <input type="text" placeholder="Owner" value={newDomain.owner} onChange={(e) => setNewDomain({ ...newDomain, owner: e.target.value })} />
        <button onClick={handleAddDomain}>Add Domain</button>
      </div>
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
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${domain.certificate?.hasValidCertificate ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {domain.certificate?.hasValidCertificate ? 'Valid' : 'Invalid'} (Expires: {domain.certificate?.validUntil || 'N/A'})
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
