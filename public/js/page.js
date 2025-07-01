function clearFilters() {
    const currentUrl = window.location.pathname; // Retain the current category slug
    window.location.href = currentUrl; // Reload without query parameters
}
// Get filter elements
const filterSidebar = document.getElementById('filter-sidebar');
const filterToggleButton = document.getElementById('filter-toggle-btn');

// Toggle the filter sidebar
filterToggleButton.addEventListener('click', () => {
    const isVisible = filterSidebar.style.display === 'block';
    filterSidebar.style.display = isVisible ? 'none' : 'block';
});

// Close filter sidebar if clicked outside
document.addEventListener('click', (event) => {
    if (!filterSidebar.contains(event.target) && !filterToggleButton.contains(event.target)) {
        filterSidebar.style.display = 'none';
    }
});
async function addToWishlist(productId, iconElement, event) {
    // Stop event propagation to prevent parent <a> click
    event.stopPropagation();
    event.preventDefault(); // Prevent default behavior of the button

    try {
        const response = await fetch('/wishlist/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId }),
        });

        const data = await response.json();

        if (response.ok) {
            // Toggle the heart color to indicate it's added to wishlist
            const heartIcon = iconElement.querySelector('i');
            heartIcon.classList.toggle('active');
            Swal.fire({
                icon: 'success',
                title: 'Wishlist Updated',
                text: data.message,
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message,
            });
        }
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong!',
        });
    }
}