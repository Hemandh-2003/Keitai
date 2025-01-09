// Function to preview the image
function previewImage(input, index) {
    const file = input.files[0];
    const preview = document.getElementById('preview' + index);
    const deleteBtn = document.querySelector(`#image-box-${index} .delete-image-btn`);
    const cropBtn = document.querySelector(`#image-box-${index} .crop-image-btn`);
    const previewBox = document.getElementById('preview-box-' + index);
  
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        previewBox.style.display = 'block'; // Show the preview box
        deleteBtn.style.display = 'inline-block';
        cropBtn.style.display = 'inline-block';
  
        // Initialize Cropper.js when image is loaded
        const cropper = new Cropper(preview, {
          aspectRatio: 16 / 9,
          viewMode: 1,
          autoCropArea: 0.5,
          scalable: true,
          zoomable: true,
          ready() {
            console.log('Cropper is ready!');
          }
        });
  
        // Store cropper instance in each image box for later use
        window['cropper' + index] = cropper;
      };
      reader.readAsDataURL(file);
    }
  }
  
  // Function to delete the image
  function deleteImage(index) {
    const preview = document.getElementById('preview' + index);
    const input = document.getElementById('image' + index);
    const deleteBtn = document.querySelector(`#image-box-${index} .delete-image-btn`);
    const cropBtn = document.querySelector(`#image-box-${index} .crop-image-btn`);
    const previewBox = document.getElementById('preview-box-' + index);
  
    input.value = ""; // Reset file input
    preview.style.display = 'none'; // Hide preview
    previewBox.style.display = 'none'; // Hide preview box
    deleteBtn.style.display = 'none'; // Hide delete button
    cropBtn.style.display = 'none'; // Hide crop button
  
    // Destroy cropper instance when image is deleted
    if (window['cropper' + index]) {
      window['cropper' + index].destroy();
      delete window['cropper' + index];
    }
  }
  
  // Function to crop the image and get the cropped data
  function cropImage(index) {
    const cropper = window['cropper' + index];
    const croppedCanvas = cropper.getCroppedCanvas();
  
    // Convert the cropped image to base64 and display or save it
    croppedCanvas.toBlob(function (blob) {
      const reader = new FileReader();
      reader.onloadend = function () {
        const croppedImageData = reader.result;
        // Set the cropped image data to a hidden input field for form submission
        const hiddenInput = document.getElementById('croppedImage' + index);
        hiddenInput.value = croppedImageData; // Save cropped image data in hidden input field
  
        // Optionally, update preview with cropped image (already updated above)
        const preview = document.getElementById('preview' + index);
        preview.src = croppedImageData; // Update preview with cropped image
  
        console.log(croppedImageData);
      };
      reader.readAsDataURL(blob);
    });
  }
  