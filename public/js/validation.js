// Include SweetAlert library in your HTML file if not already included

// Function to validate login form
function validateLoginForm() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    Swal.fire({
      icon: 'error',
      title: 'Validation Error',
      text: 'Both fields are required.',
      confirmButtonText: 'OK',
    });
    return false;
  }
  return true;
}

// Function to validate signup form
function validateSignupForm() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm').value;

  // Check if any field is empty
  if (!email || !password || !confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'Validation Error',
      text: 'All fields are required.',
      confirmButtonText: 'OK',
    });
    return false;
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'Password Mismatch',
      text: 'Passwords do not match.',
      confirmButtonText: 'OK',
    });
    return false;
  }

  // Password validation pattern
  const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  // Validate password against the pattern
  if (!passwordPattern.test(password)) {
    Swal.fire({
      icon: 'error',
      title: 'Weak Password',
      text: 'Password must be at least 8 characters long, include at least one number, one uppercase letter, one lowercase letter, and one special character.',
      confirmButtonText: 'OK',
    });
    return false;
  }

  return true;
}
