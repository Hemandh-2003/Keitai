function handleCheckoutSubmission(event) {
  // Get all cart items and initialize counters
  const cartItems = document.querySelectorAll('.cart-item');
  let outOfStockCount = 0;
  let totalItems = cartItems.length;
  
  // Comprehensive stock status check
  cartItems.forEach(item => {
    const stockElement = item.querySelector('.item-stock');
    if (!stockElement) return;
    
    // Check both class and text content for maximum reliability
    const isOutOfStock = stockElement.classList.contains('out-of-stock') || 
                        stockElement.textContent.includes('Out of Stock');
    
    if (isOutOfStock) {
      outOfStockCount++;
      // Debugging: Mark problematic items
      item.style.border = '2px dashed red';
    }
  });

  // Debug output
  console.log(`Cart check: ${totalItems} total items, ${outOfStockCount} out of stock`);

  // Block submission if any out-of-stock items
  if (outOfStockCount > 0) {
    event.preventDefault();
    
    // Prepare appropriate message
    let errorMessage;
    if (outOfStockCount === totalItems) {
      errorMessage = 'All items in your cart are out of stock. Please remove them or add available items.';
    } else {
      errorMessage = `You have ${outOfStockCount} out-of-stock item(s). Please remove them to continue.`;
    }

    // Show notification
    if (typeof Swal === 'undefined') {
      console.error('SweetAlert missing, falling back to alert');
      alert(errorMessage);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Cart Issue',
        html: `
          <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
            ${errorMessage}
          </div>
        `,
        confirmButtonText: 'View Cart',
        confirmButtonColor: '#d33',
        showCancelButton: true,
        cancelButtonText: 'Continue Shopping'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/cart';
        }
      });
    }
  }
}

// Safe event listener attachment
document.addEventListener('DOMContentLoaded', function() {
  const checkoutForm = document.getElementById('checkout-form');
  
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmission);
    console.log('Checkout form validation active');
  } else {
    console.warn('Checkout form not found - validation not active');
  }
});

// Function to check for out-of-stock items and update UI
function checkOutOfStockItems() {
  const outOfStockItems = document.querySelectorAll('.out-of-stock').length;
  const proceedButton = document.querySelector('.proceed-button');
  
  if (outOfStockItems > 0) {
    proceedButton.disabled = true;
    proceedButton.classList.add('disabled-btn');
  } else {
    proceedButton.disabled = false;
    proceedButton.classList.remove('disabled-btn');
  }
}

// Update subtotal to exclude out-of-stock items
function updateSubtotal() {
  let subtotal = 0;
  document.querySelectorAll('.cart-item').forEach(item => {
    const stockStatus = item.querySelector('.item-stock').textContent;
    if (!stockStatus.includes('Out of Stock')) {
      const priceElement = item.querySelector('.item-discount') || item.querySelector('.item-price');
      const price = parseFloat(priceElement.textContent.replace('₹', '').replace(/,/g, ''));
      const quantity = parseInt(item.querySelector('.quantity-input').value, 10);
      subtotal += price * quantity;
    }
  });

  document.querySelector('.subtotal span').textContent = `Subtotal: ₹${subtotal.toLocaleString('en-IN')}`;
  checkOutOfStockItems(); // Update button state when subtotal changes
}

// Improved updateCart function
async function updateCart(productId, quantity) {
  try {
    const response = await fetch('/cart/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    
    const data = await response.json();
    
    if (data.error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.error,
      });
      return data.currentQuantity;
    }
    
    updateSubtotal();
    return null;
    
  } catch (error) {
    console.error('Error updating cart:', error);
    Swal.fire({
      icon: 'error',
      title: 'Network Error',
      text: 'Failed to update cart. Please try again.',
    });
    return null;
  }
}

// Function to handle item removal
async function removeItem(productId) {
  try {
    const response = await fetch('/cart/remove', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ productId })
    });
    
    if (response.ok) {
      const itemElement = document.querySelector(`form[data-product-id="${productId}"]`).closest('.cart-item');
      itemElement.remove();
      
      updateSubtotal();
      
      if (document.querySelectorAll('.cart-item').length === 0) {
        document.querySelector('.cart-items').innerHTML = '<p class="empty-cart">Your cart is empty</p>';
      }
      
      Swal.fire({
        icon: 'success',
        title: 'Item removed',
        text: 'The item has been removed from your cart',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      const data = await response.json();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.error || 'Failed to remove item',
      });
    }
  } catch (error) {
    console.error('Error removing item:', error);
    Swal.fire({
      icon: 'error',
      title: 'Network Error',
      text: 'Failed to remove item. Please try again.',
    });
  }
}

// Function to handle Buy Now
function buyNow(productId, quantity) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/user/checkout';
  
  const productIdInput = document.createElement('input');
  productIdInput.type = 'hidden';
  productIdInput.name = 'productIds[]';
  productIdInput.value = productId;
  form.appendChild(productIdInput);
  
  const quantityInput = document.createElement('input');
  quantityInput.type = 'hidden';
  quantityInput.name = 'quantities[]';
  quantityInput.value = quantity;
  form.appendChild(quantityInput);
  
  document.body.appendChild(form);
  form.submit();
}

// Quantity controls logic
document.querySelectorAll('.quantity-controls').forEach(control => {
  const decreaseBtn = control.querySelector('.decrease-btn');
  const increaseBtn = control.querySelector('.increase-btn');
  const quantityInput = control.querySelector('.quantity-input');
  const productId = control.closest('form').querySelector('input[name="productId"]').value;
  const stockElement = control.closest('.cart-item').querySelector('.item-stock');
  const stockMatch = stockElement.textContent.match(/\d+/);
  const stockQuantity = stockMatch ? parseInt(stockMatch[0], 10) : 0;
  const buyNowBtn = control.closest('.item-actions').querySelector('.buy-btn');
  const userMax = 5;

  function validateQuantity() {
    let currentQuantity = parseInt(quantityInput.value, 10) || 1;
    if (currentQuantity > stockQuantity || currentQuantity > userMax) {
      buyNowBtn.disabled = true;
      Swal.fire({
        icon: 'warning',
        title: 'Quantity Limit Exceeded',
        text: `You can only add up to ${Math.min(stockQuantity, userMax)} units of this item.`,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } else {
      buyNowBtn.disabled = false;
    }
  }

  decreaseBtn.addEventListener('click', async () => {
    let currentValue = parseInt(quantityInput.value, 10) || 1;
    const min = parseInt(quantityInput.min, 10) || 1;
    if (currentValue > min) {
      quantityInput.value = currentValue - 1;
      const currentQuantity = await updateCart(productId, quantityInput.value);
      if (currentQuantity) {
        quantityInput.value = currentQuantity;
      }
      validateQuantity();
    }
  });

  increaseBtn.addEventListener('click', async () => {
    let currentValue = parseInt(quantityInput.value, 10) || 1;
    const max = Math.min(parseInt(quantityInput.max, 10) || 1, userMax);
    if (currentValue < max) {
      quantityInput.value = currentValue + 1;
      const currentQuantity = await updateCart(productId, quantityInput.value);
      if (currentQuantity) {
        quantityInput.value = currentQuantity;
      }
      validateQuantity();
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Quantity Limit Reached',
        text: `You can only add up to ${userMax} units of this item.`,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
  });

  quantityInput.addEventListener('blur', async () => {
    let value = parseInt(quantityInput.value, 10);
    const max = Math.min(parseInt(quantityInput.max, 10) || 1, userMax);
    if (isNaN(value) || value < 1) {
      value = 1;
    } else if (value > max) {
      value = max;
      Swal.fire({
        icon: 'warning',
        title: 'Quantity Limit Reached',
        text: `You can only add up to ${userMax} units of this item.`,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
    quantityInput.value = value;
    const currentQuantity = await updateCart(productId, value);
    if (currentQuantity) {
      quantityInput.value = currentQuantity;
    }
    validateQuantity();
  });

  quantityInput.addEventListener('input', () => {
    let currentQuantity = parseInt(quantityInput.value, 10) || 1;
    if (currentQuantity > stockQuantity || currentQuantity > userMax) {
      buyNowBtn.disabled = true;
      Swal.fire({
        icon: 'warning',
        title: 'Quantity Limit Exceeded',
        text: `You can only add up to ${Math.min(stockQuantity, userMax)} units of this item.`,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } else {
      buyNowBtn.disabled = false;
    }
  });

  validateQuantity();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  updateSubtotal();
  checkOutOfStockItems();
});

async function clearCart() {
  try {
    const response = await fetch('/cart/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update UI
      document.querySelector('.cart-items').innerHTML = `
        <div class="empty-cart-message">
          <i class="fas fa-check-circle success-icon"></i>
          <p>Your order has been placed successfully!</p>
          <p>Your cart is now empty.</p>
        </div>
      `;
      
      // Update subtotal
      document.querySelector('.subtotal span').textContent = 'Subtotal: ₹0';
      
      // Disable checkout button
      document.querySelector('.proceed-button').disabled = true;
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Notice',
        text: 'Order completed but cart could not be cleared',
        timer: 3000
      });
    }
  } catch (error) {
    console.error('Error clearing cart:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to clear cart after order'
    });
  }
}