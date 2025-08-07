function handleCheckoutSubmission(event) {
  const cartItems = document.querySelectorAll('.cart-item');
  let outOfStockCount = 0;

  cartItems.forEach(item => {
    const stockElement = item.querySelector('.item-stock');
    if (!stockElement) return;
    const isOutOfStock = stockElement.classList.contains('out-of-stock') || stockElement.textContent.includes('Out of Stock');
    if (isOutOfStock) {
      outOfStockCount++;
      item.style.border = '2px dashed red';
    }
  });

  if (outOfStockCount > 0) {
    event.preventDefault();

    const errorMessage = outOfStockCount === cartItems.length
      ? 'All items in your cart are out of stock. Please remove them or add available items.'
      : `You have ${outOfStockCount} out-of-stock item(s). Please remove them to continue.`;

    if (typeof Swal === 'undefined') {
      alert(errorMessage);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Cart Issue',
        html: `<div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">${errorMessage}</div>`,
        confirmButtonText: 'View Cart',
        confirmButtonColor: '#d33',
        showCancelButton: true,
        cancelButtonText: 'Continue Shopping'
      }).then(result => {
        if (result.isConfirmed) window.location.href = '/cart';
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) checkoutForm.addEventListener('submit', handleCheckoutSubmission);
  updateSubtotal();
  checkOutOfStockItems();
});

function checkOutOfStockItems() {
  const outOfStockItems = document.querySelectorAll('.out-of-stock').length;
  const proceedButton = document.querySelector('.proceed-button');
  if (proceedButton) {
    proceedButton.disabled = outOfStockItems > 0;
    proceedButton.classList.toggle('disabled-btn', outOfStockItems > 0);
  }
}

function updateSubtotal() {
  let subtotal = 0;
  document.querySelectorAll('.cart-item').forEach(item => {
    const stockStatus = item.querySelector('.item-stock')?.textContent || '';
    if (!stockStatus.includes('Out of Stock')) {
      const priceElement = item.querySelector('.item-discount') || item.querySelector('.item-price');
      const price = parseFloat(priceElement.textContent.replace('₹', '').replace(/,/g, ''));
      const quantity = parseInt(item.querySelector('.quantity-input').value, 10);
      subtotal += price * quantity;
    }
  });

  const subtotalElem = document.querySelector('.subtotal span') || document.querySelector('.summary-subtotal strong');
  if (subtotalElem) subtotalElem.textContent = `Subtotal: ₹${subtotal.toLocaleString('en-IN')}`;
  checkOutOfStockItems();
}

async function updateCart(productId, quantity) {
  try {
    const response = await fetch('/cart/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });

    const data = await response.json();

    if (data.error) {
      Swal.fire({ icon: 'error', title: 'Error', text: data.error });
      return data.currentQuantity;
    }

    updateSubtotal();
    return null;

  } catch (error) {
    console.error('Error updating cart:', error);
    Swal.fire({ icon: 'error', title: 'Network Error', text: 'Failed to update cart. Please try again.' });
    return null;
  }
}

async function removeItem(productId) {
  try {
    const response = await fetch('/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ productId })
    });

    if (response.ok) {
      const itemElement = document.querySelector(`form[data-product-id="${productId}"]`)?.closest('.cart-item');
      if (itemElement) itemElement.remove();
      updateSubtotal();

      if (!document.querySelectorAll('.cart-item').length) {
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
      Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Failed to remove item' });
    }
  } catch (error) {
    console.error('Error removing item:', error);
    Swal.fire({ icon: 'error', title: 'Network Error', text: 'Failed to remove item. Please try again.' });
  }
}

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

// Quantity Button Logic
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
    if (currentValue > 1) {
      quantityInput.value = currentValue - 1;
      const currentQuantity = await updateCart(productId, quantityInput.value);
      if (currentQuantity) quantityInput.value = currentQuantity;
      validateQuantity();
    }
  });

  increaseBtn.addEventListener('click', async () => {
    let currentValue = parseInt(quantityInput.value, 10) || 1;
    const max = Math.min(stockQuantity, userMax);
    if (currentValue < max) {
      quantityInput.value = currentValue + 1;
      const currentQuantity = await updateCart(productId, quantityInput.value);
      if (currentQuantity) quantityInput.value = currentQuantity;
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
    const max = Math.min(stockQuantity, userMax);
    if (isNaN(value) || value < 1) value = 1;
    else if (value > max) {
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
    if (currentQuantity) quantityInput.value = currentQuantity;
    validateQuantity();
  });

  quantityInput.addEventListener('input', () => {
    const currentQuantity = parseInt(quantityInput.value, 10) || 1;
    if (currentQuantity > stockQuantity || currentQuantity > userMax) {
      buyNowBtn.disabled = true;
    } else {
      buyNowBtn.disabled = false;
    }
  });

  validateQuantity();
});

// Optional: Clear cart after successful order (if using)
async function clearCart() {
  try {
    const response = await fetch('/cart/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    });

    const result = await response.json();

    if (result.success) {
      document.querySelector('.cart-items').innerHTML = `
        <div class="empty-cart-message">
          <i class="fas fa-check-circle success-icon"></i>
          <p>Your order has been placed successfully!</p>
          <p>Your cart is now empty.</p>
        </div>`;
      document.querySelector('.subtotal span').textContent = 'Subtotal: ₹0';
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
    Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to clear cart after order' });
  }
}

// ✅ GLOBAL EXPORT FOR EJS BUTTONS
window.updateCart = updateCart;
window.removeItem = removeItem;
window.buyNow = buyNow;
