
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



document.getElementById('user-icon').addEventListener('click', () => {
  fetch('/auth/status')
    .then(response => response.json())
    .then(data => {
      if (data.isLoggedIn) {
        window.location.href = '/user/user-profile'; // Redirect to user profile
      } else {
        window.location.href = '/user/login'; // Redirect to login
      }
    })
    .catch(err => console.error('Error checking login status:', err));
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
      iconElement.style.color = iconElement.style.color === 'red' ? 'grey' : 'red';
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
      text: 'You Forgot to login',
    });
  }
}

document.getElementById('language-selector').addEventListener('change', function() {
  const selectedLanguage = this.value;
  loadLanguage(selectedLanguage);
});

function loadLanguage(lang) {
  fetch(`/js/${lang}.json`)
    .then(response => response.json())
    .then(data => {
      translatePage(data);
      localStorage.setItem('preferredLanguage', lang); // Store preference
    })
    .catch(error => console.error('Error loading language file:', error));
}

function translatePage(translations) {
  document.querySelectorAll('[data-translate]').forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[key]) {
      element.textContent = translations[key];
    }
  });
}

// Load default language on page load
document.addEventListener('DOMContentLoaded', () => {
  const preferredLanguage = localStorage.getItem('preferredLanguage') || 'en';
  document.getElementById('language-selector').value = preferredLanguage;
  loadLanguage(preferredLanguage);
});
// Mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.querySelector('.nav-links');

  mobileMenuToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  // Close menu when clicking on a link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenuToggle.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });

  // Filter toggle functionality
  const filterToggle = document.getElementById('filter-toggle-btn');
  const filterSidebar = document.getElementById('filter-sidebar');

  if (filterToggle && filterSidebar) {
    filterToggle.addEventListener('click', function() {
      filterSidebar.classList.toggle('visible');
    });
  }
});