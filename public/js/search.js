document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let abortController = new AbortController(); // For canceling pending requests

    async function fetchProducts(query = '') {
        try {
            // Cancel previous request if still pending
            abortController.abort();
            abortController = new AbortController();

            const response = await fetch(`/user/api/search?query=${encodeURIComponent(query)}`, {
                signal: abortController.signal
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const products = await response.json();
            return products;
        } catch (error) {
            if (error.name !== 'AbortError') { // Ignore cancellation errors
                console.error('Error fetching products:', error);
                searchResults.innerHTML = '<div class="no-results">Error fetching products. Please try again.</div>';
                searchResults.classList.add('show');
            }
            return [];
        }
    }

    async function searchProducts(query) {
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            searchResults.classList.remove('show');
            return;
        }

        try {
            const products = await fetchProducts(normalizedQuery);
            displayResults(products);
        } catch (error) {
            console.error('Search error:', error);
        }
    }


    // Debounce search input to avoid spamming API
    let timeout;
    searchInput.addEventListener('input', function (e) {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchProducts(e.target.value), 300);
    });

    document.addEventListener('click', function (event) {
        if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.classList.remove('show');
        }
    });

    // Enhanced search functionality - redirect to search page on Enter
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                // Redirect to search page with query
                window.location.href = `/user/search?q=${encodeURIComponent(query)}`;
            }
        }
    });

    // Add "View All Results" option to dropdown
    function displayResults(results) {
        console.log('Search Results:', results.map(p => ({ id: p._id, name: p.name }))); // Debugging
        searchResults.innerHTML = '';
        
        if (results.length > 0) {
          results.forEach(product => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            
            const imageUrl = product.images?.[0] ? `/uploads/${product.images[0]}` : '/images/placeholder.jpg';
            const price = product.salesPrice?.toLocaleString('en-IN') || '0';
      
            item.innerHTML = `
              <a href="/user/product/${product._id}">
                <img src="${imageUrl}" alt="${product.name || 'Product'}">
                <div class="product-info">
                  <h4>${product.name || 'Unnamed Product'}</h4>
                  <p class="price">₹${price}</p>
                </div>
              </a>
            `;
            searchResults.appendChild(item);
          });
          
          // Add "View All Results" option
          const viewAllItem = document.createElement('div');
          viewAllItem.className = 'search-result-item view-all-results';
          viewAllItem.innerHTML = `
            <a href="/user/search?q=${encodeURIComponent(searchInput.value)}" style="text-align: center; font-weight: 600; color: #007bff;">
              <i class="fas fa-search" style="margin-right: 8px;"></i>
              View All Results for "${searchInput.value}"
            </a>
          `;
          searchResults.appendChild(viewAllItem);
          
          searchResults.classList.add('show');
        } else {
          searchResults.innerHTML = '<div class="no-results">No products found</div>';
          searchResults.classList.add('show');
        }
      }
});