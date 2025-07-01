// sse.js
document.addEventListener('DOMContentLoaded', () => {
    // Connect to the SSE endpoint
    const eventSource = new EventSource('/sse');
  
    // Listen for messages from the server
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received SSE data:', data);
  
      // Update the UI with the received data
      const sseContainer = document.getElementById('sse-data');
      if (sseContainer) {
        sseContainer.innerHTML = `Update: ${data.message} at ${data.time}`;
      }
    };
  
    // Handle errors (optional)
    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close(); // Reconnect automatically
    };
  });