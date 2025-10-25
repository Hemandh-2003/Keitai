document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let abortController = new AbortController();
    let currentPage = 1;
    let currentSort = 'relevance';
    let currentFilters = {};
    let allResults = [];
    let totalResults = 0;

    async function fetchProducts(query = '', page = 1, sort = 'relevance', filters = {}) {
        try {
            abortController.abort();
            abortController = new AbortController();

            const params = new URLSearchParams({
                query: query,
                page: page,
                sort: sort,
                ...filters
            });

            const response = await fetch(`/user/api/search?${params}`, {
                signal: abortController.signal
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching products:', error);
                searchResults.innerHTML = '<div class="no-results">Error fetching products. Please try again.</div>';
                searchResults.classList.add('show');
            }
            return { products: [], total: 0, pagination: {} };
        }
    }

    async function searchProducts(query) {
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            searchResults.classList.remove('show');
            return;
        }

        try {
            const data = await fetchProducts(normalizedQuery, 1, currentSort, currentFilters);
            allResults = data.products || [];
            totalResults = data.total || 0;
            currentPage = 1;
            displayResults(allResults, totalResults, normalizedQuery);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    function displayResults(results, total, query) {
        searchResults.innerHTML = '';
        
        if (results.length > 0) {
            // Add search header with results count
            const header = document.createElement('div');
            header.className = 'search-header';
            header.innerHTML = `
                <div class="search-header-content">
                    <h4>Search Results</h4>
                    <span class="results-count">${total} results for "${query}"</span>
                </div>
            `;
            searchResults.appendChild(header);

            // Add sorting options
            const sortContainer = document.createElement('div');
            sortContainer.className = 'search-sort';
            sortContainer.innerHTML = `
                <label>Sort by:</label>
                <select id="search-sort-select">
                    <option value="relevance" ${currentSort === 'relevance' ? 'selected' : ''}>Relevance</option>
                    <option value="price-asc" ${currentSort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
                    <option value="price-desc" ${currentSort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
                    <option value="name-asc" ${currentSort === 'name-asc' ? 'selected' : ''}>Name: A to Z</option>
                    <option value="name-desc" ${currentSort === 'name-desc' ? 'selected' : ''}>Name: Z to A</option>
                </select>
            `;
            searchResults.appendChild(sortContainer);

            // Add filter options
            const filterContainer = document.createElement('div');
            filterContainer.className = 'search-filters';
            filterContainer.innerHTML = `
                <div class="filter-row">
                    <label>Brand:</label>
                    <select id="search-brand-filter">
                        <option value="">All Brands</option>
                        <option value="Apple" ${currentFilters.brand === 'Apple' ? 'selected' : ''}>Apple</option>
                        <option value="Samsung" ${currentFilters.brand === 'Samsung' ? 'selected' : ''}>Samsung</option>
                        <option value="Dell" ${currentFilters.brand === 'Dell' ? 'selected' : ''}>Dell</option>
                        <option value="HP" ${currentFilters.brand === 'HP' ? 'selected' : ''}>HP</option>
                    </select>
                </div>
                <div class="filter-row">
                    <label>Price:</label>
                    <select id="search-price-filter">
                        <option value="">All Prices</option>
                        <option value="below-50000" ${currentFilters.price === 'below-50000' ? 'selected' : ''}>Below ₹50,000</option>
                        <option value="50000-100000" ${currentFilters.price === '50000-100000' ? 'selected' : ''}>₹50,000 - ₹1,00,000</option>
                        <option value="above-100000" ${currentFilters.price === 'above-100000' ? 'selected' : ''}>Above ₹1,00,000</option>
                    </select>
                </div>
            `;
            searchResults.appendChild(filterContainer);

            // Add results
            results.forEach(product => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                
                const imageUrl = product.images?.[0] ? `/uploads/${product.images[0]}` : '/images/placeholder.jpg';
                const price = product.salesPrice?.toLocaleString('en-IN') || '0';
                const originalPrice = product.regularPrice?.toLocaleString('en-IN') || '';
                const discount = product.salesPrice && product.regularPrice ? 
                    Math.round((product.regularPrice - product.salesPrice) / product.regularPrice * 100) : 0;
        
                item.innerHTML = `
                    <a href="/user/product/${product._id}">
                        <img src="${imageUrl}" alt="${product.name || 'Product'}">
                        <div class="product-info">
                            <h4>${product.name || 'Unnamed Product'}</h4>
                            <p class="brand">${product.brand || ''}</p>
                            <div class="price-info">
                                <span class="current-price">₹${price}</span>
                                ${originalPrice && discount > 0 ? `
                                    <span class="original-price">₹${originalPrice}</span>
                                    <span class="discount">${discount}% OFF</span>
                                ` : ''}
                            </div>
                        </div>
                    </a>
                `;
                searchResults.appendChild(item);
            });

            // Add pagination if there are more results
            if (total > 10) {
                const pagination = document.createElement('div');
                pagination.className = 'search-pagination';
                const totalPages = Math.ceil(total / 10);
                let paginationHTML = '<div class="pagination-controls">';
                
                if (currentPage > 1) {
                    paginationHTML += `<button onclick="loadPage(${currentPage - 1})" class="page-btn">‹ Previous</button>`;
                }
                
                paginationHTML += `<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;
                
                if (currentPage < totalPages) {
                    paginationHTML += `<button onclick="loadPage(${currentPage + 1})" class="page-btn">Next ›</button>`;
                }
                
                paginationHTML += '</div>';
                pagination.innerHTML = paginationHTML;
                searchResults.appendChild(pagination);
            }
          
            searchResults.classList.add('show');
        } else {
            searchResults.innerHTML = '<div class="no-results">No products found</div>';
            searchResults.classList.add('show');
        }
    }

    // Debounce search input
    let timeout;
    searchInput.addEventListener('input', function (e) {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchProducts(e.target.value), 300);
    });

    // Handle sort change
    document.addEventListener('change', function(e) {
        if (e.target.id === 'search-sort-select') {
            currentSort = e.target.value;
            searchProducts(searchInput.value);
        }
    });

    // Handle filter changes
    document.addEventListener('change', function(e) {
        if (e.target.id === 'search-brand-filter' || e.target.id === 'search-price-filter') {
            if (e.target.id === 'search-brand-filter') {
                currentFilters.brand = e.target.value;
            } else if (e.target.id === 'search-price-filter') {
                currentFilters.price = e.target.value;
            }
            searchProducts(searchInput.value);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.classList.remove('show');
        }
    });

    // Global function for pagination
    window.loadPage = function(page) {
        currentPage = page;
        searchProducts(searchInput.value);
    };
});