document.addEventListener("DOMContentLoaded", async () => {
  const fetchDataButton = document.getElementById("fetchData");
  const itemSelect = document.getElementById("item");
  const table = document.getElementById("marketTable");
  const tableHeaders = table.querySelectorAll("th");
  let sortDirection = {};
  let towns = [];

  // Helper function to fetch town data
  const fetchTowns = async () => {
    try {
      const response = await fetch("/update-cache");
      if (response.ok) {
        towns = await response.json();
      } else {
        console.error("Failed to fetch towns:", response.status);
      }
    } catch (error) {
      console.error("Error fetching towns:", error);
    }
  };

  // Populate item dropdown and set "labour" as default if available
  const populateItems = async () => {
    if (towns.length > 0) {
      const firstTownId = towns[0].id;
      const marketDataResponse = await fetch(`/data/${firstTownId}`);
      const marketData = await marketDataResponse.json();
      let labourFound = false;

      for (const itemName in marketData.markets) {
        const option = document.createElement("option");
        option.value = itemName;
        option.text = itemName;
        if (itemName.toLowerCase() === "labour") {
          option.selected = true;
          labourFound = true;
        }
        itemSelect.appendChild(option);
      }

      if (!labourFound && itemSelect.options.length > 0) {
        itemSelect.options[0].selected = true;
      }
    }
  };

  // Function to fetch and display data for the selected item
  const fetchAndDisplayData = async (selectedItem) => {
    const tableBody = document.querySelector("#marketTable tbody");
    tableBody.innerHTML = "";

    for (const town of towns) {
      try {
        const marketDataResponse = await fetch(`/data/${town.id}`);
        const marketData = await marketDataResponse.json();
        const itemData = marketData.markets[selectedItem];

        if (itemData) {
          const row = document.createElement("tr");
          row.innerHTML = `<td>${town.name}</td><td>${replaceZeroWithEmpty(
            itemData.price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.open_price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.last_price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.average_price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.moving_average
          )}</td><td>${replaceZeroWithEmpty(
            itemData.highest_bid
          )}</td><td>${replaceZeroWithEmpty(
            itemData.lowest_ask
          )}</td><td>${replaceZeroWithEmpty(
            itemData.high_price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.low_price
          )}</td><td>${replaceZeroWithEmpty(
            itemData.volume
          )}</td><td>${replaceZeroWithEmpty(
            itemData.volume_prev_12
          )}</td><td>${replaceZeroWithEmpty(itemData.bid_volume_10)}</td>`;
          tableBody.appendChild(row);
        }
      } catch (error) {
        console.error(`Error fetching data for town ID ${town.id}:`, error);
      }
    }
  };

  // Helper function to replace zero with empty string
  const replaceZeroWithEmpty = (value) => {
    return value === 0 ? "" : value;
  };

  // Function to sort table data
  const sortTable = (columnIndex, dataType) => {
    const tableBody = table.querySelector("tbody");
    const rows = Array.from(tableBody.rows);

    const isAscending = sortDirection[columnIndex] === "asc";
    sortDirection[columnIndex] = isAscending ? "desc" : "asc";

    const compare = (a, b) => {
      const cellA = a.cells[columnIndex].innerText;
      const cellB = b.cells[columnIndex].innerText;

      let valA = cellA;
      let valB = cellB;

      if (dataType === "number") {
        valA = parseFloat(cellA);
        valB = parseFloat(cellB);
      } else if (dataType === "string") {
        valA = cellA.toLowerCase();
        valB = cellB.toLowerCase();
      }

      if (isAscending) {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    };

    rows.sort(compare);
    tableBody.append(...rows);
  };

  // Initialize the table with sorting functionality
  const initializeSorting = () => {
    tableHeaders.forEach((header, index) => {
      header.addEventListener("click", () => {
        const dataType =
          header.id.includes("Price") || header.id.includes("Volume")
            ? "number"
            : "string";
        sortTable(index, dataType);
      });
    });
  };

  // Initialize data and events
  try {
    await fetchTowns();
    await populateItems();

    fetchDataButton.addEventListener("click", async () => {
      const selectedItem = itemSelect.value;
      if (selectedItem) {
        await fetchAndDisplayData(selectedItem);
      } else {
        alert("Please select an item.");
      }
    });

    // Automatically fetch data for the default selected item ("labour" or the first available item)
    if (itemSelect.value) {
      await fetchAndDisplayData(itemSelect.value);
    }

    // Initialize table sorting
    initializeSorting();
  } catch (error) {
    console.error("Error initializing data:", error);
    alert(
      "Failed to initialize data. Check your server and network connection."
    );
  }
});
