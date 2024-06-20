document.addEventListener('DOMContentLoaded', async () => {
    const fetchDataButton = document.getElementById('fetchData');
    const itemSelect = document.getElementById('item');

    try {
        // Fetch the list of towns and populate the item dropdown
        const townsResponse = await fetch('/update-cache'); // Trigger cache update
        const towns = await townsResponse.json();

        if (towns.length > 0) {
            // Populate the item dropdown with available market items from the first town as an example
            const firstTownId = towns[0].id;
            const marketDataResponse = await fetch(`/data/${firstTownId}`);
            const marketData = await marketDataResponse.json();

            for (const itemName in marketData.markets) {
                const option = document.createElement('option');
                option.value = itemName;
                option.text = itemName;
                itemSelect.appendChild(option);
            }
        }

        // Add event listener to the fetch data button
        fetchDataButton.addEventListener('click', async () => {
            const selectedItem = itemSelect.value;
            if (selectedItem) {
                await fetchAndDisplayData(towns, selectedItem);
            } else {
                alert("Please select an item.");
            }
        });
    } catch (error) {
        console.error('Error initializing data:', error);
        alert("Failed to initialize data. Check your server and network connection.");
    }
});

async function fetchAndDisplayData(towns, selectedItem) {
    const tableBody = document.querySelector('#marketTable tbody');
    tableBody.innerHTML = '';

    for (const town of towns) {
        try {
            const marketDataResponse = await fetch(`/data/${town.id}`);
            const marketData = await marketDataResponse.json();
            const itemData = marketData.markets[selectedItem];

            if (itemData) {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${town.name}</td><td>${itemData.price}</td><td>${itemData.open_price}</td><td>${itemData.last_price}</td><td>${itemData.moving_average}</td><td>${itemData.highest_bid}</td><td>${itemData.high_price}</td><td>${itemData.low_price}</td><td>${itemData.volume}</td><td>${itemData.volume_prev_12}</td><td>${itemData.bid_volume_10}</td>`;
                tableBody.appendChild(row);
            }
        } catch (error) {
            console.error(`Error fetching data for town ID ${town.id}:`, error);
        }
    }
}
