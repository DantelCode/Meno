/**
 * Support page script: validates and sends feedback using EmailJS.
 * - Validates name, email, and message before sending.
 * - Uses EmailJS SDK (client-side) — configure keys in this file.
 */

// EMAIL JS CONFIGURATION
/**
 * EmailJS service, template, and public key
 * Get these from your EmailJS dashboard after setting up a service and template
 */
const EMAIL_SERVICE_ID = '';        // Your EmailJS Service ID
const EMAIL_TEMPLATE_ID = '';      // Your EmailJS Template ID
const EMAIL_PUBLIC_KEY = '';   // Your EmailJS Public Key

// DOM ELEMENT REFERENCES
const supportForm = document.querySelector('form');
const toastContainer = document.getElementById('toastContainer');

// FORM EVENT HANDLERS
/**
 * Initializes EmailJS library
 * Must be called before sending emails
 */
function initEmailJS() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAIL_PUBLIC_KEY);
    console.log('✓ EmailJS initialized');
  } else {
    console.warn('⚠️ EmailJS library not loaded. Check CDN link in HTML.');
  }
}

// Handles support form submission via EmailJS
async function handleSupportFormSubmit(e) {
  e.preventDefault();

  // Get form inputs
  const nameInput = supportForm.querySelector('input[name="name"]');
  const emailInput = supportForm.querySelector('input[name="email"]');
  const messageInput = supportForm.querySelector('textarea[name="message"]');

  if (!nameInput || !emailInput || !messageInput) {
    showToast('Form fields not found', 'error');
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const message = messageInput.value.trim();

  // Validate inputs
  if (!name || !email || !message) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  showToast('Sending feedback...', 'loading');

  try {
    // Check if EmailJS is available
    if (typeof emailjs === 'undefined') {
      throw new Error('EmailJS library not loaded');
    }

    // Send email using EmailJS
    const response = await emailjs.send(
      EMAIL_SERVICE_ID,
      EMAIL_TEMPLATE_ID,
      {
        from_name: name,
        from_email: email,
        message: message,
        to_email: 'ezekwennacd@gmail.com' // Will be replaced by your template
      }
    );

    if (response.status === 200) {
      showToast('✓ Feedback sent successfully! Thank you for reaching out.', 'success');
      supportForm.reset();
    } else {
      throw new Error('EmailJS returned unexpected status');
    }
  } catch (error) {
    console.error('EmailJS Error:', error);
    showToast(`Failed to send feedback: ${error.message}`, 'error');
  }
}

// Attaches form submission handler
if (supportForm) {
  supportForm.addEventListener('submit', handleSupportFormSubmit);
}

// PAGE INITIALIZATION
window.addEventListener('load', () => {
  // Initialize EmailJS
  initEmailJS();

  // Highlight active navigation item for current page
  if (typeof setActiveNav === 'function') {
    setActiveNav();
  }

  // Add micro-animation to donate button (pointerdown for better UX before navigation)
  try {
    const donateLink = document.querySelector('.donate a');
    if (donateLink) {
      donateLink.addEventListener('pointerdown', () => {
        donateLink.classList.add('animating');
        // Remove class after animation completes (longer than animation duration)
        setTimeout(() => donateLink.classList.remove('animating'), 1000);
      });
    }
  } catch (e) { console.warn('Donate animation attach failed', e); }
});
