function validateQuantity(input) {
    const value = parseInt(input.value, 10);
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);

    if (value < min) {
        input.value = min; // Reset to the minimum value if below range
    } else if (value > max) {
        input.value = max; // Reset to the maximum value if above range
    } else if (isNaN(value)) {
        input.value = min; // Reset to minimum if input is invalid
    }
}
