
    // Prevent checkout if all items are out of stock
    document.getElementById('checkout-form').addEventListener('submit', function (event) {
      const outOfStockItems = document.querySelectorAll('.out-of-stock').length;
      const totalItems = document.querySelectorAll('.cart-item').length;

      if (outOfStockItems === totalItems) {
        event.preventDefault(); // Prevent form submission
        Swal.fire({
          icon: 'error',
          title: 'Cannot Proceed',
          text: 'All items in your cart are out of stock. Please remove them or add available items.',
        });
      }
    });

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

      // Update the subtotal display
      document.querySelector('.subtotal span').textContent = `Subtotal: ₹${subtotal.toLocaleString('en-IN')}`;
    }

    // Call updateSubtotal on page load
    updateSubtotal();

    // Quantity controls and cart update logic (unchanged)
    document.querySelectorAll('.quantity-controls').forEach(control => {
      const decreaseBtn = control.querySelector('.decrease-btn');
      const increaseBtn = control.querySelector('.increase-btn');
      const quantityInput = control.querySelector('.quantity-input');
      const productId = control.closest('form').querySelector('input[name="productId"]').value;
      const stockQuantity = parseInt(control.closest('.cart-item').querySelector('.item-stock').textContent.match(/\d+/)[0], 10);
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

      decreaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10) || 1;
        const min = parseInt(quantityInput.min, 10) || 1;
        if (currentValue > min) {
          quantityInput.value = currentValue - 1;
          updateCart(productId, quantityInput.value);
          validateQuantity();
        }
      });

      increaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10) || 1;
        const max = Math.min(parseInt(quantityInput.max, 10) || 1, userMax);
        if (currentValue < max) {
          quantityInput.value = currentValue + 1;
          updateCart(productId, quantityInput.value);
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

      quantityInput.addEventListener('blur', () => {
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
        updateCart(productId, value);
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

      function updateCart(productId, quantity) {
        fetch('/cart/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity })
        })
          .then(response => response.json())
          .then(data => {
            if (data.error) {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.error,
              });
              quantityInput.value = data.currentQuantity || quantity;
            } else if (data.cart) {
              window.location.reload();
            }
          })
          .catch(error => console.error('Error updating cart:', error));
      }

      validateQuantity();
    });
