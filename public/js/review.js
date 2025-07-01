
// Star rating functionality
document.querySelectorAll('.stars i').forEach(star => {
    star.addEventListener('click', function() {
        const rating = parseInt(this.getAttribute('data-rating'));
        document.getElementById('rating-value').value = rating;
        
        // Update star display
        document.querySelectorAll('.stars i').forEach((s, index) => {
            if (index < rating) {
                s.classList.remove('far');
                s.classList.add('fas');
            } else {
                s.classList.remove('fas');
                s.classList.add('far');
            }
        });
    });
});

// Image preview functionality
document.getElementById('review-images').addEventListener('change', function(e) {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    
    for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        if (file.type.match('image.*')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            }
            
            reader.readAsDataURL(file);
        }
    }
});

// Review form submission
document.getElementById('review-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    
    try {
        const response = await fetch('/reviews', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Review Submitted!',
                text: 'Thank you for your review. It will be visible after approval.',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false
            }).then(() => {
                window.location.reload();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: result.error || 'Failed to submit review. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong. Please try again.'
        });
    }
});
