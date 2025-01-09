function sortOrders() {
    const sortBy = document.getElementById('sort-orders').value;
    const orders = [...document.querySelectorAll('.order-card')];
    const ordersContainer = document.querySelector('.orders-section');
  
    orders.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.dataset.createdAt) - new Date(a.dataset.createdAt);
      }
      if (sortBy === 'oldest') {
        return new Date(a.dataset.createdAt) - new Date(b.dataset.createdAt);
      }
      if (sortBy === 'status') {
        return a.dataset.status.localeCompare(b.dataset.status);
      }
      if (sortBy === 'amount') {
        return parseFloat(b.dataset.amount) - parseFloat(a.dataset.amount);
      }
    });
  
    ordersContainer.innerHTML = '';
    orders.forEach(order => ordersContainer.appendChild(order));
  }
  