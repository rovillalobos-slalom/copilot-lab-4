document.addEventListener("DOMContentLoaded", () => {
  const capabilitiesList = document.getElementById("capabilities-list");
  const capabilitySelect = document.getElementById("capability");
  const registerForm = document.getElementById("register-form");
  const messageDiv = document.getElementById("message");
  
  // Authentication elements
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginModal = document.getElementById("loginModal");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const userInfo = document.getElementById("userInfo");
  const userEmail = document.getElementById("userEmail");
  const userRole = document.getElementById("userRole");
  const closeModal = document.querySelector(".close");

  // Authentication state
  let authToken = localStorage.getItem("authToken");
  let currentUser = null;

  // Initialize auth state
  if (authToken) {
    loadUserInfo();
  }

  // Login modal handlers
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    loginModal.classList.add("show");
  });

  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginModal.classList.remove("show");
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginModal.classList.remove("show");
    }
  });

  // Login form handler
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok) {
        authToken = result.access_token;
        localStorage.setItem("authToken", authToken);
        currentUser = {
          email: result.email,
          role: result.role,
        };
        
        updateAuthUI();
        loginModal.classList.add("hidden");
        loginModal.classList.remove("show");
        loginForm.reset();
        
        // Refresh capabilities to show delete buttons if user has permission
        fetchCapabilities();
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Logout handler
  logoutBtn.addEventListener("click", () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    updateAuthUI();
    fetchCapabilities();
  });

  // Load user info from token
  async function loadUserInfo() {
    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        currentUser = await response.json();
        updateAuthUI();
      } else {
        // Token is invalid, clear it
        authToken = null;
        currentUser = null;
        localStorage.removeItem("authToken");
        updateAuthUI();
      }
    } catch (error) {
      console.error("Error loading user info:", error);
      authToken = null;
      currentUser = null;
      localStorage.removeItem("authToken");
      updateAuthUI();
    }
  }

  // Update authentication UI
  function updateAuthUI() {
    if (currentUser) {
      loginBtn.classList.add("hidden");
      userInfo.classList.remove("hidden");
      userEmail.textContent = currentUser.email;
      userRole.textContent = currentUser.role;
      
      // Update email field in register form with current user's email
      document.getElementById("email").value = currentUser.email;
      
      // If consultant, make email read-only
      if (currentUser.role === "Consultant") {
        document.getElementById("email").readOnly = true;
      } else {
        document.getElementById("email").readOnly = false;
      }
    } else {
      loginBtn.classList.remove("hidden");
      userInfo.classList.add("hidden");
      document.getElementById("email").value = "";
      document.getElementById("email").readOnly = false;
    }
  }

  // Function to fetch capabilities from API
  async function fetchCapabilities() {
    try {
      const response = await fetch("/capabilities");
      const capabilities = await response.json();

      // Clear loading message
      capabilitiesList.innerHTML = "";

      // Populate capabilities list
      Object.entries(capabilities).forEach(([name, details]) => {
        const capabilityCard = document.createElement("div");
        capabilityCard.className = "capability-card";

        const availableCapacity = details.capacity || 0;
        const currentConsultants = details.consultants ? details.consultants.length : 0;

        // Create consultants HTML with delete icons (only for Admin/Approver)
        const showDeleteButtons = currentUser && (currentUser.role === "Admin" || currentUser.role === "Approver");
        
        const consultantsHTML =
          details.consultants && details.consultants.length > 0
            ? `<div class="consultants-section">
              <h5>Registered Consultants:</h5>
              <ul class="consultants-list">
                ${details.consultants
                  .map(
                    (email) =>
                      `<li><span class="consultant-email">${email}</span>${showDeleteButtons ? `<button class="delete-btn" data-capability="${name}" data-email="${email}">❌</button>` : ''}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No consultants registered yet</em></p>`;

        capabilityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Practice Area:</strong> ${details.practice_area}</p>
          <p><strong>Industry Verticals:</strong> ${details.industry_verticals ? details.industry_verticals.join(', ') : 'Not specified'}</p>
          <p><strong>Capacity:</strong> ${availableCapacity} hours/week available</p>
          <p><strong>Current Team:</strong> ${currentConsultants} consultants</p>
          <div class="consultants-container">
            ${consultantsHTML}
          </div>
        `;

        capabilitiesList.appendChild(capabilityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        capabilitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      capabilitiesList.innerHTML =
        "<p>Failed to load capabilities. Please try again later.</p>";
      console.error("Error fetching capabilities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const capability = button.getAttribute("data-capability");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      messageDiv.textContent = "Please login to unregister consultants";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      messageDiv.textContent = "Please login to register for capabilities";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const email = document.getElementById("email").value;
    const capability = document.getElementById("capability").value;

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/register?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        registerForm.reset();

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to register. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error registering:", error);
    }
  });

  // Initialize app
  fetchCapabilities();
});
