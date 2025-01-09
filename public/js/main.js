// Toggle mobile navigation
const toggleNav = () => {
    const nav = document.querySelector('.nav-links');
    nav.classList.toggle('active');
  };
  
  document.querySelector('.menu-toggle').addEventListener('click', toggleNav);
  
  // Confirm deletion (used in admin panel)
  const confirmDeletion = (event) => {
    const confirmed = confirm('Are you sure you want to delete this item?');
    if (!confirmed) {
      event.preventDefault();
    }
  };
  
  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', confirmDeletion);
  });
  