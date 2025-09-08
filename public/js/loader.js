
  document.addEventListener("DOMContentLoaded", function() {
    const loader = document.getElementById("loader");

    document.querySelectorAll("form").forEach(form => {
      form.addEventListener("submit", function() {
        loader.style.display = "block";
      });
    });
    window.addEventListener("load", function() {
      loader.style.display = "none";
    });
  });