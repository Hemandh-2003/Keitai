function changeImage(thumbnail) {
    document.getElementById("main-product-image").src = thumbnail.src;
}

async function addToCart() {
    const form = document.getElementById('add-to-cart-form');
    const productId = form.querySelector('input[name="productId"]').value;
    const quantity = form.querySelector('input[name="quantity"]').value;

    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId, quantity }),
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Added to Cart',
                text: `Quantity updated to ${quantity}.`,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
            });

            // Dynamically update cart total here
            const cartTotal = document.getElementById('cart-total');
            if (cartTotal && result.newTotal) {
                cartTotal.textContent = `₹${result.newTotal}`;
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: result.error || 'Failed to add the item to your cart.',
                showConfirmButton: true,
            });
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            showConfirmButton: true,
        });
    }
}

document.getElementById('add-to-cart-btn').addEventListener('click', async () => {
    const form = document.getElementById('action-form');
    const productId = form.querySelector('input[name="productId"]').value;
    const quantity = form.querySelector('input[name="quantity"]').value;

    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId, quantity }),
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Added to Cart',
                text: `Quantity updated to ${quantity}.`,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
            });

            // Update cart total dynamically
            const cartTotal = document.getElementById('cart-total');
            if (cartTotal && result.newTotal) {
                cartTotal.textContent = `₹${result.newTotal}`;
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: result.error || 'Failed to add the item to your cart.',
                showConfirmButton: true,
            });
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.',
            showConfirmButton: true,
        });
    }
});

function validateQuantity(input) {
    const min = parseInt(input.min, 10);
    const max = 5; // Limit to 5
    const availableStock = '<%= product.quantity %>'; // Inject stock dynamically
    const value = input.value;

    if (value === "") {
        return; // Allow empty temporarily
    }

    const numericValue = parseInt(value, 10);

    if (isNaN(numericValue)) {
        input.value = min; // Reset to minimum if value is not a number
    } else if (numericValue < min) {
        input.value = min; // Enforce minimum value
    } else if (numericValue > Math.min(availableStock, max)) {
        input.value = Math.min(availableStock, max); // Enforce the smaller limit (stock or 5)
        Swal.fire({
            icon: 'warning',
            title: 'Limit Exceeded',
            text: `You can only purchase up to ${Math.min(availableStock, max)} units.`,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
        });
    }

    toggleButtons(input, availableStock, max);
}

function toggleButtons(input, availableStock, max) {
    const quantity = parseInt(input.value, 10);
    const decreaseBtn = document.getElementById('decrease-qty');
    const increaseBtn = document.getElementById('increase-qty');

    // Disable the Increase button if quantity > 5
    increaseBtn.disabled = quantity >= max;

    // Enable the Increase button if quantity < 5
    if (quantity < max) {
        increaseBtn.disabled = false;
    }

    // Keep the Decrease button always enabled
    decreaseBtn.disabled = false;
}

// Event listeners for quantity buttons
document.getElementById('decrease-qty').addEventListener('click', () => {
    const quantityInput = document.getElementById('quantity');
    const currentValue = parseInt(quantityInput.value, 10);

    if (currentValue > 1) {
        quantityInput.value = currentValue - 1;
        validateQuantity(quantityInput);
    }
});

document.getElementById('increase-qty').addEventListener('click', () => {
    const quantityInput = document.getElementById('quantity');
    const currentValue = parseInt(quantityInput.value, 10);
    const max = 5; // Limit to 5
    const availableStock = '<%= product.quantity %>'; // Inject stock dynamically

    if (currentValue < Math.min(availableStock, max)) {
        quantityInput.value = currentValue + 1;
        validateQuantity(quantityInput);
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Limit Reached',
            text: `You can only purchase up to ${Math.min(availableStock, max)} units.`,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
        });
    }
});

// Input validation on typing
document.getElementById('quantity').addEventListener('input', (event) => {
    validateQuantity(event.target);
});

// Initial button state on page load
document.addEventListener('DOMContentLoaded', () => {
    const quantityInput = document.getElementById('quantity');
    const max = 5; // Limit to 5
    const availableStock =' <%= product.quantity %>'; // Inject stock dynamically

    toggleButtons(quantityInput, availableStock, max);
});



// Input validation
function validateQuantity(input) {
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);
    const availableStock = "<%= product.quantity %>"; // Inject stock dynamically
    const value = input.value;
    const increaseBtn = document.getElementById('increase-qty');

    if (value === "") {
        return; // Allow empty temporarily
    }

    const numericValue = parseInt(value, 10);

    // Check if the input is not a number
    if (isNaN(numericValue)) {
        input.value = min; // Reset to minimum if value is not a number
    }
    // Check if the value is less than the minimum
    else if (numericValue < min) {
        input.value = min; // Enforce minimum value
    }
    // Check if the value exceeds available stock or maximum limit
    else if (numericValue > availableStock || numericValue > 5) {
        input.value = Math.min(availableStock, 5); // Set to the smaller limit
        Swal.fire({
            icon: 'warning',
            title: 'Limit Exceeded',
            text: `You can only purchase up to ${Math.min(availableStock, 5)} units.`,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
        });
        increaseBtn.disabled = true; // Disable the Increase button
    } else {
        increaseBtn.disabled = false; // Re-enable the Increase button
    }
}

function changeImage(thumbnail) {
    document.getElementById("main-product-image").src = thumbnail.src;
    document.querySelectorAll('.thumbnails img').forEach(img => img.classList.remove('active'));
    thumbnail.classList.add('active');
}
