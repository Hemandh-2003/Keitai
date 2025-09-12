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

  if (!email || !password || !confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'Validation Error',
      text: 'All fields are required.',
      confirmButtonText: 'OK',
    });
    return false;
  }

  if (password !== confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'Password Mismatch',
      text: 'Passwords do not match.',
      confirmButtonText: 'OK',
    });
    return false;
  }

  const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

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

// Validation
function validateSignupForm(){
  const name = document.getElementById(name).value.trim();
  const email = document.getElementById(email).value.trim();
  const password = document.getElementById(password).value.trim();
  const confirm = document.getElementById(confirm).value.trim();

  const nameRegex = /^[A-Za-z0-9]+$/;

  if(!name || !email || !password || !confirm){
    swal.fire('error', 'All fields are required,', 'error');
    return false;
  }

  if(!nameRegextest(name)){
    swal.fire('error', 'Name can only contain letters and numbers.','error');
    return false;
  }
  return true;
}