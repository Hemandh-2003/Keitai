// Wishlist toggle functionality
document.getElementById('wishlist-btn')?.addEventListener('click', async function(event) {
  event.preventDefault();
  const productId = this.getAttribute('data-product-id');
  const heartIcon = this.querySelector('i.fas.fa-heart');
  
  try {
    const response = await fetch('/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result.isInWishlist) {
        heartIcon.classList.remove('text-secondary');
        heartIcon.classList.add('text-danger');
        this.innerHTML = `<i class="fas fa-heart text-danger"></i> Remove from Wishlist`;
        Swal.fire({
          icon: 'success',
          title: 'Added to Wishlist!',
          text: 'This product has been added to your wishlist.',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        heartIcon.classList.remove('text-danger');
        heartIcon.classList.add('text-secondary');
        this.innerHTML = `<i class="fas fa-heart text-secondary"></i> Add to Wishlist`;
        Swal.fire({
          icon: 'success',
          title: 'Removed from Wishlist!',
          text: 'This product has been removed from your wishlist.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Something went wrong. Please try again.',
    });
  }
});

// Add to Cart functionality
document.querySelectorAll('.add-to-cart-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const productId = button.getAttribute('data-product-id');
    try {
      const response = await axios.post('/cart/add', {
        productId: productId,
        quantity: 1,
      });

      if (response.data.message) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: response.data.message,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: error.response?.data?.error || 'Failed to add item to cart',
      });
    }
  });
});

// Remove from Wishlist functionality
document.querySelectorAll('.delete-btn').forEach(button => {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    const form = button.closest('form');
    const action = form.getAttribute('action');
    const method = form.querySelector('input[name="_method"]').value;

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url: action,
      });

      if (response.data.message) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: response.data.message,
        });

        const wishlistItem = button.closest('.wishlist-item');
        wishlistItem.remove();

        if (document.querySelectorAll('.wishlist-item').length === 0) {
          document.querySelector('.wishlist-items').innerHTML = `
            <p class="empty-wishlist">Your wishlist is empty</p>
          `;
        }
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: error.response?.data?.error || 'Failed to remove item from wishlist',
      });
    }
  });
});