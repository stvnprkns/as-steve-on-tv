// Fetch data from the local JSON file
async function fetchSteveData() {
    try {
      const response = await fetch('steves.json');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Steve data:', error);
      return []; // Return an empty array in case of an error
    }
  }
  
  // Populate the table with Steve data
  function populateTable(steves) {
    const tableBody = document.querySelector('#steve-table tbody');
    tableBody.innerHTML = ''; // Clear any existing rows
  
    steves.forEach((steve) => {
      const row = `
        <tr>
          <td>${steve.name}</td>
          <td>${steve.title}</td>
          <td>${steve.actor}</td>
          <td>${steve.year}</td>
          <td>${steve.roleType}</td>
          <td>${steve.category}</td>
          <td>${steve.quote}</td>
        </tr>
      `;
      tableBody.innerHTML += row;
    });
  }
  
  // Setup search functionality
  function setupSearch(steves) {
    const searchBar = document.getElementById('search-bar');
    searchBar.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase();
  
      const filteredSteves = steves.filter((steve) =>
        Object.values(steve).some((value) =>
          String(value).toLowerCase().includes(query)
        )
      );
  
      populateTable(filteredSteves);
    });
  }
  
  // Initialize the app
  async function init() {
    const steves = await fetchSteveData();
    populateTable(steves);
    setupSearch(steves);
  }
  
  // Run the app
  init();
  